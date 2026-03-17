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

export interface ClerkEmailVerification {
  status: string | null;
  strategy: string | null;
}

export interface ClerkLinkedIdentity {
  id: string | null;
  identity_type: string | null;
}

export interface ClerkEmailAddress {
  id: string | null;
  email_address: string;
  verification: ClerkEmailVerification | null;
  linked_to: ClerkLinkedIdentity[] | null;
}

export interface ClerkUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: ClerkEmailAddress[];
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
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string | null;
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
  public_metadata: Record<string, unknown> | null;
  private_metadata: Record<string, unknown> | null;
  unsafe_metadata: Record<string, unknown> | null;
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

export interface ClerkOrgMemberPublicUserData {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  identifier: string | null;
  image_url: string | null;
  has_image: boolean | null;
}

export interface ClerkOrgMember {
  id: string;
  role: string;
  created_at: number | null;
  updated_at: number | null;
  public_user_data: ClerkOrgMemberPublicUserData | null;
}

export interface ClerkJwtResult {
  valid: boolean;
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature_verified: boolean;
  expired: boolean;
  error: string | null;
  expires_at: number | null;
  issued_at: number | null;
}

export interface ClerkInvitation {
  id: string;
  email_address: string;
  status: string;
  created_at: number | null;
  updated_at: number | null;
  revoked: boolean | null;
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
  expiresInSeconds?: number,
): Promise<ClerkSessionToken> {
  return invoke<ClerkSessionToken>("clerk_create_session_token", { secretKey, sessionId, expiresInSeconds });
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

export async function clerkBanUser(
  secretKey: string,
  userId: string,
): Promise<ClerkUserDetail> {
  return invoke<ClerkUserDetail>("clerk_ban_user", { secretKey, userId });
}

export async function clerkUnbanUser(
  secretKey: string,
  userId: string,
): Promise<ClerkUserDetail> {
  return invoke<ClerkUserDetail>("clerk_unban_user", { secretKey, userId });
}

export async function clerkUpdateUserMetadata(
  secretKey: string,
  userId: string,
  publicMetadata?: Record<string, unknown>,
  privateMetadata?: Record<string, unknown>,
  unsafeMetadata?: Record<string, unknown>,
): Promise<ClerkUserDetail> {
  return invoke<ClerkUserDetail>("clerk_update_user_metadata", {
    secretKey,
    userId,
    publicMetadata,
    privateMetadata,
    unsafeMetadata,
  });
}

/**
 * Get organization details
 */
export async function clerkGetOrganization(
  secretKey: string,
  organizationId: string,
): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("clerk_get_organization", { secretKey, organizationId });
}

/**
 * Create an organization invitation
 */
export async function clerkCreateOrgInvitation(
  secretKey: string,
  organizationId: string,
  emailAddress: string,
  role: string,
  inviterUserId?: string,
): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("clerk_create_org_invitation", {
    secretKey,
    organizationId,
    emailAddress,
    role,
    inviterUserId,
  });
}

/**
 * List members of an organization
 */
export async function clerkListOrgMembers(
  secretKey: string,
  organizationId: string,
  limit?: number,
): Promise<ClerkListResult<ClerkOrgMember>> {
  return invoke<ClerkListResult<ClerkOrgMember>>("clerk_list_org_members", { secretKey, organizationId, limit });
}

/**
 * Verify and decode a JWT token. Optionally verify against JWKS.
 */
export async function clerkVerifyJwt(
  token: string,
  jwksUrl?: string,
): Promise<ClerkJwtResult> {
  return invoke<ClerkJwtResult>("clerk_verify_jwt", { token, jwksUrl });
}

/**
 * List invitations
 */
export async function clerkListInvitations(
  secretKey: string,
  status?: string,
  limit?: number,
): Promise<ClerkListResult<ClerkInvitation>> {
  return invoke<ClerkListResult<ClerkInvitation>>("clerk_list_invitations", { secretKey, status, limit });
}

/**
 * Revoke an invitation
 */
export async function clerkRevokeInvitation(
  secretKey: string,
  invitationId: string,
): Promise<ClerkInvitation> {
  return invoke<ClerkInvitation>("clerk_revoke_invitation", { secretKey, invitationId });
}

/**
 * Delete a user permanently
 */
export async function clerkDeleteUser(
  secretKey: string,
  userId: string,
): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("clerk_delete_user", { secretKey, userId });
}

/**
 * Get the SVIX dashboard URL for managing webhooks
 */
export async function clerkGetSvixUrl(
  secretKey: string,
): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("clerk_get_svix_url", { secretKey });
}

/**
 * Fetch JWKS (JSON Web Key Set) from the frontend API
 */
export async function clerkGetJwks(
  publishableKey: string,
): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("clerk_get_jwks", { publishableKey });
}

// ─── Allowlist / Blocklist ────────────────────────────────────────────────────

export interface ClerkAllowBlockIdentifier {
  id: string | null;
  identifier: string | null;
  identifier_type: string | null;
  created_at: number | null;
  updated_at: number | null;
}

// ─── Instance Settings ───────────────────────────────────────────────────────

export async function clerkGetInstance(
  secretKey: string,
): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("clerk_get_instance", { secretKey });
}

export async function clerkListAllowlist(
  secretKey: string,
): Promise<ClerkAllowBlockIdentifier[]> {
  return invoke<ClerkAllowBlockIdentifier[]>("clerk_list_allowlist", { secretKey });
}

export async function clerkAddAllowlist(
  secretKey: string,
  identifier: string,
  notify?: boolean,
): Promise<ClerkAllowBlockIdentifier> {
  return invoke<ClerkAllowBlockIdentifier>("clerk_add_allowlist", { secretKey, identifier, notify });
}

export async function clerkDeleteAllowlist(
  secretKey: string,
  identifierId: string,
): Promise<unknown> {
  return invoke("clerk_delete_allowlist", { secretKey, identifierId });
}

export async function clerkListBlocklist(
  secretKey: string,
): Promise<ClerkAllowBlockIdentifier[]> {
  return invoke<ClerkAllowBlockIdentifier[]>("clerk_list_blocklist", { secretKey });
}

export async function clerkAddBlocklist(
  secretKey: string,
  identifier: string,
): Promise<ClerkAllowBlockIdentifier> {
  return invoke<ClerkAllowBlockIdentifier>("clerk_add_blocklist", { secretKey, identifier });
}

export async function clerkDeleteBlocklist(
  secretKey: string,
  identifierId: string,
): Promise<unknown> {
  return invoke("clerk_delete_blocklist", { secretKey, identifierId });
}

// ─── Cognito Provider Commands ───────────────────────────────────────────────

export interface CognitoValidateResult {
  valid: boolean;
  region: string;
  user_pool_id: string;
  key_count: number;
  error: string | null;
}

export interface CognitoAttribute {
  name: string;
  value: string;
}

export interface CognitoUser {
  username: string;
  email: string | null;
  name: string | null;
  enabled: boolean;
  status: string;
  create_date: number;
  modified_date: number;
  attributes: CognitoAttribute[];
}

export interface CognitoUserDetail {
  username: string;
  email: string | null;
  name: string | null;
  enabled: boolean;
  status: string;
  create_date: number;
  modified_date: number;
  attributes: CognitoAttribute[];
  mfa_options: unknown[];
  preferred_mfa: string | null;
  mfa_settings: string[];
}

export interface CognitoGroup {
  group_name: string;
  user_pool_id: string;
  description: string | null;
  role_arn: string | null;
  precedence: number | null;
  creation_date: number;
  modified_date: number;
}

export interface CognitoPoolClient {
  client_id: string;
  client_name: string;
  user_pool_id: string;
}

export interface CognitoPoolStats {
  id: string;
  name: string;
  estimated_number_of_users: number;
  creation_date: number;
  last_modified_date: number;
  mfa_configuration: string;
  deletion_protection: string;
  auto_verified_attributes: string[];
  username_attributes: string[];
  policies: unknown;
}

export interface CognitoAuthResult {
  authenticated: boolean;
  access_token: string | null;
  id_token: string | null;
  refresh_token: string | null;
  expires_in: number | null;
  token_type: string | null;
  challenge_name: string | null;
  challenge_parameters: unknown | null;
}

export interface CognitoJwtResult {
  valid: boolean;
  header: unknown;
  payload: Record<string, unknown>;
  signature_verified: boolean;
  expired: boolean;
  error: string | null;
  expires_at: number | null;
  issued_at: number | null;
}

export interface CognitoListUsersResult {
  users: CognitoUser[];
  pagination_token: string | null;
}

export interface CognitoListGroupsResult {
  groups: CognitoGroup[];
  next_token: string | null;
}

export interface CognitoListClientsResult {
  clients: CognitoPoolClient[];
  next_token: string | null;
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
 * Describe User Pool (pool statistics, validates IAM creds)
 */
export async function cognitoDescribePool(
  accessKeyId: string,
  secretAccessKey: string,
  userPoolId: string,
  region: string,
): Promise<CognitoPoolStats> {
  return invoke<CognitoPoolStats>("cognito_describe_pool", {
    accessKeyId, secretAccessKey, userPoolId, region,
  });
}

/**
 * List users in the User Pool
 */
export async function cognitoListUsers(
  accessKeyId: string,
  secretAccessKey: string,
  userPoolId: string,
  region: string,
  paginationToken?: string | null,
  filter?: string | null,
): Promise<CognitoListUsersResult> {
  return invoke<CognitoListUsersResult>("cognito_list_users", {
    accessKeyId, secretAccessKey, userPoolId, region, paginationToken, filter,
  });
}

/**
 * Get user detail by username
 */
export async function cognitoGetUser(
  accessKeyId: string,
  secretAccessKey: string,
  userPoolId: string,
  region: string,
  username: string,
): Promise<CognitoUserDetail> {
  return invoke<CognitoUserDetail>("cognito_get_user", {
    accessKeyId, secretAccessKey, userPoolId, region, username,
  });
}

/**
 * Disable a user
 */
export async function cognitoDisableUser(
  accessKeyId: string,
  secretAccessKey: string,
  userPoolId: string,
  region: string,
  username: string,
): Promise<CognitoUserDetail> {
  return invoke<CognitoUserDetail>("cognito_disable_user", {
    accessKeyId, secretAccessKey, userPoolId, region, username,
  });
}

/**
 * Enable a user
 */
export async function cognitoEnableUser(
  accessKeyId: string,
  secretAccessKey: string,
  userPoolId: string,
  region: string,
  username: string,
): Promise<CognitoUserDetail> {
  return invoke<CognitoUserDetail>("cognito_enable_user", {
    accessKeyId, secretAccessKey, userPoolId, region, username,
  });
}

/**
 * Reset a user's password (forces new password on next login)
 */
export async function cognitoResetPassword(
  accessKeyId: string,
  secretAccessKey: string,
  userPoolId: string,
  region: string,
  username: string,
): Promise<CognitoUserDetail> {
  return invoke<CognitoUserDetail>("cognito_reset_password", {
    accessKeyId, secretAccessKey, userPoolId, region, username,
  });
}

/**
 * Confirm a pending user signup
 */
export async function cognitoConfirmUser(
  accessKeyId: string,
  secretAccessKey: string,
  userPoolId: string,
  region: string,
  username: string,
): Promise<CognitoUserDetail> {
  return invoke<CognitoUserDetail>("cognito_confirm_user", {
    accessKeyId, secretAccessKey, userPoolId, region, username,
  });
}

/**
 * List groups in the User Pool
 */
export async function cognitoListGroups(
  accessKeyId: string,
  secretAccessKey: string,
  userPoolId: string,
  region: string,
  nextToken?: string | null,
): Promise<CognitoListGroupsResult> {
  return invoke<CognitoListGroupsResult>("cognito_list_groups", {
    accessKeyId, secretAccessKey, userPoolId, region, nextToken,
  });
}

/**
 * List groups for a specific user
 */
export async function cognitoListUserGroups(
  accessKeyId: string,
  secretAccessKey: string,
  userPoolId: string,
  region: string,
  username: string,
): Promise<CognitoListGroupsResult> {
  return invoke<CognitoListGroupsResult>("cognito_list_user_groups", {
    accessKeyId, secretAccessKey, userPoolId, region, username,
  });
}

/**
 * Add a user to a group
 */
export async function cognitoAddUserToGroup(
  accessKeyId: string,
  secretAccessKey: string,
  userPoolId: string,
  region: string,
  username: string,
  groupName: string,
): Promise<void> {
  return invoke("cognito_add_user_to_group", {
    accessKeyId, secretAccessKey, userPoolId, region, username, groupName,
  });
}

/**
 * Remove a user from a group
 */
export async function cognitoRemoveUserFromGroup(
  accessKeyId: string,
  secretAccessKey: string,
  userPoolId: string,
  region: string,
  username: string,
  groupName: string,
): Promise<void> {
  return invoke("cognito_remove_user_from_group", {
    accessKeyId, secretAccessKey, userPoolId, region, username, groupName,
  });
}

/**
 * List User Pool app clients
 */
export async function cognitoListPoolClients(
  accessKeyId: string,
  secretAccessKey: string,
  userPoolId: string,
  region: string,
  nextToken?: string | null,
): Promise<CognitoListClientsResult> {
  return invoke<CognitoListClientsResult>("cognito_list_pool_clients", {
    accessKeyId, secretAccessKey, userPoolId, region, nextToken,
  });
}

/**
 * Decode and verify a Cognito JWT against pool JWKS
 */
export async function cognitoDecodeToken(
  token: string,
  userPoolId: string,
  region: string,
): Promise<CognitoJwtResult> {
  return invoke<CognitoJwtResult>("cognito_decode_token", { token, userPoolId, region });
}

/**
 * Fetch pool JWKS
 */
export async function cognitoGetJwks(
  userPoolId: string,
  region: string,
): Promise<unknown> {
  return invoke("cognito_get_jwks", { userPoolId, region });
}

/**
 * Initiate USER_PASSWORD_AUTH flow
 */
export async function cognitoInitiateAuth(
  clientId: string,
  clientSecret: string | null,
  region: string,
  username: string,
  password: string,
): Promise<CognitoAuthResult> {
  return invoke<CognitoAuthResult>("cognito_initiate_auth", {
    clientId, clientSecret, region, username, password,
  });
}

/**
 * Global sign out (invalidate all sessions for a user)
 */
export async function cognitoGlobalSignout(
  accessKeyId: string,
  secretAccessKey: string,
  userPoolId: string,
  region: string,
  username: string,
): Promise<CognitoUserDetail> {
  return invoke<CognitoUserDetail>("cognito_global_signout", {
    accessKeyId, secretAccessKey, userPoolId, region, username,
  });
}

// ─── Auth0 Provider Commands ─────────────────────────────────────────────────

export interface Auth0VerifyResult {
  valid: boolean;
  tenant_name: string | null;
  region: string | null;
  environment: string | null;
  error: string | null;
}

export interface Auth0User {
  user_id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  connection: string | null;
  last_login: string | null;
  logins_count: number | null;
  blocked: boolean | null;
  created_at: string | null;
}

export interface Auth0UserDetail {
  user_id: string;
  email: string | null;
  email_verified: boolean | null;
  name: string | null;
  nickname: string | null;
  picture: string | null;
  last_login: string | null;
  last_ip: string | null;
  logins_count: number | null;
  blocked: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  identities: Record<string, unknown>[];
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
}

export interface Auth0Connection {
  id: string;
  name: string;
  strategy: string;
  enabled_clients: string[];
}

export interface Auth0Role {
  id: string;
  name: string;
  description: string | null;
}

export interface Auth0Organization {
  id: string;
  name: string;
  display_name: string | null;
  branding: Record<string, unknown> | null;
}

export interface Auth0OrgMember {
  user_id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  roles: Auth0Role[];
}

export interface Auth0LogEvent {
  log_id: string;
  event_type: string;
  date: string;
  description: string | null;
  ip: string | null;
  user_id: string | null;
  user_name: string | null;
  connection: string | null;
  client_name: string | null;
}

export interface Auth0Client {
  client_id: string;
  name: string;
  app_type: string | null;
  callbacks: string[];
  allowed_origins: string[];
}

export interface Auth0ClientDetail {
  client_id: string;
  name: string;
  app_type: string | null;
  callbacks: string[];
  allowed_origins: string[];
  allowed_logout_urls: string[];
  grant_types: string[];
  token_endpoint_auth_method: string | null;
  is_first_party: boolean | null;
}

export interface Auth0JwtResult {
  valid: boolean;
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature_verified: boolean;
  expired: boolean;
  issued_at: number | null;
  expires_at: number | null;
  error: string | null;
}

export interface Auth0TokenResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string | null;
}

export interface Auth0Grant {
  id: string;
  user_id: string;
  client_id: string;
  audience: string | null;
  scope: string[];
  created_at: string | null;
}

export interface Auth0Action {
  id: string;
  name: string;
  supported_triggers: Record<string, unknown>[];
  status: string | null;
  deployed: boolean | null;
  updated_at: string | null;
}

export interface Auth0ListResult<T> {
  items: T[];
  total: number;
}

export interface Auth0TenantSettings {
  friendly_name: string | null;
  support_email: string | null;
  support_url: string | null;
  default_directory: string | null;
  session_lifetime: number | null;
  idle_session_lifetime: number | null;
  sandbox_version: string | null;
  flags: Record<string, unknown>;
}

/** Task 3.2 — Verify connection */
export async function auth0VerifyConnection(
  domain: string, clientId: string, clientSecret: string,
): Promise<Auth0VerifyResult> {
  return invoke<Auth0VerifyResult>("auth0_verify_connection", { domain, clientId, clientSecret });
}

/** Task 3.3 — List users */
export async function auth0ListUsers(
  domain: string, clientId: string, clientSecret: string, page?: number, perPage?: number,
): Promise<Auth0ListResult<Auth0User>> {
  return invoke<Auth0ListResult<Auth0User>>("auth0_list_users", { domain, clientId, clientSecret, page, perPage });
}

/** Task 3.4 — Get user details */
export async function auth0GetUser(
  domain: string, clientId: string, clientSecret: string, userId: string,
): Promise<Auth0UserDetail> {
  return invoke<Auth0UserDetail>("auth0_get_user", { domain, clientId, clientSecret, userId });
}

/** Task 3.5 — Search users */
export async function auth0SearchUsers(
  domain: string, clientId: string, clientSecret: string, query: string,
): Promise<Auth0ListResult<Auth0User>> {
  return invoke<Auth0ListResult<Auth0User>>("auth0_search_users", { domain, clientId, clientSecret, query });
}

/** Task 3.6 — List connections */
export async function auth0ListConnections(
  domain: string, clientId: string, clientSecret: string,
): Promise<Auth0Connection[]> {
  return invoke<Auth0Connection[]>("auth0_list_connections", { domain, clientId, clientSecret });
}

/** Task 3.7 — Block user */
export async function auth0BlockUser(
  domain: string, clientId: string, clientSecret: string, userId: string,
): Promise<Auth0UserDetail> {
  return invoke<Auth0UserDetail>("auth0_block_user", { domain, clientId, clientSecret, userId });
}

/** Task 3.7 — Unblock user */
export async function auth0UnblockUser(
  domain: string, clientId: string, clientSecret: string, userId: string,
): Promise<Auth0UserDetail> {
  return invoke<Auth0UserDetail>("auth0_unblock_user", { domain, clientId, clientSecret, userId });
}

/** Task 3.8 — Delete user */
export async function auth0DeleteUser(
  domain: string, clientId: string, clientSecret: string, userId: string,
): Promise<void> {
  return invoke<void>("auth0_delete_user", { domain, clientId, clientSecret, userId });
}

/** Task 3.9 — Update metadata */
export async function auth0UpdateMetadata(
  domain: string, clientId: string, clientSecret: string, userId: string,
  userMetadata?: Record<string, unknown>, appMetadata?: Record<string, unknown>,
): Promise<Auth0UserDetail> {
  return invoke<Auth0UserDetail>("auth0_update_metadata", {
    domain, clientId, clientSecret, userId, userMetadata: userMetadata ?? null, appMetadata: appMetadata ?? null,
  });
}

/** Task 3.10 — List roles */
export async function auth0ListRoles(
  domain: string, clientId: string, clientSecret: string,
): Promise<Auth0Role[]> {
  return invoke<Auth0Role[]>("auth0_list_roles", { domain, clientId, clientSecret });
}

/** Task 3.11 — Get user roles */
export async function auth0GetUserRoles(
  domain: string, clientId: string, clientSecret: string, userId: string,
): Promise<Auth0Role[]> {
  return invoke<Auth0Role[]>("auth0_get_user_roles", { domain, clientId, clientSecret, userId });
}

/** Task 3.11 — Assign roles */
export async function auth0AssignRoles(
  domain: string, clientId: string, clientSecret: string, userId: string, roleIds: string[],
): Promise<void> {
  return invoke<void>("auth0_assign_roles", { domain, clientId, clientSecret, userId, roleIds });
}

/** Task 3.11 — Remove roles */
export async function auth0RemoveRoles(
  domain: string, clientId: string, clientSecret: string, userId: string, roleIds: string[],
): Promise<void> {
  return invoke<void>("auth0_remove_roles", { domain, clientId, clientSecret, userId, roleIds });
}

/** Task 3.12 — List organizations */
export async function auth0ListOrganizations(
  domain: string, clientId: string, clientSecret: string,
): Promise<Auth0ListResult<Auth0Organization>> {
  return invoke<Auth0ListResult<Auth0Organization>>("auth0_list_organizations", { domain, clientId, clientSecret });
}

/** Task 3.13 — List org members */
export async function auth0ListOrgMembers(
  domain: string, clientId: string, clientSecret: string, orgId: string,
): Promise<Auth0OrgMember[]> {
  return invoke<Auth0OrgMember[]>("auth0_list_org_members", { domain, clientId, clientSecret, orgId });
}

/** Task 3.14 — List logs */
export async function auth0ListLogs(
  domain: string, clientId: string, clientSecret: string, query?: string, page?: number, perPage?: number,
): Promise<Auth0ListResult<Auth0LogEvent>> {
  return invoke<Auth0ListResult<Auth0LogEvent>>("auth0_list_logs", {
    domain, clientId, clientSecret, query: query ?? null, page, perPage,
  });
}

/** Task 3.15 — Get log detail */
export async function auth0GetLog(
  domain: string, clientId: string, clientSecret: string, logId: string,
): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("auth0_get_log", { domain, clientId, clientSecret, logId });
}

/** Task 3.16 — List clients */
export async function auth0ListClients(
  domain: string, clientId: string, clientSecret: string,
): Promise<Auth0Client[]> {
  return invoke<Auth0Client[]>("auth0_list_clients", { domain, clientId, clientSecret });
}

/** Task 3.17 — Get client detail */
export async function auth0GetClient(
  domain: string, clientId: string, clientSecret: string, targetClientId: string,
): Promise<Auth0ClientDetail> {
  return invoke<Auth0ClientDetail>("auth0_get_client", { domain, clientId, clientSecret, targetClientId });
}

/** Task 3.18 — Verify JWT */
export async function auth0VerifyJwt(
  domain: string, token: string,
): Promise<Auth0JwtResult> {
  return invoke<Auth0JwtResult>("auth0_verify_jwt", { domain, token });
}

/** Task 3.19 — Get JWKS */
export async function auth0GetJwks(domain: string): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("auth0_get_jwks", { domain });
}

/** Task 3.20 — Generate test token */
export async function auth0GetToken(
  domain: string, clientId: string, clientSecret: string, audience: string, scope?: string,
): Promise<Auth0TokenResult> {
  return invoke<Auth0TokenResult>("auth0_get_token", {
    domain, clientId, clientSecret, audience, scope: scope ?? null,
  });
}

/** Task 3.21 — List actions */
export async function auth0ListActions(
  domain: string, clientId: string, clientSecret: string,
): Promise<Auth0Action[]> {
  return invoke<Auth0Action[]>("auth0_list_actions", { domain, clientId, clientSecret });
}

/** Task 3.22 — List grants */
export async function auth0ListGrants(
  domain: string, clientId: string, clientSecret: string, userId?: string,
): Promise<Auth0Grant[]> {
  return invoke<Auth0Grant[]>("auth0_list_grants", { domain, clientId, clientSecret, userId: userId ?? null });
}

/** Task 3.23 — Revoke grant */
export async function auth0RevokeGrant(
  domain: string, clientId: string, clientSecret: string, grantId: string,
): Promise<void> {
  return invoke<void>("auth0_revoke_grant", { domain, clientId, clientSecret, grantId });
}

/** Task 3.24 — Tenant settings */
export async function auth0TenantSettings(
  domain: string, clientId: string, clientSecret: string,
): Promise<Auth0TenantSettings> {
  return invoke<Auth0TenantSettings>("auth0_tenant_settings", { domain, clientId, clientSecret });
}
