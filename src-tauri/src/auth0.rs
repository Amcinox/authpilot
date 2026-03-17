use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn mgmt_base(domain: &str) -> String {
    format!("https://{}/api/v2", domain.trim_end_matches('/'))
}

fn http_client(token: &str) -> Result<Client, String> {
    Client::builder()
        .default_headers({
            let mut h = reqwest::header::HeaderMap::new();
            h.insert(
                reqwest::header::AUTHORIZATION,
                reqwest::header::HeaderValue::from_str(&format!("Bearer {}", token))
                    .map_err(|e| format!("Invalid token: {}", e))?,
            );
            h
        })
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))
}

/// Obtain a Management API access token via client_credentials grant.
async fn get_mgmt_token(domain: &str, client_id: &str, client_secret: &str) -> Result<String, String> {
    let url = format!("https://{}/oauth/token", domain.trim_end_matches('/'));
    let body = serde_json::json!({
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "audience": format!("https://{}/api/v2/", domain.trim_end_matches('/'))
    });
    let res = Client::new()
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Token request failed: {}", e))?;
    let status = res.status();
    let json: Value = res.json().await.map_err(|e| format!("Token parse error: {}", e))?;
    if !status.is_success() {
        return Err(format!(
            "Auth0 token error ({}): {}",
            status,
            json.get("error_description")
                .or(json.get("error"))
                .map(|v| v.as_str().unwrap_or("unknown"))
                .unwrap_or("unknown")
        ));
    }
    json.get("access_token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "No access_token in response".to_string())
}

/// Helper: make a GET request to the Management API.
async fn mgmt_get(domain: &str, path: &str, token: &str) -> Result<Value, String> {
    let url = format!("{}{}", mgmt_base(domain), path);
    let res = http_client(token)?
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    let status = res.status();
    let json: Value = res.json().await.map_err(|e| format!("Parse error: {}", e))?;
    if !status.is_success() {
        return Err(format!(
            "Auth0 API error ({}): {}",
            status,
            json.get("message")
                .or(json.get("error"))
                .map(|v| v.as_str().unwrap_or("unknown"))
                .unwrap_or(&json.to_string())
        ));
    }
    Ok(json)
}

/// Helper: make a PATCH request.
async fn mgmt_patch(domain: &str, path: &str, token: &str, body: Value) -> Result<Value, String> {
    let url = format!("{}{}", mgmt_base(domain), path);
    let res = http_client(token)?
        .patch(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    let status = res.status();
    let json: Value = res.json().await.map_err(|e| format!("Parse error: {}", e))?;
    if !status.is_success() {
        return Err(format!(
            "Auth0 API error ({}): {}",
            status,
            json.get("message").or(json.get("error")).map(|v| v.as_str().unwrap_or("unknown")).unwrap_or(&json.to_string())
        ));
    }
    Ok(json)
}

/// Helper: make a POST request.
async fn mgmt_post(domain: &str, path: &str, token: &str, body: Value) -> Result<Value, String> {
    let url = format!("{}{}", mgmt_base(domain), path);
    let res = http_client(token)?
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    let status = res.status();
    let text = res.text().await.map_err(|e| format!("Read error: {}", e))?;
    let json: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(format!(
            "Auth0 API error ({}): {}",
            status,
            json.get("message").or(json.get("error")).map(|v| v.as_str().unwrap_or("unknown")).unwrap_or(&text)
        ));
    }
    Ok(json)
}

/// Helper: make a DELETE request.
async fn mgmt_delete(domain: &str, path: &str, token: &str) -> Result<(), String> {
    let url = format!("{}{}", mgmt_base(domain), path);
    let res = http_client(token)?
        .delete(&url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Auth0 API error: {}", text));
    }
    Ok(())
}

/// Helper: DELETE with JSON body.
async fn mgmt_delete_body(domain: &str, path: &str, token: &str, body: Value) -> Result<(), String> {
    let url = format!("{}{}", mgmt_base(domain), path);
    let res = http_client(token)?
        .delete(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Auth0 API error: {}", text));
    }
    Ok(())
}

// ─── Response Types ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0VerifyResult {
    pub valid: bool,
    pub tenant_name: Option<String>,
    pub region: Option<String>,
    pub environment: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0User {
    pub user_id: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub connection: Option<String>,
    pub last_login: Option<String>,
    pub logins_count: Option<i64>,
    pub blocked: Option<bool>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0UserDetail {
    pub user_id: String,
    pub email: Option<String>,
    pub email_verified: Option<bool>,
    pub name: Option<String>,
    pub nickname: Option<String>,
    pub picture: Option<String>,
    pub last_login: Option<String>,
    pub last_ip: Option<String>,
    pub logins_count: Option<i64>,
    pub blocked: Option<bool>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub identities: Vec<Value>,
    pub user_metadata: Value,
    pub app_metadata: Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0Connection {
    pub id: String,
    pub name: String,
    pub strategy: String,
    pub enabled_clients: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0Role {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0Organization {
    pub id: String,
    pub name: String,
    pub display_name: Option<String>,
    pub branding: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0OrgMember {
    pub user_id: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub roles: Vec<Auth0Role>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0LogEvent {
    pub log_id: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub date: String,
    pub description: Option<String>,
    pub ip: Option<String>,
    pub user_id: Option<String>,
    pub user_name: Option<String>,
    pub connection: Option<String>,
    pub client_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0Client {
    pub client_id: String,
    pub name: String,
    pub app_type: Option<String>,
    pub callbacks: Vec<String>,
    pub allowed_origins: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0ClientDetail {
    pub client_id: String,
    pub name: String,
    pub app_type: Option<String>,
    pub callbacks: Vec<String>,
    pub allowed_origins: Vec<String>,
    pub allowed_logout_urls: Vec<String>,
    pub grant_types: Vec<String>,
    pub token_endpoint_auth_method: Option<String>,
    pub is_first_party: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0JwtResult {
    pub valid: bool,
    pub header: Value,
    pub payload: Value,
    pub signature_verified: bool,
    pub expired: bool,
    pub issued_at: Option<i64>,
    pub expires_at: Option<i64>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0TokenResult {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub scope: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0Grant {
    pub id: String,
    pub user_id: String,
    #[serde(alias = "clientID")]
    pub client_id: String,
    pub audience: Option<String>,
    pub scope: Vec<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0Action {
    pub id: String,
    pub name: String,
    pub supported_triggers: Vec<Value>,
    pub status: Option<String>,
    pub deployed: Option<bool>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0ListResult<T> {
    pub items: Vec<T>,
    pub total: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Auth0TenantSettings {
    pub friendly_name: Option<String>,
    pub support_email: Option<String>,
    pub support_url: Option<String>,
    pub default_directory: Option<String>,
    pub session_lifetime: Option<f64>,
    pub idle_session_lifetime: Option<f64>,
    pub sandbox_version: Option<String>,
    pub flags: Value,
}

// ─── JSON Parsers ────────────────────────────────────────────────────────────

fn parse_user(v: &Value) -> Auth0User {
    Auth0User {
        user_id: v["user_id"].as_str().unwrap_or_default().to_string(),
        email: v["email"].as_str().map(|s| s.to_string()),
        name: v["name"].as_str().map(|s| s.to_string()),
        picture: v["picture"].as_str().map(|s| s.to_string()),
        connection: v.get("identities")
            .and_then(|ids| ids.as_array())
            .and_then(|arr| arr.first())
            .and_then(|id| id["connection"].as_str())
            .map(|s| s.to_string()),
        last_login: v["last_login"].as_str().map(|s| s.to_string()),
        logins_count: v["logins_count"].as_i64(),
        blocked: v["blocked"].as_bool(),
        created_at: v["created_at"].as_str().map(|s| s.to_string()),
    }
}

fn parse_user_detail(v: &Value) -> Auth0UserDetail {
    Auth0UserDetail {
        user_id: v["user_id"].as_str().unwrap_or_default().to_string(),
        email: v["email"].as_str().map(|s| s.to_string()),
        email_verified: v["email_verified"].as_bool(),
        name: v["name"].as_str().map(|s| s.to_string()),
        nickname: v["nickname"].as_str().map(|s| s.to_string()),
        picture: v["picture"].as_str().map(|s| s.to_string()),
        last_login: v["last_login"].as_str().map(|s| s.to_string()),
        last_ip: v["last_ip"].as_str().map(|s| s.to_string()),
        logins_count: v["logins_count"].as_i64(),
        blocked: v["blocked"].as_bool(),
        created_at: v["created_at"].as_str().map(|s| s.to_string()),
        updated_at: v["updated_at"].as_str().map(|s| s.to_string()),
        identities: v["identities"].as_array().cloned().unwrap_or_default(),
        user_metadata: v["user_metadata"].clone(),
        app_metadata: v["app_metadata"].clone(),
    }
}

fn parse_connection(v: &Value) -> Auth0Connection {
    Auth0Connection {
        id: v["id"].as_str().unwrap_or_default().to_string(),
        name: v["name"].as_str().unwrap_or_default().to_string(),
        strategy: v["strategy"].as_str().unwrap_or_default().to_string(),
        enabled_clients: v["enabled_clients"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default(),
    }
}

fn parse_role(v: &Value) -> Auth0Role {
    Auth0Role {
        id: v["id"].as_str().unwrap_or_default().to_string(),
        name: v["name"].as_str().unwrap_or_default().to_string(),
        description: v["description"].as_str().map(|s| s.to_string()),
    }
}

fn parse_org(v: &Value) -> Auth0Organization {
    Auth0Organization {
        id: v["id"].as_str().unwrap_or_default().to_string(),
        name: v["name"].as_str().unwrap_or_default().to_string(),
        display_name: v["display_name"].as_str().map(|s| s.to_string()),
        branding: v.get("branding").cloned(),
    }
}

fn parse_org_member(v: &Value) -> Auth0OrgMember {
    Auth0OrgMember {
        user_id: v["user_id"].as_str().unwrap_or_default().to_string(),
        email: v["email"].as_str().map(|s| s.to_string()),
        name: v["name"].as_str().map(|s| s.to_string()),
        picture: v["picture"].as_str().map(|s| s.to_string()),
        roles: v["roles"]
            .as_array()
            .map(|arr| arr.iter().map(parse_role).collect())
            .unwrap_or_default(),
    }
}

fn parse_log_event(v: &Value) -> Auth0LogEvent {
    Auth0LogEvent {
        log_id: v["log_id"].as_str().or(v["_id"].as_str()).unwrap_or_default().to_string(),
        event_type: v["type"].as_str().unwrap_or_default().to_string(),
        date: v["date"].as_str().unwrap_or_default().to_string(),
        description: v["description"].as_str().map(|s| s.to_string()),
        ip: v["ip"].as_str().map(|s| s.to_string()),
        user_id: v["user_id"].as_str().map(|s| s.to_string()),
        user_name: v["user_name"].as_str().map(|s| s.to_string()),
        connection: v["connection"].as_str().map(|s| s.to_string()),
        client_name: v["client_name"].as_str().map(|s| s.to_string()),
    }
}

fn parse_client(v: &Value) -> Auth0Client {
    Auth0Client {
        client_id: v["client_id"].as_str().unwrap_or_default().to_string(),
        name: v["name"].as_str().unwrap_or_default().to_string(),
        app_type: v["app_type"].as_str().map(|s| s.to_string()),
        callbacks: v["callbacks"]
            .as_array()
            .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default(),
        allowed_origins: v["allowed_origins"]
            .as_array()
            .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default(),
    }
}

fn parse_client_detail(v: &Value) -> Auth0ClientDetail {
    Auth0ClientDetail {
        client_id: v["client_id"].as_str().unwrap_or_default().to_string(),
        name: v["name"].as_str().unwrap_or_default().to_string(),
        app_type: v["app_type"].as_str().map(|s| s.to_string()),
        callbacks: v["callbacks"]
            .as_array()
            .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default(),
        allowed_origins: v["allowed_origins"]
            .as_array()
            .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default(),
        allowed_logout_urls: v["allowed_logout_urls"]
            .as_array()
            .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default(),
        grant_types: v["grant_types"]
            .as_array()
            .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default(),
        token_endpoint_auth_method: v["token_endpoint_auth_method"].as_str().map(|s| s.to_string()),
        is_first_party: v["is_first_party"].as_bool(),
    }
}

fn parse_grant(v: &Value) -> Auth0Grant {
    Auth0Grant {
        id: v["id"].as_str().unwrap_or_default().to_string(),
        user_id: v["user_id"].as_str().unwrap_or_default().to_string(),
        client_id: v["clientID"].as_str().unwrap_or_default().to_string(),
        audience: v["audience"].as_str().map(|s| s.to_string()),
        scope: v["scope"]
            .as_array()
            .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default(),
        created_at: v["created_at"].as_str().map(|s| s.to_string()),
    }
}

fn parse_action(v: &Value) -> Auth0Action {
    Auth0Action {
        id: v["id"].as_str().unwrap_or_default().to_string(),
        name: v["name"].as_str().unwrap_or_default().to_string(),
        supported_triggers: v["supported_triggers"].as_array().cloned().unwrap_or_default(),
        status: v["status"].as_str().map(|s| s.to_string()),
        deployed: v.get("deployed").and_then(|d| d.as_bool()),
        updated_at: v["updated_at"].as_str().map(|s| s.to_string()),
    }
}

fn parse_tenant(v: &Value) -> Auth0TenantSettings {
    Auth0TenantSettings {
        friendly_name: v["friendly_name"].as_str().map(|s| s.to_string()),
        support_email: v["support_email"].as_str().map(|s| s.to_string()),
        support_url: v["support_url"].as_str().map(|s| s.to_string()),
        default_directory: v["default_directory"].as_str().map(|s| s.to_string()),
        session_lifetime: v["session_lifetime"].as_f64(),
        idle_session_lifetime: v["idle_session_lifetime"].as_f64(),
        sandbox_version: v["sandbox_version"].as_str().map(|s| s.to_string()),
        flags: v["flags"].clone(),
    }
}

// ─── Tauri Commands ──────────────────────────────────────────────────────────

/// Task 3.2 — Verify credentials + get tenant info
#[tauri::command]
pub async fn auth0_verify_connection(
    domain: String,
    client_id: String,
    client_secret: String,
) -> Result<Auth0VerifyResult, String> {
    let token = match get_mgmt_token(&domain, &client_id, &client_secret).await {
        Ok(t) => t,
        Err(e) => {
            return Ok(Auth0VerifyResult {
                valid: false,
                tenant_name: None,
                region: None,
                environment: None,
                error: Some(e),
            });
        }
    };
    match mgmt_get(&domain, "/tenants/settings", &token).await {
        Ok(v) => Ok(Auth0VerifyResult {
            valid: true,
            tenant_name: v["friendly_name"].as_str().map(|s| s.to_string()),
            region: Some(domain.split('.').last().unwrap_or("us").to_string()),
            environment: v["environment"].as_str().map(|s| s.to_string()),
            error: None,
        }),
        Err(e) => Ok(Auth0VerifyResult {
            valid: false,
            tenant_name: None,
            region: None,
            environment: None,
            error: Some(e),
        }),
    }
}

/// Task 3.3 — List users
#[tauri::command]
pub async fn auth0_list_users(
    domain: String,
    client_id: String,
    client_secret: String,
    page: Option<i64>,
    per_page: Option<i64>,
) -> Result<Auth0ListResult<Auth0User>, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let p = page.unwrap_or(0);
    let pp = per_page.unwrap_or(50);
    let json = mgmt_get(
        &domain,
        &format!("/users?page={}&per_page={}&include_totals=true&sort=created_at:-1", p, pp),
        &token,
    )
    .await?;
    let users: Vec<Auth0User> = json["users"]
        .as_array()
        .map(|arr| arr.iter().map(parse_user).collect())
        .unwrap_or_default();
    let total = json["total"].as_i64().unwrap_or(users.len() as i64);
    Ok(Auth0ListResult { items: users, total })
}

/// Task 3.4 — Get user details
#[tauri::command]
pub async fn auth0_get_user(
    domain: String,
    client_id: String,
    client_secret: String,
    user_id: String,
) -> Result<Auth0UserDetail, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let encoded = urlencoding::encode(&user_id);
    let json = mgmt_get(&domain, &format!("/users/{}", encoded), &token).await?;
    Ok(parse_user_detail(&json))
}

/// Task 3.5 — Search users with Lucene query
#[tauri::command]
pub async fn auth0_search_users(
    domain: String,
    client_id: String,
    client_secret: String,
    query: String,
) -> Result<Auth0ListResult<Auth0User>, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let encoded_q = urlencoding::encode(&query);
    let json = mgmt_get(
        &domain,
        &format!("/users?q={}&search_engine=v3&include_totals=true", encoded_q),
        &token,
    )
    .await?;
    let users: Vec<Auth0User> = json["users"]
        .as_array()
        .map(|arr| arr.iter().map(parse_user).collect())
        .unwrap_or_default();
    let total = json["total"].as_i64().unwrap_or(users.len() as i64);
    Ok(Auth0ListResult { items: users, total })
}

/// Task 3.6 — List connections
#[tauri::command]
pub async fn auth0_list_connections(
    domain: String,
    client_id: String,
    client_secret: String,
) -> Result<Vec<Auth0Connection>, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let json = mgmt_get(&domain, "/connections", &token).await?;
    Ok(json
        .as_array()
        .map(|arr| arr.iter().map(parse_connection).collect())
        .unwrap_or_default())
}

/// Task 3.7 — Block user
#[tauri::command]
pub async fn auth0_block_user(
    domain: String,
    client_id: String,
    client_secret: String,
    user_id: String,
) -> Result<Auth0UserDetail, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let encoded = urlencoding::encode(&user_id);
    let json = mgmt_patch(
        &domain,
        &format!("/users/{}", encoded),
        &token,
        serde_json::json!({ "blocked": true }),
    )
    .await?;
    Ok(parse_user_detail(&json))
}

/// Task 3.7 — Unblock user
#[tauri::command]
pub async fn auth0_unblock_user(
    domain: String,
    client_id: String,
    client_secret: String,
    user_id: String,
) -> Result<Auth0UserDetail, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let encoded = urlencoding::encode(&user_id);
    let json = mgmt_patch(
        &domain,
        &format!("/users/{}", encoded),
        &token,
        serde_json::json!({ "blocked": false }),
    )
    .await?;
    Ok(parse_user_detail(&json))
}

/// Task 3.8 — Delete user
#[tauri::command]
pub async fn auth0_delete_user(
    domain: String,
    client_id: String,
    client_secret: String,
    user_id: String,
) -> Result<(), String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let encoded = urlencoding::encode(&user_id);
    mgmt_delete(&domain, &format!("/users/{}", encoded), &token).await
}

/// Task 3.9 — Update user metadata
#[tauri::command]
pub async fn auth0_update_metadata(
    domain: String,
    client_id: String,
    client_secret: String,
    user_id: String,
    user_metadata: Option<Value>,
    app_metadata: Option<Value>,
) -> Result<Auth0UserDetail, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let encoded = urlencoding::encode(&user_id);
    let mut body = serde_json::Map::new();
    if let Some(um) = user_metadata {
        body.insert("user_metadata".to_string(), um);
    }
    if let Some(am) = app_metadata {
        body.insert("app_metadata".to_string(), am);
    }
    let json = mgmt_patch(
        &domain,
        &format!("/users/{}", encoded),
        &token,
        Value::Object(body),
    )
    .await?;
    Ok(parse_user_detail(&json))
}

/// Task 3.10 — List roles
#[tauri::command]
pub async fn auth0_list_roles(
    domain: String,
    client_id: String,
    client_secret: String,
) -> Result<Vec<Auth0Role>, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let json = mgmt_get(&domain, "/roles?per_page=100&include_totals=false", &token).await?;
    Ok(json
        .as_array()
        .map(|arr| arr.iter().map(parse_role).collect())
        .unwrap_or_default())
}

/// Task 3.11 — Get user roles
#[tauri::command]
pub async fn auth0_get_user_roles(
    domain: String,
    client_id: String,
    client_secret: String,
    user_id: String,
) -> Result<Vec<Auth0Role>, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let encoded = urlencoding::encode(&user_id);
    let json = mgmt_get(&domain, &format!("/users/{}/roles", encoded), &token).await?;
    Ok(json
        .as_array()
        .map(|arr| arr.iter().map(parse_role).collect())
        .unwrap_or_default())
}

/// Task 3.11 — Assign roles to user
#[tauri::command]
pub async fn auth0_assign_roles(
    domain: String,
    client_id: String,
    client_secret: String,
    user_id: String,
    role_ids: Vec<String>,
) -> Result<(), String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let encoded = urlencoding::encode(&user_id);
    mgmt_post(
        &domain,
        &format!("/users/{}/roles", encoded),
        &token,
        serde_json::json!({ "roles": role_ids }),
    )
    .await?;
    Ok(())
}

/// Task 3.11 — Remove roles from user
#[tauri::command]
pub async fn auth0_remove_roles(
    domain: String,
    client_id: String,
    client_secret: String,
    user_id: String,
    role_ids: Vec<String>,
) -> Result<(), String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let encoded = urlencoding::encode(&user_id);
    mgmt_delete_body(
        &domain,
        &format!("/users/{}/roles", encoded),
        &token,
        serde_json::json!({ "roles": role_ids }),
    )
    .await
}

/// Task 3.12 — List organizations
#[tauri::command]
pub async fn auth0_list_organizations(
    domain: String,
    client_id: String,
    client_secret: String,
) -> Result<Auth0ListResult<Auth0Organization>, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let json = mgmt_get(&domain, "/organizations?per_page=100&include_totals=true", &token).await?;
    let orgs: Vec<Auth0Organization> = json["organizations"]
        .as_array()
        .or(json.as_array())
        .map(|arr| arr.iter().map(parse_org).collect())
        .unwrap_or_default();
    let total = json["total"].as_i64().unwrap_or(orgs.len() as i64);
    Ok(Auth0ListResult { items: orgs, total })
}

/// Task 3.13 — List organization members
#[tauri::command]
pub async fn auth0_list_org_members(
    domain: String,
    client_id: String,
    client_secret: String,
    org_id: String,
) -> Result<Vec<Auth0OrgMember>, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let json = mgmt_get(
        &domain,
        &format!("/organizations/{}/members?fields=user_id,email,name,picture,roles", org_id),
        &token,
    )
    .await?;
    Ok(json
        .get("members")
        .or(Some(&json))
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().map(parse_org_member).collect())
        .unwrap_or_default())
}

/// Task 3.14 — List logs
#[tauri::command]
pub async fn auth0_list_logs(
    domain: String,
    client_id: String,
    client_secret: String,
    query: Option<String>,
    page: Option<i64>,
    per_page: Option<i64>,
) -> Result<Auth0ListResult<Auth0LogEvent>, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let p = page.unwrap_or(0);
    let pp = per_page.unwrap_or(50);
    let mut url = format!("/logs?page={}&per_page={}&include_totals=true&sort=date:-1", p, pp);
    if let Some(q) = &query {
        url.push_str(&format!("&q={}", urlencoding::encode(q)));
    }
    let json = mgmt_get(&domain, &url, &token).await?;
    let logs: Vec<Auth0LogEvent> = json["logs"]
        .as_array()
        .or(json.as_array())
        .map(|arr| arr.iter().map(parse_log_event).collect())
        .unwrap_or_default();
    let total = json["total"].as_i64().unwrap_or(logs.len() as i64);
    Ok(Auth0ListResult { items: logs, total })
}

/// Task 3.15 — Get log event detail
#[tauri::command]
pub async fn auth0_get_log(
    domain: String,
    client_id: String,
    client_secret: String,
    log_id: String,
) -> Result<Value, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    mgmt_get(&domain, &format!("/logs/{}", log_id), &token).await
}

/// Task 3.16 — List clients (applications)
#[tauri::command]
pub async fn auth0_list_clients(
    domain: String,
    client_id: String,
    client_secret: String,
) -> Result<Vec<Auth0Client>, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let json = mgmt_get(&domain, "/clients?per_page=100", &token).await?;
    Ok(json
        .as_array()
        .map(|arr| arr.iter().map(parse_client).collect())
        .unwrap_or_default())
}

/// Task 3.17 — Get client detail
#[tauri::command]
pub async fn auth0_get_client(
    domain: String,
    client_id: String,
    client_secret: String,
    target_client_id: String,
) -> Result<Auth0ClientDetail, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let json = mgmt_get(&domain, &format!("/clients/{}", target_client_id), &token).await?;
    Ok(parse_client_detail(&json))
}

/// Task 3.18 — Verify JWT
#[tauri::command]
pub async fn auth0_verify_jwt(
    domain: String,
    token: String,
) -> Result<Auth0JwtResult, String> {
    // Decode header first
    let header = match decode_header(&token) {
        Ok(h) => h,
        Err(e) => {
            // Try to decode payload anyway (without verification)
            let parts: Vec<&str> = token.split('.').collect();
            let (header_val, payload_val) = if parts.len() >= 2 {
                let h = base64_decode_json(parts[0]);
                let p = base64_decode_json(parts[1]);
                (h, p)
            } else {
                (Value::Null, Value::Null)
            };
            return Ok(Auth0JwtResult {
                valid: false,
                header: header_val,
                payload: payload_val,
                signature_verified: false,
                expired: false,
                issued_at: None,
                expires_at: None,
                error: Some(format!("Failed to decode header: {}", e)),
            });
        }
    };

    let parts: Vec<&str> = token.split('.').collect();
    let header_val = if parts.len() >= 2 { base64_decode_json(parts[0]) } else { Value::Null };

    // Fetch JWKS
    let jwks_url = format!(
        "https://{}/.well-known/jwks.json",
        domain.trim_end_matches('/')
    );
    let jwks: Value = Client::new()
        .get(&jwks_url)
        .send()
        .await
        .map_err(|e| format!("JWKS fetch: {}", e))?
        .json()
        .await
        .map_err(|e| format!("JWKS parse: {}", e))?;

    let kid = header.kid.as_deref().unwrap_or_default();
    let keys = jwks["keys"].as_array().ok_or("No keys in JWKS")?;
    let key = keys
        .iter()
        .find(|k| k["kid"].as_str() == Some(kid))
        .ok_or_else(|| format!("No matching key for kid '{}'", kid))?;

    let n = key["n"].as_str().ok_or("Missing 'n' in JWK")?;
    let e = key["e"].as_str().ok_or("Missing 'e' in JWK")?;
    let decoding_key = DecodingKey::from_rsa_components(n, e)
        .map_err(|err| format!("RSA key error: {}", err))?;

    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_exp = true;
    // Auth0 uses the domain as issuer
    let issuer = format!("https://{}/", domain.trim_end_matches('/'));
    validation.set_issuer(&[&issuer]);
    validation.validate_aud = false; // audience varies

    match decode::<Value>(&token, &decoding_key, &validation) {
        Ok(data) => {
            let iat = data.claims.get("iat").and_then(|v| v.as_i64());
            let exp = data.claims.get("exp").and_then(|v| v.as_i64());
            Ok(Auth0JwtResult {
                valid: true,
                header: header_val,
                payload: data.claims,
                signature_verified: true,
                expired: false,
                issued_at: iat,
                expires_at: exp,
                error: None,
            })
        }
        Err(err) => {
            let is_expired = matches!(err.kind(), jsonwebtoken::errors::ErrorKind::ExpiredSignature);
            // Decode without validation for payload display
            let mut no_val = Validation::new(Algorithm::RS256);
            no_val.validate_exp = false;
            no_val.validate_aud = false;
            no_val.insecure_disable_signature_validation();
            let payload = decode::<Value>(&token, &DecodingKey::from_secret(&[]), &no_val)
                .map(|d| d.claims)
                .unwrap_or(Value::Null);
            let iat = payload.get("iat").and_then(|v| v.as_i64());
            let exp = payload.get("exp").and_then(|v| v.as_i64());
            Ok(Auth0JwtResult {
                valid: false,
                header: header_val,
                payload,
                signature_verified: !is_expired,
                expired: is_expired,
                issued_at: iat,
                expires_at: exp,
                error: Some(format!("{}", err)),
            })
        }
    }
}

/// Task 3.19 — JWKS viewer
#[tauri::command]
pub async fn auth0_get_jwks(domain: String) -> Result<Value, String> {
    let url = format!(
        "https://{}/.well-known/jwks.json",
        domain.trim_end_matches('/')
    );
    Client::new()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("JWKS fetch: {}", e))?
        .json::<Value>()
        .await
        .map_err(|e| format!("JWKS parse: {}", e))
}

/// Task 3.20 — Generate test token via client_credentials
#[tauri::command]
pub async fn auth0_get_token(
    domain: String,
    client_id: String,
    client_secret: String,
    audience: String,
    scope: Option<String>,
) -> Result<Auth0TokenResult, String> {
    let url = format!("https://{}/oauth/token", domain.trim_end_matches('/'));
    let mut body = serde_json::json!({
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "audience": audience,
    });
    if let Some(s) = &scope {
        body["scope"] = Value::String(s.clone());
    }
    let res = Client::new()
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Token request failed: {}", e))?;
    let status = res.status();
    let json: Value = res.json().await.map_err(|e| format!("Parse error: {}", e))?;
    if !status.is_success() {
        return Err(format!(
            "Auth0 token error ({}): {}",
            status,
            json.get("error_description")
                .or(json.get("error"))
                .map(|v| v.as_str().unwrap_or("unknown"))
                .unwrap_or("unknown")
        ));
    }
    Ok(Auth0TokenResult {
        access_token: json["access_token"].as_str().unwrap_or_default().to_string(),
        token_type: json["token_type"].as_str().unwrap_or("Bearer").to_string(),
        expires_in: json["expires_in"].as_i64().unwrap_or(86400),
        scope: json["scope"].as_str().map(|s| s.to_string()),
    })
}

/// Task 3.21 — List actions
#[tauri::command]
pub async fn auth0_list_actions(
    domain: String,
    client_id: String,
    client_secret: String,
) -> Result<Vec<Auth0Action>, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let json = mgmt_get(&domain, "/actions/actions?per_page=100", &token).await?;
    Ok(json["actions"]
        .as_array()
        .or(json.as_array())
        .map(|arr| arr.iter().map(parse_action).collect())
        .unwrap_or_default())
}

/// Task 3.22 — List grants
#[tauri::command]
pub async fn auth0_list_grants(
    domain: String,
    client_id: String,
    client_secret: String,
    user_id: Option<String>,
) -> Result<Vec<Auth0Grant>, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let mut url = "/grants?per_page=100".to_string();
    if let Some(uid) = &user_id {
        url.push_str(&format!("&user_id={}", urlencoding::encode(uid)));
    }
    let json = mgmt_get(&domain, &url, &token).await?;
    Ok(json
        .as_array()
        .map(|arr| arr.iter().map(parse_grant).collect())
        .unwrap_or_default())
}

/// Task 3.23 — Revoke grant
#[tauri::command]
pub async fn auth0_revoke_grant(
    domain: String,
    client_id: String,
    client_secret: String,
    grant_id: String,
) -> Result<(), String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    mgmt_delete(&domain, &format!("/grants/{}", grant_id), &token).await
}

/// Task 3.24 — Tenant settings
#[tauri::command]
pub async fn auth0_tenant_settings(
    domain: String,
    client_id: String,
    client_secret: String,
) -> Result<Auth0TenantSettings, String> {
    let token = get_mgmt_token(&domain, &client_id, &client_secret).await?;
    let json = mgmt_get(&domain, "/tenants/settings", &token).await?;
    Ok(parse_tenant(&json))
}

// ─── Base64 helper ───────────────────────────────────────────────────────────

fn base64_decode_json(input: &str) -> Value {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    let bytes = URL_SAFE_NO_PAD.decode(input).unwrap_or_default();
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}
