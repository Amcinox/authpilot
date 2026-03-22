mod clerk;
mod cognito;
mod auth0;

const SERVICE_NAME: &str = "com.opentecc.authpilot";

/// Store a secret securely using the OS keychain
#[tauri::command]
fn store_secret(key: String, value: String) -> Result<String, String> {
    let entry = keyring::Entry::new(SERVICE_NAME, &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())?;
    Ok(format!("Secret '{}' stored securely", key))
}

/// Retrieve a secret from the OS keychain
#[tauri::command]
fn get_secret(key: String) -> Result<String, String> {
    let entry = keyring::Entry::new(SERVICE_NAME, &key).map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}

/// Delete a secret from the OS keychain
#[tauri::command]
fn delete_secret(key: String) -> Result<String, String> {
    let entry = keyring::Entry::new(SERVICE_NAME, &key).map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())?;
    Ok(format!("Secret '{}' deleted", key))
}

/// Check if a secret exists in the OS keychain
#[tauri::command]
fn has_secret(key: String) -> Result<bool, String> {
    let entry = keyring::Entry::new(SERVICE_NAME, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

/// Get app version from Cargo.toml
#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            store_secret,
            get_secret,
            delete_secret,
            has_secret,
            get_app_version,
            // Clerk provider commands
            clerk::clerk_verify_key,
            clerk::clerk_list_organizations,
            clerk::clerk_list_users,
            clerk::clerk_get_user,
            clerk::clerk_find_user_by_email,
            clerk::clerk_get_user_orgs,
            clerk::clerk_list_sessions,
            clerk::clerk_create_session_token,
            clerk::clerk_revoke_session,
            clerk::clerk_ban_user,
            clerk::clerk_unban_user,
            clerk::clerk_update_user_metadata,
            clerk::clerk_get_organization,
            clerk::clerk_create_org_invitation,
            clerk::clerk_list_org_members,
            clerk::clerk_verify_jwt,
            clerk::clerk_list_invitations,
            clerk::clerk_revoke_invitation,
            clerk::clerk_delete_user,
            clerk::clerk_get_svix_url,
            clerk::clerk_get_jwks,
            clerk::clerk_list_allowlist,
            clerk::clerk_add_allowlist,
            clerk::clerk_delete_allowlist,
            clerk::clerk_list_blocklist,
            clerk::clerk_add_blocklist,
            clerk::clerk_delete_blocklist,
            clerk::clerk_get_instance,
            clerk::clerk_sign_in,
            clerk::clerk_sign_in_get_token,
            // Cognito provider commands
            cognito::cognito_validate,
            cognito::cognito_describe_pool,
            cognito::cognito_list_users,
            cognito::cognito_get_user,
            cognito::cognito_disable_user,
            cognito::cognito_enable_user,
            cognito::cognito_reset_password,
            cognito::cognito_confirm_user,
            cognito::cognito_list_groups,
            cognito::cognito_list_user_groups,
            cognito::cognito_add_user_to_group,
            cognito::cognito_remove_user_from_group,
            cognito::cognito_list_pool_clients,
            cognito::cognito_decode_token,
            cognito::cognito_get_jwks,
            cognito::cognito_initiate_auth,
            cognito::cognito_global_signout,
            // Auth0 provider commands
            auth0::auth0_verify_connection,
            auth0::auth0_list_users,
            auth0::auth0_get_user,
            auth0::auth0_search_users,
            auth0::auth0_list_connections,
            auth0::auth0_block_user,
            auth0::auth0_unblock_user,
            auth0::auth0_delete_user,
            auth0::auth0_update_metadata,
            auth0::auth0_list_roles,
            auth0::auth0_get_user_roles,
            auth0::auth0_assign_roles,
            auth0::auth0_remove_roles,
            auth0::auth0_list_organizations,
            auth0::auth0_list_org_members,
            auth0::auth0_list_logs,
            auth0::auth0_get_log,
            auth0::auth0_list_clients,
            auth0::auth0_get_client,
            auth0::auth0_verify_jwt,
            auth0::auth0_get_jwks,
            auth0::auth0_get_token,
            auth0::auth0_list_actions,
            auth0::auth0_list_grants,
            auth0::auth0_revoke_grant,
            auth0::auth0_tenant_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
