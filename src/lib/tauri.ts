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
