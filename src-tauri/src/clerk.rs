use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

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
    pub email_address: String,
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
pub struct ClerkUserDetail {
    pub id: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email_addresses: Vec<ClerkEmailAddress>,
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
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkPhoneNumber {
    pub phone_number: String,
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
