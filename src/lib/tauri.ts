import { invoke } from "@tauri-apps/api/core";

// ─── Keychain Operations ─────────────────────────────────────────────────────

/**
 * Store a secret securely in the OS keychain via Tauri
 */
export async function storeSecret(key: string, value: string): Promise<string> {
  return invoke<string>("store_secret", { key, value });
}

/**
 * Retrieve a secret from the OS keychain via Tauri
 */
export async function getSecret(key: string): Promise<string> {
  return invoke<string>("get_secret", { key });
}

/**
 * Delete a secret from the OS keychain via Tauri
 */
export async function deleteSecret(key: string): Promise<string> {
  return invoke<string>("delete_secret", { key });
}

/**
 * Check if a secret exists in the OS keychain via Tauri
 */
export async function hasSecret(key: string): Promise<boolean> {
  return invoke<boolean>("has_secret", { key });
}

/**
 * Get the app version from the Rust backend
 */
export async function getAppVersion(): Promise<string> {
  return invoke<string>("get_app_version");
}

// ─── Clerk Provider Commands ─────────────────────────────────────────────────

export interface ClerkVerifyResult {
  valid: boolean;
  instance_type: string | null;
  user_count: number | null;
  error: string | null;
}

export interface ClerkOrg {
  id: string;
  name: string;
  slug: string | null;
  members_count: number | null;
  created_at: number | null;
}

export interface ClerkUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: { email_address: string }[];
  created_at: number | null;
  last_sign_in_at: number | null;
}

export interface ClerkListResult<T> {
  data: T[];
  total_count: number;
}

/**
 * Verify a Clerk secret key by calling the Clerk API
 */
export async function clerkVerifyKey(secretKey: string): Promise<ClerkVerifyResult> {
  return invoke<ClerkVerifyResult>("clerk_verify_key", { secretKey });
}

/**
 * List organizations from Clerk
 */
export async function clerkListOrganizations(
  secretKey: string,
  limit?: number,
): Promise<ClerkListResult<ClerkOrg>> {
  return invoke<ClerkListResult<ClerkOrg>>("clerk_list_organizations", { secretKey, limit });
}

/**
 * List users from Clerk
 */
export async function clerkListUsers(
  secretKey: string,
  limit?: number,
): Promise<ClerkListResult<ClerkUser>> {
  return invoke<ClerkListResult<ClerkUser>>("clerk_list_users", { secretKey, limit });
}

// ─── Clerk Extended Types ────────────────────────────────────────────────────

export interface ClerkPhoneNumber {
  phone_number: string;
}

export interface ClerkUserDetail {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: { email_address: string }[];
  phone_numbers: ClerkPhoneNumber[];
  username: string | null;
  image_url: string | null;
  has_image: boolean | null;
  created_at: number | null;
  updated_at: number | null;
  last_sign_in_at: number | null;
  last_active_at: number | null;
  banned: boolean | null;
  locked: boolean | null;
}

export interface ClerkSession {
  id: string;
  user_id: string;
  status: string;
  last_active_at: number | null;
  expire_at: number | null;
  created_at: number | null;
}

export interface ClerkSessionToken {
  jwt: string;
}

export interface ClerkUserOrgMembership {
  id: string;
  role: string;
  organization: ClerkOrg;
  created_at: number | null;
}

// ─── Clerk Extended Commands ─────────────────────────────────────────────────

/**
 * Get a single user by ID from Clerk
 */
export async function clerkGetUser(
  secretKey: string,
  userId: string,
): Promise<ClerkUserDetail> {
  return invoke<ClerkUserDetail>("clerk_get_user", { secretKey, userId });
}

/**
 * Search users by email address
 */
export async function clerkFindUserByEmail(
  secretKey: string,
  email: string,
): Promise<ClerkListResult<ClerkUser>> {
  return invoke<ClerkListResult<ClerkUser>>("clerk_find_user_by_email", { secretKey, email });
}

/**
 * Get a user's organization memberships
 */
export async function clerkGetUserOrgs(
  secretKey: string,
  userId: string,
  limit?: number,
): Promise<ClerkListResult<ClerkUserOrgMembership>> {
  return invoke<ClerkListResult<ClerkUserOrgMembership>>("clerk_get_user_orgs", { secretKey, userId, limit });
}

/**
 * List sessions (optionally filtered by user)
 */
export async function clerkListSessions(
  secretKey: string,
  userId?: string,
  status?: string,
  limit?: number,
): Promise<ClerkListResult<ClerkSession>> {
  return invoke<ClerkListResult<ClerkSession>>("clerk_list_sessions", { secretKey, userId, status, limit });
}

/**
 * Create a session token (JWT) for a session, optionally scoped to an org with custom expiry
 */
export async function clerkCreateSessionToken(
  secretKey: string,
  sessionId: string,
  organizationId?: string,
  expiresInSeconds?: number,
): Promise<ClerkSessionToken> {
  return invoke<ClerkSessionToken>("clerk_create_session_token", { secretKey, sessionId, organizationId, expiresInSeconds });
}

/**
 * Revoke a session
 */
export async function clerkRevokeSession(
  secretKey: string,
  sessionId: string,
): Promise<ClerkSession> {
  return invoke<ClerkSession>("clerk_revoke_session", { secretKey, sessionId });
}

// ─── Cognito Provider Commands ───────────────────────────────────────────────

export interface CognitoValidateResult {
  valid: boolean;
  region: string;
  user_pool_id: string;
  error: string | null;
}

export interface CognitoTokenResult {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Validate Cognito configuration (checks JWKS endpoint)
 */
export async function cognitoValidate(
  userPoolId: string,
  region: string,
): Promise<CognitoValidateResult> {
  return invoke<CognitoValidateResult>("cognito_validate", { userPoolId, region });
}

/**
 * Get an access token from Cognito
 */
export async function cognitoGetToken(
  clientId: string,
  clientSecret: string,
  region: string,
): Promise<CognitoTokenResult> {
  return invoke<CognitoTokenResult>("cognito_get_token", { clientId, clientSecret, region });
}
