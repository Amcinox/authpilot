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
        let total_count = body.get("total_count").and_then(|v| v.as_i64());

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
    let total_count = body.get("total_count").and_then(|v| v.as_i64()).unwrap_or(0);
    let data: Vec<ClerkOrg> = body
        .get("data")
        .and_then(|d| serde_json::from_value(d.clone()).ok())
        .unwrap_or_default();

    Ok(ClerkListResult { data, total_count })
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
    let total_count = body.get("total_count").and_then(|v| v.as_i64()).unwrap_or(0);
    let data: Vec<ClerkUser> = body
        .get("data")
        .and_then(|d| serde_json::from_value(d.clone()).ok())
        .unwrap_or_default();

    Ok(ClerkListResult { data, total_count })
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
    let total_count = body.get("total_count").and_then(|v| v.as_i64()).unwrap_or(0);
    let data: Vec<ClerkUser> = body
        .get("data")
        .and_then(|d| serde_json::from_value(d.clone()).ok())
        .unwrap_or_default();

    Ok(ClerkListResult { data, total_count })
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
    let total_count = body.get("total_count").and_then(|v| v.as_i64()).unwrap_or(0);
    let data: Vec<ClerkUserOrgMembership> = body
        .get("data")
        .and_then(|d| serde_json::from_value(d.clone()).ok())
        .unwrap_or_default();

    Ok(ClerkListResult { data, total_count })
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

    // Clerk /sessions returns a flat array, not {data, total_count}
    let data: Vec<ClerkSession> = if body.is_array() {
        serde_json::from_value(body.clone()).unwrap_or_default()
    } else {
        body.get("data")
            .and_then(|d| serde_json::from_value(d.clone()).ok())
            .unwrap_or_default()
    };
    let total_count = if body.is_array() {
        data.len() as i64
    } else {
        body.get("total_count").and_then(|v| v.as_i64()).unwrap_or(0)
    };

    Ok(ClerkListResult { data, total_count })
}

/// Create a session token (JWT) for a session
#[tauri::command]
pub async fn clerk_create_session_token(
    secret_key: String,
    session_id: String,
) -> Result<ClerkSessionToken, String> {
    let http = client(&secret_key)?;

    let resp = http
        .post(format!(
            "{}/sessions/{}/tokens",
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
