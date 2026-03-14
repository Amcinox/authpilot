use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use jsonwebtoken::{decode, decode_header, DecodingKey, Validation, Algorithm};

const CLERK_API_BASE: &str = "https://api.clerk.com/v1";

fn client(secret_key: &str) -> Result<Client, String> {
    Client::builder()
        .default_headers({
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                reqwest::header::AUTHORIZATION,
                reqwest::header::HeaderValue::from_str(&format!("Bearer {}", secret_key))
                    .map_err(|e| format!("Invalid secret key format: {}", e))?,
            );
            headers
        })
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))
}

// ─── Response Types ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkVerifyResult {
    pub valid: bool,
    pub instance_type: Option<String>,
    pub user_count: Option<i64>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkOrg {
    pub id: String,
    pub name: String,
    pub slug: Option<String>,
    pub members_count: Option<i64>,
    pub created_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkUser {
    pub id: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email_addresses: Vec<ClerkEmailAddress>,
    pub created_at: Option<i64>,
    pub last_sign_in_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkEmailAddress {
    pub id: Option<String>,
    pub email_address: String,
    pub verification: Option<ClerkEmailVerification>,
    pub linked_to: Option<Vec<ClerkLinkedIdentity>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkEmailVerification {
    pub status: Option<String>,
    pub strategy: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkLinkedIdentity {
    pub id: Option<String>,
    #[serde(rename = "type")]
    pub identity_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkListResult<T> {
    pub data: Vec<T>,
    pub total_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkSession {
    pub id: String,
    pub user_id: String,
    pub status: String,
    pub last_active_at: Option<i64>,
    pub expire_at: Option<i64>,
    pub created_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkSessionToken {
    pub jwt: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkUserOrgMembership {
    pub id: String,
    pub role: String,
    pub organization: ClerkOrg,
    pub created_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkOrgMemberPublicUserData {
    pub user_id: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub identifier: Option<String>,
    pub image_url: Option<String>,
    pub has_image: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkOrgMember {
    pub id: String,
    pub role: String,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
    pub public_user_data: Option<ClerkOrgMemberPublicUserData>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkUserDetail {
    pub id: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email_addresses: Vec<ClerkEmailAddress>,
    pub primary_email_address_id: Option<String>,
    pub phone_numbers: Vec<ClerkPhoneNumber>,
    pub username: Option<String>,
    pub image_url: Option<String>,
    pub has_image: Option<bool>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
    pub last_sign_in_at: Option<i64>,
    pub last_active_at: Option<i64>,
    pub banned: Option<bool>,
    pub locked: Option<bool>,
    pub public_metadata: Option<Value>,
    pub private_metadata: Option<Value>,
    pub unsafe_metadata: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkPhoneNumber {
    pub phone_number: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkJwtResult {
    pub valid: bool,
    pub header: Value,
    pub payload: Value,
    pub signature_verified: bool,
    pub expired: bool,
    pub error: Option<String>,
    pub expires_at: Option<i64>,
    pub issued_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkInvitation {
    pub id: String,
    pub email_address: String,
    pub status: String,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
    pub revoked: Option<bool>,
}

// ─── Tauri Commands ──────────────────────────────────────────────────────────

/// Verify a Clerk secret key by calling the API
#[tauri::command]
pub async fn clerk_verify_key(secret_key: String) -> Result<ClerkVerifyResult, String> {
    let http = client(&secret_key)?;
    let resp = http
        .get(format!("{}/users?limit=1&offset=0&order_by=-created_at", CLERK_API_BASE))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if resp.status().is_success() {
        let body: Value = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;
        // Users endpoint returns a flat array — count from array length
        let total_count = if body.is_array() {
            body.as_array().map(|a| a.len() as i64)
        } else {
            body.get("total_count").and_then(|v| v.as_i64())
        };

        // Determine instance type from key prefix
        let instance_type = if secret_key.starts_with("sk_live_") {
            Some("production".to_string())
        } else if secret_key.starts_with("sk_test_") {
            Some("development".to_string())
        } else {
            Some("unknown".to_string())
        };

        Ok(ClerkVerifyResult {
            valid: true,
            instance_type,
            user_count: total_count,
            error: None,
        })
    } else {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = body
            .get("errors")
            .and_then(|e| e.as_array())
            .and_then(|arr| arr.first())
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
            .unwrap_or("Unknown error")
            .to_string();

        Ok(ClerkVerifyResult {
            valid: false,
            instance_type: None,
            user_count: None,
            error: Some(format!("{} (HTTP {})", message, status)),
        })
    }
}

/// List organizations from Clerk
#[tauri::command]
pub async fn clerk_list_organizations(
    secret_key: String,
    limit: Option<u32>,
) -> Result<ClerkListResult<ClerkOrg>, String> {
    let http = client(&secret_key)?;
    let limit = limit.unwrap_or(20);

    let resp = http
        .get(format!(
            "{}/organizations?limit={}&order_by=-created_at",
            CLERK_API_BASE, limit
        ))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    let body: Value = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;
    Ok(parse_clerk_list(body))
}

/// List users from Clerk
#[tauri::command]
pub async fn clerk_list_users(
    secret_key: String,
    limit: Option<u32>,
) -> Result<ClerkListResult<ClerkUser>, String> {
    let http = client(&secret_key)?;
    let limit = limit.unwrap_or(20);

    let resp = http
        .get(format!(
            "{}/users?limit={}&offset=0&order_by=-created_at",
            CLERK_API_BASE, limit
        ))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    let body: Value = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;
    Ok(parse_clerk_list(body))
}

/// Get a single user by ID from Clerk
#[tauri::command]
pub async fn clerk_get_user(
    secret_key: String,
    user_id: String,
) -> Result<ClerkUserDetail, String> {
    let http = client(&secret_key)?;

    let resp = http
        .get(format!("{}/users/{}", CLERK_API_BASE, user_id))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    resp.json::<ClerkUserDetail>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Search users by email address
#[tauri::command]
pub async fn clerk_find_user_by_email(
    secret_key: String,
    email: String,
) -> Result<ClerkListResult<ClerkUser>, String> {
    let http = client(&secret_key)?;

    let resp = http
        .get(format!(
            "{}/users?email_address={}",
            CLERK_API_BASE,
            urlencoding::encode(&email)
        ))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    let body: Value = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;
    Ok(parse_clerk_list(body))
}

/// Get a user's organization memberships
#[tauri::command]
pub async fn clerk_get_user_orgs(
    secret_key: String,
    user_id: String,
    limit: Option<u32>,
) -> Result<ClerkListResult<ClerkUserOrgMembership>, String> {
    let http = client(&secret_key)?;
    let limit = limit.unwrap_or(20);

    let resp = http
        .get(format!(
            "{}/users/{}/organization_memberships?limit={}",
            CLERK_API_BASE, user_id, limit
        ))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    let body: Value = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;
    Ok(parse_clerk_list(body))
}

/// List active sessions (optionally for a specific user)
#[tauri::command]
pub async fn clerk_list_sessions(
    secret_key: String,
    user_id: Option<String>,
    status: Option<String>,
    limit: Option<u32>,
) -> Result<ClerkListResult<ClerkSession>, String> {
    let http = client(&secret_key)?;
    let limit = limit.unwrap_or(20);
    let status = status.unwrap_or_else(|| "active".to_string());

    let mut url = format!(
        "{}/sessions?limit={}&status={}",
        CLERK_API_BASE, limit, status
    );

    if let Some(uid) = &user_id {
        url.push_str(&format!("&user_id={}", uid));
    }

    let resp = http
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status_code = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status_code));
    }

    let body: Value = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;
    Ok(parse_clerk_list(body))
}

/// Create a session token (JWT) for a session.
/// Optionally scope the token to a specific organization.
/// Optionally set a custom expiry (in seconds) — Clerk may clamp this.
#[tauri::command]
pub async fn clerk_create_session_token(
    secret_key: String,
    session_id: String,
    organization_id: Option<String>,
    expires_in_seconds: Option<u64>,
) -> Result<ClerkSessionToken, String> {
    let http = client(&secret_key)?;

    let mut req = http.post(format!(
        "{}/sessions/{}/tokens",
        CLERK_API_BASE, session_id
    ));

    // Build JSON body if we have any optional params
    let has_body = organization_id.is_some() || expires_in_seconds.is_some();
    if has_body {
        let mut body = serde_json::Map::new();
        if let Some(org_id) = &organization_id {
            body.insert("organization_id".to_string(), Value::String(org_id.clone()));
        }
        if let Some(exp) = expires_in_seconds {
            body.insert("expires_in_seconds".to_string(), Value::Number(serde_json::Number::from(exp)));
        }
        req = req.json(&Value::Object(body));
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    resp.json::<ClerkSessionToken>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Revoke a session
#[tauri::command]
pub async fn clerk_revoke_session(
    secret_key: String,
    session_id: String,
) -> Result<ClerkSession, String> {
    let http = client(&secret_key)?;

    let resp = http
        .post(format!(
            "{}/sessions/{}/revoke",
            CLERK_API_BASE, session_id
        ))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    resp.json::<ClerkSession>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Ban a user
#[tauri::command]
pub async fn clerk_ban_user(
    secret_key: String,
    user_id: String,
) -> Result<ClerkUserDetail, String> {
    let http = client(&secret_key)?;

    let resp = http
        .post(format!("{}/users/{}/ban", CLERK_API_BASE, user_id))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    resp.json::<ClerkUserDetail>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Unban a user
#[tauri::command]
pub async fn clerk_unban_user(
    secret_key: String,
    user_id: String,
) -> Result<ClerkUserDetail, String> {
    let http = client(&secret_key)?;

    let resp = http
        .post(format!("{}/users/{}/unban", CLERK_API_BASE, user_id))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    resp.json::<ClerkUserDetail>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Update user metadata (public, private, and/or unsafe)
#[tauri::command]
pub async fn clerk_update_user_metadata(
    secret_key: String,
    user_id: String,
    public_metadata: Option<Value>,
    private_metadata: Option<Value>,
    unsafe_metadata: Option<Value>,
) -> Result<ClerkUserDetail, String> {
    let http = client(&secret_key)?;

    let mut body = serde_json::Map::new();
    if let Some(pm) = public_metadata {
        body.insert("public_metadata".to_string(), pm);
    }
    if let Some(pm) = private_metadata {
        body.insert("private_metadata".to_string(), pm);
    }
    if let Some(um) = unsafe_metadata {
        body.insert("unsafe_metadata".to_string(), um);
    }

    let resp = http
        .patch(format!("{}/users/{}/metadata", CLERK_API_BASE, user_id))
        .json(&Value::Object(body))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    resp.json::<ClerkUserDetail>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Get organization details
#[tauri::command]
pub async fn clerk_get_organization(
    secret_key: String,
    organization_id: String,
) -> Result<Value, String> {
    let http = client(&secret_key)?;

    let resp = http
        .get(format!(
            "{}/organizations/{}",
            CLERK_API_BASE, organization_id
        ))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    resp.json::<Value>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Create an organization invitation
#[tauri::command]
pub async fn clerk_create_org_invitation(
    secret_key: String,
    organization_id: String,
    email_address: String,
    role: String,
    inviter_user_id: Option<String>,
) -> Result<Value, String> {
    let http = client(&secret_key)?;

    let mut body = serde_json::json!({
        "email_address": email_address,
        "role": role,
    });

    if let Some(inviter) = inviter_user_id {
        body["inviter_user_id"] = Value::String(inviter);
    }

    let resp = http
        .post(format!(
            "{}/organizations/{}/invitations",
            CLERK_API_BASE, organization_id
        ))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    resp.json::<Value>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// List members of an organization
#[tauri::command]
pub async fn clerk_list_org_members(
    secret_key: String,
    organization_id: String,
    limit: Option<u32>,
) -> Result<ClerkListResult<ClerkOrgMember>, String> {
    let http = client(&secret_key)?;
    let limit = limit.unwrap_or(20);

    let resp = http
        .get(format!(
            "{}/organizations/{}/memberships?limit={}",
            CLERK_API_BASE, organization_id, limit
        ))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    let body: Value = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;
    Ok(parse_clerk_list(body))
}

/// List invitations
#[tauri::command]
pub async fn clerk_list_invitations(
    secret_key: String,
    status: Option<String>,
    limit: Option<u32>,
) -> Result<ClerkListResult<ClerkInvitation>, String> {
    let http = client(&secret_key)?;
    let limit = limit.unwrap_or(20);

    let mut url = format!("{}/invitations?limit={}", CLERK_API_BASE, limit);
    if let Some(s) = &status {
        url.push_str(&format!("&status={}", s));
    }

    let resp = http
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status_code = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status_code));
    }

    let body: Value = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;
    Ok(parse_clerk_list(body))
}

/// Revoke an invitation
#[tauri::command]
pub async fn clerk_revoke_invitation(
    secret_key: String,
    invitation_id: String,
) -> Result<ClerkInvitation, String> {
    let http = client(&secret_key)?;

    let resp = http
        .post(format!("{}/invitations/{}/revoke", CLERK_API_BASE, invitation_id))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    resp.json::<ClerkInvitation>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Delete a user permanently
#[tauri::command]
pub async fn clerk_delete_user(
    secret_key: String,
    user_id: String,
) -> Result<Value, String> {
    let http = client(&secret_key)?;

    let resp = http
        .delete(format!("{}/users/{}", CLERK_API_BASE, user_id))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    resp.json::<Value>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Get the SVIX dashboard URL for managing webhooks
#[tauri::command]
pub async fn clerk_get_svix_url(
    secret_key: String,
) -> Result<Value, String> {
    let http = client(&secret_key)?;

    let resp = http
        .post(format!("{}/webhooks/svix_url", CLERK_API_BASE))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        let message = extract_clerk_error(&body);
        return Err(format!("{} (HTTP {})", message, status));
    }

    resp.json::<Value>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Fetch JWKS (JSON Web Key Set) from the frontend API
#[tauri::command]
pub async fn clerk_get_jwks(
    publishable_key: String,
) -> Result<Value, String> {
    // Derive JWKS URL from publishable key
    let parts: Vec<&str> = publishable_key.split('_').collect();
    let encoded = parts.last().ok_or("Invalid publishable key format")?;
    let decoded_bytes = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        encoded,
    ).map_err(|e| format!("Failed to decode publishable key: {}", e))?;
    let frontend_api = String::from_utf8(decoded_bytes)
        .map_err(|e| format!("Invalid UTF-8 in publishable key: {}", e))?;
    // Remove trailing '$' if present
    let frontend_api = frontend_api.trim_end_matches('$');

    let jwks_url = format!("https://{}/.well-known/jwks.json", frontend_api);

    let http = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let resp = http
        .get(&jwks_url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        return Err(format!("Failed to fetch JWKS (HTTP {})", status));
    }

    resp.json::<Value>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

/// Verify and decode a JWT token.
/// If `jwks_url` is provided, fetches JWKS to verify signature.
/// Otherwise, decodes without signature verification.
#[tauri::command]
pub async fn clerk_verify_jwt(
    token: String,
    jwks_url: Option<String>,
) -> Result<ClerkJwtResult, String> {
    // Decode header first
    let header = decode_header(&token)
        .map_err(|e| format!("Invalid JWT format: {}", e))?;

    let header_json = serde_json::to_value(&header)
        .unwrap_or(Value::Null);

    // Decode payload without verification to always show claims
    let mut validation_insecure = Validation::new(Algorithm::RS256);
    validation_insecure.insecure_disable_signature_validation();
    validation_insecure.validate_exp = false;
    validation_insecure.validate_aud = false;

    let token_data_insecure = decode::<Value>(
        &token,
        &DecodingKey::from_secret(b"not-used"),
        &validation_insecure,
    ).map_err(|e| format!("Failed to decode JWT payload: {}", e))?;

    let payload = token_data_insecure.claims;
    let expires_at = payload.get("exp").and_then(|v| v.as_i64());
    let issued_at = payload.get("iat").and_then(|v| v.as_i64());
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let expired = expires_at.map(|exp| exp < now).unwrap_or(false);

    // If JWKS URL is provided, verify signature
    let mut signature_verified = false;
    let mut verification_error: Option<String> = None;

    if let Some(url) = jwks_url {
        match verify_jwt_with_jwks(&token, &url, &header).await {
            Ok(true) => signature_verified = true,
            Ok(false) => verification_error = Some("Signature verification failed".to_string()),
            Err(e) => verification_error = Some(e),
        }
    }

    Ok(ClerkJwtResult {
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

/// Helper: Verify JWT against JWKS endpoint
async fn verify_jwt_with_jwks(
    token: &str,
    jwks_url: &str,
    header: &jsonwebtoken::Header,
) -> Result<bool, String> {
    let http = reqwest::Client::new();
    let resp = http.get(jwks_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch JWKS: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("JWKS endpoint returned HTTP {}", resp.status().as_u16()));
    }

    let jwks: Value = resp.json().await
        .map_err(|e| format!("Failed to parse JWKS: {}", e))?;

    let keys = jwks.get("keys")
        .and_then(|k| k.as_array())
        .ok_or("JWKS response missing 'keys' array")?;

    // Find matching key by kid
    let kid = header.kid.as_deref();
    let key = if let Some(kid) = kid {
        keys.iter().find(|k| k.get("kid").and_then(|v| v.as_str()) == Some(kid))
    } else {
        keys.first()
    };

    let key = key.ok_or("No matching key found in JWKS")?;

    let n = key.get("n").and_then(|v| v.as_str())
        .ok_or("Key missing 'n' component")?;
    let e = key.get("e").and_then(|v| v.as_str())
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

// ─── Allowlist / Blocklist ───────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkAllowBlockIdentifier {
    pub id: Option<String>,
    pub identifier: Option<String>,
    pub identifier_type: Option<String>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

// ─── Instance Settings ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn clerk_get_instance(
    secret_key: String,
) -> Result<Value, String> {
    let resp = reqwest::Client::new()
        .get("https://api.clerk.com/v1/instance")
        .bearer_auth(&secret_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let body: Value = resp.json().await.unwrap_or_default();
        return Err(extract_clerk_error(&body));
    }

    resp.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clerk_list_allowlist(
    secret_key: String,
) -> Result<Vec<ClerkAllowBlockIdentifier>, String> {
    let resp = reqwest::Client::new()
        .get("https://api.clerk.com/v1/allowlist_identifiers")
        .bearer_auth(&secret_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let body: Value = resp.json().await.unwrap_or_default();
        return Err(extract_clerk_error(&body));
    }

    resp.json::<Vec<ClerkAllowBlockIdentifier>>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clerk_add_allowlist(
    secret_key: String,
    identifier: String,
    notify: Option<bool>,
) -> Result<ClerkAllowBlockIdentifier, String> {
    let mut body = serde_json::json!({ "identifier": identifier });
    if let Some(n) = notify {
        body["notify"] = serde_json::json!(n);
    }

    let resp = reqwest::Client::new()
        .post("https://api.clerk.com/v1/allowlist_identifiers")
        .bearer_auth(&secret_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let body: Value = resp.json().await.unwrap_or_default();
        return Err(extract_clerk_error(&body));
    }

    resp.json::<ClerkAllowBlockIdentifier>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clerk_delete_allowlist(
    secret_key: String,
    identifier_id: String,
) -> Result<Value, String> {
    let url = format!(
        "https://api.clerk.com/v1/allowlist_identifiers/{}",
        urlencoding::encode(&identifier_id)
    );

    let resp = reqwest::Client::new()
        .delete(&url)
        .bearer_auth(&secret_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let body: Value = resp.json().await.unwrap_or_default();
        return Err(extract_clerk_error(&body));
    }

    resp.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clerk_list_blocklist(
    secret_key: String,
) -> Result<Vec<ClerkAllowBlockIdentifier>, String> {
    let resp = reqwest::Client::new()
        .get("https://api.clerk.com/v1/blocklist_identifiers")
        .bearer_auth(&secret_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let body: Value = resp.json().await.unwrap_or_default();
        return Err(extract_clerk_error(&body));
    }

    resp.json::<Vec<ClerkAllowBlockIdentifier>>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clerk_add_blocklist(
    secret_key: String,
    identifier: String,
) -> Result<ClerkAllowBlockIdentifier, String> {
    let body = serde_json::json!({ "identifier": identifier });

    let resp = reqwest::Client::new()
        .post("https://api.clerk.com/v1/blocklist_identifiers")
        .bearer_auth(&secret_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let body: Value = resp.json().await.unwrap_or_default();
        return Err(extract_clerk_error(&body));
    }

    resp.json::<ClerkAllowBlockIdentifier>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clerk_delete_blocklist(
    secret_key: String,
    identifier_id: String,
) -> Result<Value, String> {
    let url = format!(
        "https://api.clerk.com/v1/blocklist_identifiers/{}",
        urlencoding::encode(&identifier_id)
    );

    let resp = reqwest::Client::new()
        .delete(&url)
        .bearer_auth(&secret_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let body: Value = resp.json().await.unwrap_or_default();
        return Err(extract_clerk_error(&body));
    }

    resp.json::<Value>().await.map_err(|e| e.to_string())
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn extract_clerk_error(body: &Value) -> String {
    body.get("errors")
        .and_then(|e| e.as_array())
        .and_then(|arr| arr.first())
        .and_then(|e| e.get("message"))
        .and_then(|m| m.as_str())
        .unwrap_or("Unknown error")
        .to_string()
}

/// Parse a Clerk list response that may be either:
/// - A flat JSON array: [{...}, ...]
/// - An object with data/total_count: { data: [...], total_count: N }
fn parse_clerk_list<T: serde::de::DeserializeOwned>(body: Value) -> ClerkListResult<T> {
    if body.is_array() {
        let data: Vec<T> = serde_json::from_value(body).unwrap_or_default();
        let total_count = data.len() as i64;
        ClerkListResult { data, total_count }
    } else {
        let total_count = body.get("total_count").and_then(|v| v.as_i64()).unwrap_or(0);
        let data: Vec<T> = body
            .get("data")
            .and_then(|d| serde_json::from_value(d.clone()).ok())
            .unwrap_or_default();
        ClerkListResult { data, total_count }
    }
}
