use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use hmac::{Hmac, Mac};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

// ─── Network Helpers ─────────────────────────────────────────────────────────

fn cognito_host(region: &str) -> String {
    format!("cognito-idp.{}.amazonaws.com", region)
}

fn cognito_endpoint(region: &str) -> String {
    format!("https://{}", cognito_host(region))
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))
}

// ─── Crypto Helpers ──────────────────────────────────────────────────────────

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    to_hex(&hasher.finalize())
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac =
        HmacSha256::new_from_slice(key).expect("HMAC can take key of any size");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

/// Compute Cognito SECRET_HASH = Base64(HMAC-SHA256(clientSecret, username + clientId))
fn compute_secret_hash(username: &str, client_secret: &str, client_id: &str) -> String {
    let message = format!("{}{}", username, client_id);
    let hash = hmac_sha256(client_secret.as_bytes(), message.as_bytes());
    BASE64.encode(&hash)
}

// ─── UTC Date / Time (no chrono dep) ─────────────────────────────────────────

/// Returns `(date "YYYYMMDD", datetime "YYYYMMDDTHHMMSSZ")`.
fn aws_datetime() -> (String, String) {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs();

    let days = (secs / 86400) as i64;
    let tod = secs % 86400;
    let hh = tod / 3600;
    let mm = (tod % 3600) / 60;
    let ss = tod % 60;

    // Howard Hinnant's civil_from_days algorithm
    let z = days + 719_468;
    let era = (if z >= 0 { z } else { z - 146_096 }) / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };

    let date = format!("{:04}{:02}{:02}", y, m, d);
    let datetime = format!("{:04}{:02}{:02}T{:02}{:02}{:02}Z", y, m, d, hh, mm, ss);
    (date, datetime)
}

// ─── AWS SigV4 Signing ───────────────────────────────────────────────────────

/// Make a SigV4-signed POST to the Cognito admin API.
/// `target` = operation name, e.g. `"ListUsers"`.
async fn cognito_admin_request(
    access_key_id: &str,
    secret_access_key: &str,
    region: &str,
    target: &str,
    payload: &Value,
) -> Result<Value, String> {
    let host = cognito_host(region);
    let endpoint = cognito_endpoint(region);
    let amz_target = format!("AWSCognitoIdentityProviderService.{}", target);
    let content_type = "application/x-amz-json-1.1";
    let payload_str = serde_json::to_string(payload).unwrap();
    let (date, datetime) = aws_datetime();

    // 1 ─ Canonical request
    let payload_hash = sha256_hex(payload_str.as_bytes());
    let canonical_headers = format!(
        "content-type:{}\nhost:{}\nx-amz-date:{}\nx-amz-target:{}\n",
        content_type, host, datetime, amz_target
    );
    let signed_headers = "content-type;host;x-amz-date;x-amz-target";
    let canonical_request = format!(
        "POST\n/\n\n{}{}\n{}",
        canonical_headers, signed_headers, payload_hash
    );

    // 2 ─ String to sign
    let credential_scope = format!("{}/{}/cognito-idp/aws4_request", date, region);
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{}\n{}\n{}",
        datetime,
        credential_scope,
        sha256_hex(canonical_request.as_bytes())
    );

    // 3 ─ Signing key
    let k_date = hmac_sha256(
        format!("AWS4{}", secret_access_key).as_bytes(),
        date.as_bytes(),
    );
    let k_region = hmac_sha256(&k_date, region.as_bytes());
    let k_service = hmac_sha256(&k_region, b"cognito-idp");
    let k_signing = hmac_sha256(&k_service, b"aws4_request");

    // 4 ─ Signature
    let signature = to_hex(&hmac_sha256(&k_signing, string_to_sign.as_bytes()));

    // 5 ─ Authorization header
    let authorization = format!(
        "AWS4-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
        access_key_id, credential_scope, signed_headers, signature
    );

    // 6 ─ Send
    let http = http_client()?;
    let resp = http
        .post(&endpoint)
        .header("Content-Type", content_type)
        .header("Host", &host)
        .header("X-Amz-Date", &datetime)
        .header("X-Amz-Target", &amz_target)
        .header("Authorization", &authorization)
        .body(payload_str)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = resp.status().as_u16();
    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if status >= 400 {
        let error_type = body
            .get("__type")
            .and_then(|t| t.as_str())
            .unwrap_or("UnknownError");
        // Strip prefix like "com.amazonaws.cognito.identity.idp.model#"
        let short = error_type.rsplit('#').next().unwrap_or(error_type);
        let message = body
            .get("message")
            .or_else(|| body.get("Message"))
            .and_then(|m| m.as_str())
            .unwrap_or("Unknown error");
        return Err(format!("{}: {}", short, message));
    }

    Ok(body)
}

/// Make an unauthenticated POST (client-facing API, e.g. InitiateAuth).
async fn cognito_public_request(
    region: &str,
    target: &str,
    payload: &Value,
) -> Result<Value, String> {
    let endpoint = cognito_endpoint(region);
    let amz_target = format!("AWSCognitoIdentityProviderService.{}", target);

    let http = http_client()?;
    let resp = http
        .post(&endpoint)
        .header("Content-Type", "application/x-amz-json-1.1")
        .header(
            "X-Amz-Target",
            &amz_target,
        )
        .json(payload)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = resp.status().as_u16();
    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if status >= 400 {
        let error_type = body
            .get("__type")
            .and_then(|t| t.as_str())
            .unwrap_or("UnknownError");
        let short = error_type.rsplit('#').next().unwrap_or(error_type);
        let message = body
            .get("message")
            .or_else(|| body.get("Message"))
            .and_then(|m| m.as_str())
            .unwrap_or("Unknown error");
        return Err(format!("{}: {}", short, message));
    }

    Ok(body)
}

// ─── Response Types ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CognitoValidateResult {
    pub valid: bool,
    pub region: String,
    pub user_pool_id: String,
    pub key_count: usize,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CognitoAttribute {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CognitoUser {
    pub username: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub enabled: bool,
    pub status: String,
    pub create_date: f64,
    pub modified_date: f64,
    pub attributes: Vec<CognitoAttribute>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CognitoUserDetail {
    pub username: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub enabled: bool,
    pub status: String,
    pub create_date: f64,
    pub modified_date: f64,
    pub attributes: Vec<CognitoAttribute>,
    pub mfa_options: Vec<Value>,
    pub preferred_mfa: Option<String>,
    pub mfa_settings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CognitoGroup {
    pub group_name: String,
    pub user_pool_id: String,
    pub description: Option<String>,
    pub role_arn: Option<String>,
    pub precedence: Option<i64>,
    pub creation_date: f64,
    pub modified_date: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CognitoPoolClient {
    pub client_id: String,
    pub client_name: String,
    pub user_pool_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CognitoPoolStats {
    pub id: String,
    pub name: String,
    pub estimated_number_of_users: i64,
    pub creation_date: f64,
    pub last_modified_date: f64,
    pub mfa_configuration: String,
    pub deletion_protection: String,
    pub auto_verified_attributes: Vec<String>,
    pub username_attributes: Vec<String>,
    pub policies: Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CognitoAuthResult {
    pub authenticated: bool,
    pub access_token: Option<String>,
    pub id_token: Option<String>,
    pub refresh_token: Option<String>,
    pub expires_in: Option<i64>,
    pub token_type: Option<String>,
    pub challenge_name: Option<String>,
    pub challenge_parameters: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CognitoJwtResult {
    pub valid: bool,
    pub header: Value,
    pub payload: Value,
    pub signature_verified: bool,
    pub expired: bool,
    pub error: Option<String>,
    pub expires_at: Option<i64>,
    pub issued_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CognitoListUsersResult {
    pub users: Vec<CognitoUser>,
    pub pagination_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CognitoListGroupsResult {
    pub groups: Vec<CognitoGroup>,
    pub next_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CognitoListClientsResult {
    pub clients: Vec<CognitoPoolClient>,
    pub next_token: Option<String>,
}

// ─── JSON Parsing Helpers ────────────────────────────────────────────────────

fn parse_attributes(v: &Value, key: &str) -> Vec<CognitoAttribute> {
    v.get(key)
        .and_then(|a| a.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|attr| {
                    Some(CognitoAttribute {
                        name: attr.get("Name")?.as_str()?.to_string(),
                        value: attr.get("Value")?.as_str()?.to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

fn attr_value(attrs: &[CognitoAttribute], name: &str) -> Option<String> {
    attrs
        .iter()
        .find(|a| a.name == name)
        .map(|a| a.value.clone())
}

fn derive_name(attrs: &[CognitoAttribute]) -> Option<String> {
    attr_value(attrs, "name").or_else(|| {
        let given = attr_value(attrs, "given_name").unwrap_or_default();
        let family = attr_value(attrs, "family_name").unwrap_or_default();
        let full = format!("{} {}", given, family).trim().to_string();
        if full.is_empty() {
            None
        } else {
            Some(full)
        }
    })
}

fn parse_cognito_user(v: &Value) -> CognitoUser {
    let attributes = parse_attributes(v, "Attributes");
    CognitoUser {
        username: v["Username"].as_str().unwrap_or("").to_string(),
        email: attr_value(&attributes, "email"),
        name: derive_name(&attributes),
        enabled: v["Enabled"].as_bool().unwrap_or(false),
        status: v["UserStatus"].as_str().unwrap_or("UNKNOWN").to_string(),
        create_date: v["UserCreateDate"].as_f64().unwrap_or(0.0),
        modified_date: v["UserLastModifiedDate"].as_f64().unwrap_or(0.0),
        attributes,
    }
}

fn parse_cognito_user_detail(v: &Value) -> CognitoUserDetail {
    let attributes = parse_attributes(v, "UserAttributes");
    CognitoUserDetail {
        username: v["Username"].as_str().unwrap_or("").to_string(),
        email: attr_value(&attributes, "email"),
        name: derive_name(&attributes),
        enabled: v["Enabled"].as_bool().unwrap_or(false),
        status: v["UserStatus"].as_str().unwrap_or("UNKNOWN").to_string(),
        create_date: v["UserCreateDate"].as_f64().unwrap_or(0.0),
        modified_date: v["UserLastModifiedDate"].as_f64().unwrap_or(0.0),
        attributes,
        mfa_options: v
            .get("MFAOptions")
            .and_then(|m| m.as_array())
            .cloned()
            .unwrap_or_default(),
        preferred_mfa: v["PreferredMfaSetting"]
            .as_str()
            .map(|s| s.to_string()),
        mfa_settings: v
            .get("UserMFASettingList")
            .and_then(|m| m.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|s| s.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default(),
    }
}

fn parse_cognito_group(v: &Value) -> CognitoGroup {
    CognitoGroup {
        group_name: v["GroupName"].as_str().unwrap_or("").to_string(),
        user_pool_id: v["UserPoolId"].as_str().unwrap_or("").to_string(),
        description: v["Description"].as_str().map(|s| s.to_string()),
        role_arn: v["RoleArn"].as_str().map(|s| s.to_string()),
        precedence: v["Precedence"].as_i64(),
        creation_date: v["CreationDate"].as_f64().unwrap_or(0.0),
        modified_date: v["LastModifiedDate"].as_f64().unwrap_or(0.0),
    }
}

// ─── Tauri Commands ──────────────────────────────────────────────────────────

/// Validate Cognito configuration by checking the User Pool's JWKS endpoint
/// (publicly accessible, no IAM auth needed).
#[tauri::command]
pub async fn cognito_validate(
    user_pool_id: String,
    region: String,
) -> Result<CognitoValidateResult, String> {
    if !user_pool_id.contains('_') {
        return Ok(CognitoValidateResult {
            valid: false,
            region: region.clone(),
            user_pool_id,
            key_count: 0,
            error: Some("Invalid User Pool ID format. Expected: <region>_<id>".into()),
        });
    }

    let pool_region = user_pool_id.split('_').next().unwrap_or("").to_string();
    if pool_region != region {
        return Ok(CognitoValidateResult {
            valid: false,
            region: region.clone(),
            user_pool_id,
            key_count: 0,
            error: Some(format!(
                "Region mismatch: pool region '{}' ≠ configured '{}'",
                pool_region, region
            )),
        });
    }

    let jwks_url = format!(
        "https://cognito-idp.{}.amazonaws.com/{}/.well-known/jwks.json",
        region, user_pool_id
    );

    let http = http_client()?;
    let resp = http
        .get(&jwks_url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if resp.status().is_success() {
        let body: Value = resp
            .json()
            .await
            .map_err(|e| format!("Parse error: {}", e))?;
        let key_count = body
            .get("keys")
            .and_then(|k| k.as_array())
            .map(|arr| arr.len())
            .unwrap_or(0);

        if key_count > 0 {
            Ok(CognitoValidateResult {
                valid: true,
                region,
                user_pool_id,
                key_count,
                error: None,
            })
        } else {
            Ok(CognitoValidateResult {
                valid: false,
                region,
                user_pool_id,
                key_count: 0,
                error: Some("User Pool exists but has no signing keys".into()),
            })
        }
    } else {
        Ok(CognitoValidateResult {
            valid: false,
            region,
            user_pool_id,
            key_count: 0,
            error: Some(format!(
                "Cannot reach User Pool (HTTP {}). Check ID and region.",
                resp.status().as_u16()
            )),
        })
    }
}

// ─── Pool Statistics (DescribeUserPool) ──────────────────────────────────────

#[tauri::command]
pub async fn cognito_describe_pool(
    access_key_id: String,
    secret_access_key: String,
    user_pool_id: String,
    region: String,
) -> Result<CognitoPoolStats, String> {
    let resp = cognito_admin_request(
        &access_key_id,
        &secret_access_key,
        &region,
        "DescribeUserPool",
        &json!({ "UserPoolId": user_pool_id }),
    )
    .await?;

    let pool = resp.get("UserPool").ok_or("Missing UserPool in response")?;

    Ok(CognitoPoolStats {
        id: pool["Id"].as_str().unwrap_or("").to_string(),
        name: pool["Name"].as_str().unwrap_or("").to_string(),
        estimated_number_of_users: pool["EstimatedNumberOfUsers"].as_i64().unwrap_or(0),
        creation_date: pool["CreationDate"].as_f64().unwrap_or(0.0),
        last_modified_date: pool["LastModifiedDate"].as_f64().unwrap_or(0.0),
        mfa_configuration: pool["MfaConfiguration"]
            .as_str()
            .unwrap_or("OFF")
            .to_string(),
        deletion_protection: pool["DeletionProtection"]
            .as_str()
            .unwrap_or("INACTIVE")
            .to_string(),
        auto_verified_attributes: pool
            .get("AutoVerifiedAttributes")
            .and_then(|a| a.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default(),
        username_attributes: pool
            .get("UsernameAttributes")
            .and_then(|a| a.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default(),
        policies: pool.get("Policies").cloned().unwrap_or(Value::Null),
    })
}

// ─── List Users ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cognito_list_users(
    access_key_id: String,
    secret_access_key: String,
    user_pool_id: String,
    region: String,
    pagination_token: Option<String>,
    filter: Option<String>,
) -> Result<CognitoListUsersResult, String> {
    let mut payload = json!({
        "UserPoolId": user_pool_id,
        "Limit": 60
    });
    if let Some(tok) = pagination_token {
        payload["PaginationToken"] = json!(tok);
    }
    if let Some(f) = filter {
        if !f.is_empty() {
            payload["Filter"] = json!(f);
        }
    }

    let resp = cognito_admin_request(
        &access_key_id,
        &secret_access_key,
        &region,
        "ListUsers",
        &payload,
    )
    .await?;

    let users = resp
        .get("Users")
        .and_then(|u| u.as_array())
        .map(|arr| arr.iter().map(parse_cognito_user).collect())
        .unwrap_or_default();
    let token = resp["PaginationToken"]
        .as_str()
        .map(|s| s.to_string());

    Ok(CognitoListUsersResult {
        users,
        pagination_token: token,
    })
}

// ─── Get User Detail ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cognito_get_user(
    access_key_id: String,
    secret_access_key: String,
    user_pool_id: String,
    region: String,
    username: String,
) -> Result<CognitoUserDetail, String> {
    let resp = cognito_admin_request(
        &access_key_id,
        &secret_access_key,
        &region,
        "AdminGetUser",
        &json!({ "UserPoolId": user_pool_id, "Username": username }),
    )
    .await?;

    Ok(parse_cognito_user_detail(&resp))
}

// ─── Disable / Enable User ──────────────────────────────────────────────────

#[tauri::command]
pub async fn cognito_disable_user(
    access_key_id: String,
    secret_access_key: String,
    user_pool_id: String,
    region: String,
    username: String,
) -> Result<CognitoUserDetail, String> {
    cognito_admin_request(
        &access_key_id,
        &secret_access_key,
        &region,
        "AdminDisableUser",
        &json!({ "UserPoolId": user_pool_id, "Username": username }),
    )
    .await?;

    // Re-fetch the user to return updated state
    cognito_get_user(access_key_id, secret_access_key, user_pool_id, region, username).await
}

#[tauri::command]
pub async fn cognito_enable_user(
    access_key_id: String,
    secret_access_key: String,
    user_pool_id: String,
    region: String,
    username: String,
) -> Result<CognitoUserDetail, String> {
    cognito_admin_request(
        &access_key_id,
        &secret_access_key,
        &region,
        "AdminEnableUser",
        &json!({ "UserPoolId": user_pool_id, "Username": username }),
    )
    .await?;

    cognito_get_user(access_key_id, secret_access_key, user_pool_id, region, username).await
}

// ─── Reset User Password ────────────────────────────────────────────────────

#[tauri::command]
pub async fn cognito_reset_password(
    access_key_id: String,
    secret_access_key: String,
    user_pool_id: String,
    region: String,
    username: String,
) -> Result<CognitoUserDetail, String> {
    cognito_admin_request(
        &access_key_id,
        &secret_access_key,
        &region,
        "AdminResetUserPassword",
        &json!({ "UserPoolId": user_pool_id, "Username": username }),
    )
    .await?;

    cognito_get_user(access_key_id, secret_access_key, user_pool_id, region, username).await
}

// ─── Confirm User ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cognito_confirm_user(
    access_key_id: String,
    secret_access_key: String,
    user_pool_id: String,
    region: String,
    username: String,
) -> Result<CognitoUserDetail, String> {
    cognito_admin_request(
        &access_key_id,
        &secret_access_key,
        &region,
        "AdminConfirmSignUp",
        &json!({ "UserPoolId": user_pool_id, "Username": username }),
    )
    .await?;

    cognito_get_user(access_key_id, secret_access_key, user_pool_id, region, username).await
}

// ─── List Groups ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cognito_list_groups(
    access_key_id: String,
    secret_access_key: String,
    user_pool_id: String,
    region: String,
    next_token: Option<String>,
) -> Result<CognitoListGroupsResult, String> {
    let mut payload = json!({
        "UserPoolId": user_pool_id,
        "Limit": 60
    });
    if let Some(tok) = next_token {
        payload["NextToken"] = json!(tok);
    }

    let resp = cognito_admin_request(
        &access_key_id,
        &secret_access_key,
        &region,
        "ListGroups",
        &payload,
    )
    .await?;

    let groups = resp
        .get("Groups")
        .and_then(|g| g.as_array())
        .map(|arr| arr.iter().map(parse_cognito_group).collect())
        .unwrap_or_default();
    let token = resp["NextToken"].as_str().map(|s| s.to_string());

    Ok(CognitoListGroupsResult {
        groups,
        next_token: token,
    })
}

// ─── User Group Membership ───────────────────────────────────────────────────

#[tauri::command]
pub async fn cognito_list_user_groups(
    access_key_id: String,
    secret_access_key: String,
    user_pool_id: String,
    region: String,
    username: String,
) -> Result<CognitoListGroupsResult, String> {
    let resp = cognito_admin_request(
        &access_key_id,
        &secret_access_key,
        &region,
        "AdminListGroupsForUser",
        &json!({ "UserPoolId": user_pool_id, "Username": username, "Limit": 60 }),
    )
    .await?;

    let groups = resp
        .get("Groups")
        .and_then(|g| g.as_array())
        .map(|arr| arr.iter().map(parse_cognito_group).collect())
        .unwrap_or_default();
    let token = resp["NextToken"].as_str().map(|s| s.to_string());

    Ok(CognitoListGroupsResult {
        groups,
        next_token: token,
    })
}

#[tauri::command]
pub async fn cognito_add_user_to_group(
    access_key_id: String,
    secret_access_key: String,
    user_pool_id: String,
    region: String,
    username: String,
    group_name: String,
) -> Result<(), String> {
    cognito_admin_request(
        &access_key_id,
        &secret_access_key,
        &region,
        "AdminAddUserToGroup",
        &json!({
            "UserPoolId": user_pool_id,
            "Username": username,
            "GroupName": group_name,
        }),
    )
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn cognito_remove_user_from_group(
    access_key_id: String,
    secret_access_key: String,
    user_pool_id: String,
    region: String,
    username: String,
    group_name: String,
) -> Result<(), String> {
    cognito_admin_request(
        &access_key_id,
        &secret_access_key,
        &region,
        "AdminRemoveUserFromGroup",
        &json!({
            "UserPoolId": user_pool_id,
            "Username": username,
            "GroupName": group_name,
        }),
    )
    .await?;
    Ok(())
}

// ─── List User Pool Clients ─────────────────────────────────────────────────

#[tauri::command]
pub async fn cognito_list_pool_clients(
    access_key_id: String,
    secret_access_key: String,
    user_pool_id: String,
    region: String,
    next_token: Option<String>,
) -> Result<CognitoListClientsResult, String> {
    let mut payload = json!({
        "UserPoolId": user_pool_id,
        "MaxResults": 60
    });
    if let Some(tok) = next_token {
        payload["NextToken"] = json!(tok);
    }

    let resp = cognito_admin_request(
        &access_key_id,
        &secret_access_key,
        &region,
        "ListUserPoolClients",
        &payload,
    )
    .await?;

    let clients = resp
        .get("UserPoolClients")
        .and_then(|c| c.as_array())
        .map(|arr| {
            arr.iter()
                .map(|c| CognitoPoolClient {
                    client_id: c["ClientId"].as_str().unwrap_or("").to_string(),
                    client_name: c["ClientName"].as_str().unwrap_or("").to_string(),
                    user_pool_id: c["UserPoolId"].as_str().unwrap_or("").to_string(),
                })
                .collect()
        })
        .unwrap_or_default();
    let token = resp["NextToken"].as_str().map(|s| s.to_string());

    Ok(CognitoListClientsResult {
        clients,
        next_token: token,
    })
}

// ─── Decode / Verify Cognito JWT ─────────────────────────────────────────────

#[tauri::command]
pub async fn cognito_decode_token(
    token: String,
    user_pool_id: String,
    region: String,
) -> Result<CognitoJwtResult, String> {
    // Decode header
    let header = decode_header(&token)
        .map_err(|e| format!("Invalid JWT format: {}", e))?;
    let header_json =
        serde_json::to_value(&header).unwrap_or(Value::Null);

    // Decode payload without verification
    let mut val_insecure = Validation::new(Algorithm::RS256);
    val_insecure.insecure_disable_signature_validation();
    val_insecure.validate_exp = false;
    val_insecure.validate_aud = false;

    let payload = decode::<Value>(
        &token,
        &DecodingKey::from_secret(b"unused"),
        &val_insecure,
    )
    .map_err(|e| format!("Failed to decode JWT payload: {}", e))?
    .claims;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let expires_at = payload.get("exp").and_then(|v| v.as_i64());
    let issued_at = payload.get("iat").and_then(|v| v.as_i64());
    let expired = expires_at.map(|e| e < now).unwrap_or(false);

    // Verify signature against the pool's JWKS
    let jwks_url = format!(
        "https://cognito-idp.{}.amazonaws.com/{}/.well-known/jwks.json",
        region, user_pool_id
    );

    let mut signature_verified = false;
    let mut verification_error: Option<String> = None;

    match verify_jwt_with_jwks(&token, &jwks_url, &header).await {
        Ok(true) => signature_verified = true,
        Ok(false) => {
            verification_error =
                Some("Signature verification failed".to_string())
        }
        Err(e) => verification_error = Some(e),
    }

    Ok(CognitoJwtResult {
        valid: signature_verified && !expired,
        header: header_json,
        payload,
        signature_verified,
        expired,
        error: verification_error,
        expires_at,
        issued_at,
    })
}

/// Reusable JWT-against-JWKS verifier (same logic as Clerk).
async fn verify_jwt_with_jwks(
    token: &str,
    jwks_url: &str,
    header: &jsonwebtoken::Header,
) -> Result<bool, String> {
    let http = reqwest::Client::new();
    let resp = http
        .get(jwks_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch JWKS: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "JWKS endpoint returned HTTP {}",
            resp.status().as_u16()
        ));
    }

    let jwks: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse JWKS: {}", e))?;

    let keys = jwks
        .get("keys")
        .and_then(|k| k.as_array())
        .ok_or("JWKS response missing 'keys' array")?;

    let kid = header.kid.as_deref();
    let key = if let Some(kid) = kid {
        keys.iter()
            .find(|k| k.get("kid").and_then(|v| v.as_str()) == Some(kid))
    } else {
        keys.first()
    };
    let key = key.ok_or("No matching key found in JWKS")?;

    let n = key["n"]
        .as_str()
        .ok_or("Key missing 'n' component")?;
    let e = key["e"]
        .as_str()
        .ok_or("Key missing 'e' component")?;

    let decoding_key = DecodingKey::from_rsa_components(n, e)
        .map_err(|err| format!("Invalid RSA key components: {}", err))?;

    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_exp = false;
    validation.validate_aud = false;

    match decode::<Value>(token, &decoding_key, &validation) {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("Signature verification failed: {}", e)),
    }
}

// ─── JWKS Viewer ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cognito_get_jwks(
    user_pool_id: String,
    region: String,
) -> Result<Value, String> {
    let url = format!(
        "https://cognito-idp.{}.amazonaws.com/{}/.well-known/jwks.json",
        region, user_pool_id
    );
    let http = http_client()?;
    let resp = http
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "JWKS endpoint returned HTTP {}",
            resp.status().as_u16()
        ));
    }

    resp.json::<Value>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

// ─── Initiate Auth (client-facing, no SigV4) ────────────────────────────────

#[tauri::command]
pub async fn cognito_initiate_auth(
    client_id: String,
    client_secret: Option<String>,
    region: String,
    username: String,
    password: String,
) -> Result<CognitoAuthResult, String> {
    let mut auth_params = json!({
        "USERNAME": username,
        "PASSWORD": password,
    });

    if let Some(ref secret) = client_secret {
        if !secret.is_empty() {
            let hash = compute_secret_hash(&username, secret, &client_id);
            auth_params["SECRET_HASH"] = json!(hash);
        }
    }

    let payload = json!({
        "AuthFlow": "USER_PASSWORD_AUTH",
        "ClientId": client_id,
        "AuthParameters": auth_params,
    });

    let resp =
        cognito_public_request(&region, "InitiateAuth", &payload).await?;

    if let Some(ar) = resp.get("AuthenticationResult") {
        Ok(CognitoAuthResult {
            authenticated: true,
            access_token: ar["AccessToken"].as_str().map(|s| s.to_string()),
            id_token: ar["IdToken"].as_str().map(|s| s.to_string()),
            refresh_token: ar["RefreshToken"]
                .as_str()
                .map(|s| s.to_string()),
            expires_in: ar["ExpiresIn"].as_i64(),
            token_type: ar["TokenType"].as_str().map(|s| s.to_string()),
            challenge_name: None,
            challenge_parameters: None,
        })
    } else {
        Ok(CognitoAuthResult {
            authenticated: false,
            access_token: None,
            id_token: None,
            refresh_token: None,
            expires_in: None,
            token_type: None,
            challenge_name: resp["ChallengeName"]
                .as_str()
                .map(|s| s.to_string()),
            challenge_parameters: resp.get("ChallengeParameters").cloned(),
        })
    }
}

// ─── Global Sign Out ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cognito_global_signout(
    access_key_id: String,
    secret_access_key: String,
    user_pool_id: String,
    region: String,
    username: String,
) -> Result<CognitoUserDetail, String> {
    cognito_admin_request(
        &access_key_id,
        &secret_access_key,
        &region,
        "AdminUserGlobalSignOut",
        &json!({ "UserPoolId": user_pool_id, "Username": username }),
    )
    .await?;

    cognito_get_user(access_key_id, secret_access_key, user_pool_id, region, username).await
}
