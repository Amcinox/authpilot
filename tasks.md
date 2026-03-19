# AuthPilot — Implementation Tasks

> Each task is a self-contained unit of work. Review and confirm before moving to the next.
> Status: ⬜ Not Started · 🔄 In Progress · ✅ Done · ⏭️ Skipped

---

## Epic 1: Clerk — New Tools

**User Story:** _As a developer, I want additional Clerk management tools so I can fully manage users, organizations, invitations, and security from AuthPilot without opening the Clerk dashboard._

### Task 1.1 — Ban / Unban User

✅ **Scope:** Add `clerk_ban_user` and `clerk_unban_user` commands in Rust, TypeScript wrappers, tool definition in `providers.ts`, and result UI in `provider-tools.tsx`.

- **Backend:** `POST /users/{id}/ban` and `POST /users/{id}/unban`
- **UI:** Confirmation dialog before ban, success/error toast
- **Files:** `clerk.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 1.2 — Update User Metadata

✅ **Scope:** Add `clerk_update_user_metadata` command that accepts `public_metadata`, `private_metadata`, and `unsafe_metadata` as JSON objects.

- **Backend:** `PATCH /users/{id}/metadata`
- **UI:** JSON editor (textarea) pre-filled with current metadata, save button
- **Input:** User ID (from user list), JSON fields
- **Files:** `clerk.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 1.3 — List Organization Members

✅ **Scope:** Add `clerk_list_org_members` command to fetch memberships for a given organization.

- **Backend:** `GET /organizations/{id}/memberships`
- **UI:** Table with user name, email, role, joined date. Clickable org from org list triggers this.
- **Files:** `clerk.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 1.4 — Verify JWT (Local Decode)

✅ **Scope:** Add `clerk_verify_jwt` that decodes a Clerk-issued JWT locally, verifies signature against the instance's JWKS, and displays all claims.

- **Backend:** Fetch JWKS from `https://{frontend_api}/.well-known/jwks.json`, verify RS256 signature, decode payload
- **Rust deps:** Add `jsonwebtoken` crate
- **UI:** Paste JWT → decoded header, payload (formatted JSON), signature status (✅ valid / ❌ invalid), expiry countdown
- **Files:** `clerk.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`, `Cargo.toml`

---

### Task 1.5 — List Invitations

✅ **Scope:** Add `clerk_list_invitations` command to view pending instance invitations.

- **Backend:** `GET /invitations`
- **UI:** Table with email, status, created date, expiry
- **Files:** `clerk.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 1.6 — Revoke Invitation

✅ **Scope:** Add `clerk_revoke_invitation` command.

- **Backend:** `POST /invitations/{id}/revoke`
- **UI:** Revoke button per invitation row (from Task 1.5), confirmation dialog
- **Files:** `clerk.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 1.7 — Delete User

✅ **Scope:** Add `clerk_delete_user` command with safety confirmation.

- **Backend:** `DELETE /users/{id}`
- **UI:** Destructive action — requires typing user email to confirm, red button styling
- **Files:** `clerk.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 1.8 — Get Organization Details

✅ **Scope:** Add `clerk_get_organization` command to fetch full org info.

- **Backend:** `GET /organizations/{id}`
- **UI:** Detail view with name, slug, logo, metadata, member count, created/updated dates
- **Files:** `clerk.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 1.9 — Create Organization Invitation

✅ **Scope:** Add `clerk_create_org_invitation` to invite users to an org.

- **Backend:** `POST /organizations/{id}/invitations`
- **Input:** Org ID, email address, role (admin/member)
- **UI:** Invite form accessible from org detail view
- **Files:** `clerk.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 1.10 — List Webhooks

✅ **Scope:** Add `clerk_get_svix_url` to open SVIX webhook dashboard.

- **Backend:** `GET /webhooks` (Clerk Webhooks API, if available via SVIX)
- **UI:** Table with URL, events subscribed, status, last delivery
- **Files:** `clerk.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 1.11 — JWKS Viewer

✅ **Scope:** Add `clerk_get_jwks` to fetch and display the instance's public keys.

- **Backend:** `GET /.well-known/jwks.json` via frontend API URL
- **UI:** Formatted JSON display of each key (kid, kty, alg, n, e), copy button per key
- **Files:** `clerk.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 1.12 — List Email Addresses

✅ **Scope:** Add `clerk_list_user_emails` to view all email addresses for a user (primary, verified, unverified).

- **Backend:** Extract from `GET /users/{id}` → `email_addresses` array
- **UI:** List with primary badge, verification status, linked identities
- **Files:** `clerk.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 1.13 — Allowlist / Blocklist

✅ **Scope:** Add commands to view and manage email/domain allow/block lists.

- **Backend:** `GET /allowlist_identifiers`, `GET /blocklist_identifiers`
- **UI:** Two tabs (Allow / Block), each showing entries with add/remove capability
- **Files:** `clerk.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 1.14 — Instance Settings

✅ **Scope:** Add `clerk_instance_settings` to display instance configuration.

- **Backend:** Instance metadata from verify key response + additional beta_features endpoints
- **UI:** Read-only display of auth methods enabled, URLs, branding settings
- **Files:** `clerk.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

## Epic 2: AWS Cognito — New Tools

**User Story:** _As a developer using AWS Cognito, I want to manage users, groups, and tokens directly from AuthPilot so I can debug auth issues without navigating the AWS Console._

### Task 2.1 — Add AWS IAM Credential Support

✅ **Scope:** Extend the Cognito provider secret fields to support AWS IAM credentials (Access Key ID + Secret Access Key) alongside the existing Client ID/Secret.

- **UI:** New secret fields in `providers.ts` for Cognito: `aws_access_key_id`, `aws_secret_access_key`
- **Backend:** Custom SigV4 signing implementation using `hmac` + `sha2` crates (no AWS SDK)
- **Files:** `providers.ts`, `Cargo.toml`, `cognito.rs`, `tauri.ts`

> ⚠️ This is a prerequisite for Tasks 2.2–2.12 (admin operations require IAM credentials).

---

### Task 2.2 — List Users

✅ **Scope:** Add `cognito_list_users` command.

- **Backend:** `ListUsers` API action with pagination
- **UI:** Table with username, email, status (CONFIRMED/UNCONFIRMED/COMPROMISED), enabled/disabled, created date
- **Files:** `cognito.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 2.3 — Get User Details

✅ **Scope:** Add `cognito_get_user` to fetch full user attributes.

- **Backend:** `AdminGetUser` action
- **UI:** Detail view with all attributes (standard + custom), status, MFA config, created/modified dates
- **Files:** `cognito.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 2.4 — Search Users

✅ **Scope:** Add `cognito_search_users` with filter support.

- **Backend:** `ListUsers` with `Filter` parameter (e.g. `email = "user@example.com"`)
- **UI:** Search bar with attribute dropdown (email, phone, username, name, status)
- **Files:** `cognito.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 2.5 — Disable / Enable User

✅ **Scope:** Add `cognito_disable_user` and `cognito_enable_user` commands.

- **Backend:** `AdminDisableUser` / `AdminEnableUser` actions
- **UI:** Toggle button on user detail view, confirmation dialog
- **Files:** `cognito.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 2.6 — Reset User Password

✅ **Scope:** Add `cognito_reset_password` command.

- **Backend:** `AdminResetUserPassword` action
- **UI:** Confirmation dialog ("This will force the user to set a new password"), success toast
- **Files:** `cognito.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 2.7 — Confirm User

✅ **Scope:** Add `cognito_confirm_user` to manually confirm a pending signup.

- **Backend:** `AdminConfirmSignUp` action
- **UI:** Confirm button shown only for UNCONFIRMED users
- **Files:** `cognito.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 2.8 — List Groups

✅ **Scope:** Add `cognito_list_groups` command.

- **Backend:** `ListGroups` action with pagination
- **UI:** Table with group name, description, precedence, role ARN, created/modified dates
- **Files:** `cognito.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 2.9 — User Group Membership

✅ **Scope:** Add `cognito_list_user_groups` to view groups a user belongs to.

- **Backend:** `AdminListGroupsForUser` action, `AdminAddUserToGroup`, `AdminRemoveUserFromGroup`
- **UI:** List of groups with option to add/remove user from groups
- **Files:** `cognito.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 2.10 — List User Pool Clients

✅ **Scope:** Add `cognito_list_clients` to view app clients.

- **Backend:** `ListUserPoolClients` action
- **UI:** Table with client name, client ID
- **Files:** `cognito.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 2.11 — Decode Cognito Token

✅ **Scope:** Add `cognito_decode_token` that decodes a Cognito JWT, verifies against the pool's JWKS.

- **Backend:** Fetch JWKS from `https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json`, verify RS256
- **Rust deps:** Reuse `jsonwebtoken` crate (from Task 1.4)
- **UI:** Same JWT decode UI as Clerk (paste → header/payload/signature status)
- **Files:** `cognito.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 2.12 — JWKS Viewer

✅ **Scope:** Add `cognito_get_jwks` to display the public JWKS.

- **Backend:** `GET https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json`
- **UI:** Same JWKS viewer UI as Clerk (formatted keys, copy buttons)
- **Files:** `cognito.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 2.13 — Pool Statistics

✅ **Scope:** Add `cognito_pool_stats` to display user pool info and stats.

- **Backend:** `DescribeUserPool` action
- **UI:** Pool name, ID, estimated user count, creation date, MFA config, password policy
- **Files:** `cognito.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 2.14 — Initiate Auth Flow

✅ **Scope:** Add `cognito_initiate_auth` to test auth flows via the API.

- **Backend:** `InitiateAuth` with `USER_PASSWORD_AUTH` flow, proper SECRET_HASH computation
- **Input:** Username, password (via dialog), client ID + optional client secret from secrets
- **UI:** Form dialog, displays resulting tokens on success or challenge details on failure
- **Files:** `cognito.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 2.15 — Global Sign Out

✅ **Scope:** Add `cognito_global_signout` to invalidate all sessions for a user.

- **Backend:** `AdminUserGlobalSignOut` action
- **UI:** Action button on user detail, success toast
- **Files:** `cognito.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

## Epic 3: Auth0 — Full Provider Integration

**User Story:** _As a developer using Auth0, I want to add my Auth0 tenant to AuthPilot and manage users, roles, connections, and logs so I have a single tool for all my auth providers._

### Task 3.1 — Auth0 Provider Scaffold

✅ **Scope:** Add Auth0 as a new provider in AuthPilot.

- **Provider config:** Add `auth0` type to `providers.ts` with secret fields (Domain, Client ID, Client Secret), icon, and color
- **Rust module:** Create `src-tauri/src/auth0.rs` with module structure and helper for obtaining Management API token (`POST /oauth/token` with `client_credentials` grant + `audience: https://{domain}/api/v2/`)
- **Registration:** Add module in `lib.rs`, add empty command set
- **UI:** Auth0 appears in provider dropdown when creating a project
- **Files:** `auth0.rs`, `lib.rs`, `providers.ts`, `tauri.ts`

---

### Task 3.2 — Auth0 Verify Connection

✅ **Scope:** Add `auth0_verify_connection` to validate credentials and get tenant info.

- **Backend:** Get Management API token → `GET /api/v2/tenants/settings`
- **UI:** Displays tenant name, region, environment tag, support info
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.3 — Auth0 List Users

✅ **Scope:** Add `auth0_list_users` with search and pagination.

- **Backend:** `GET /api/v2/users` with `per_page`, `page`, `q` params
- **UI:** Table with name, email, connection, last login, logins count, blocked status
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.4 — Auth0 Get User Details

✅ **Scope:** Add `auth0_get_user` for full user profile.

- **Backend:** `GET /api/v2/users/{id}`
- **UI:** Detail view with all fields, user_metadata, app_metadata, identities, login history
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.5 — Auth0 Search Users

✅ **Scope:** Add `auth0_search_users` using Auth0's Lucene query syntax.

- **Backend:** `GET /api/v2/users?q={query}&search_engine=v3`
- **UI:** Search bar with suggestions for common queries (email:"...", name:"...", identities.connection:"...")
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.6 — Auth0 List Connections

✅ **Scope:** Add `auth0_list_connections` to view identity providers.

- **Backend:** `GET /api/v2/connections`
- **UI:** Table with name, strategy (google-oauth2, auth0, etc.), enabled clients, status
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.7 — Auth0 Block / Unblock User

✅ **Scope:** Add `auth0_block_user` and `auth0_unblock_user` commands.

- **Backend:** `PATCH /api/v2/users/{id}` with `{ "blocked": true/false }`
- **UI:** Toggle on user detail view with confirmation
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.8 — Auth0 Delete User

✅ **Scope:** Add `auth0_delete_user` with safety confirmation.

- **Backend:** `DELETE /api/v2/users/{id}`
- **UI:** Destructive confirm dialog (type email to confirm)
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.9 — Auth0 Update User Metadata

✅ **Scope:** Add `auth0_update_metadata` for `user_metadata` and `app_metadata`.

- **Backend:** `PATCH /api/v2/users/{id}` with metadata objects
- **UI:** JSON editor with current values pre-loaded, separate tabs for user_metadata and app_metadata
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.10 — Auth0 List Roles

✅ **Scope:** Add `auth0_list_roles` to view all defined roles.

- **Backend:** `GET /api/v2/roles`
- **UI:** Table with role name, description, user count
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.11 — Auth0 Get User Roles & Assign/Remove

✅ **Scope:** Add `auth0_get_user_roles`, `auth0_assign_roles`, `auth0_remove_roles` commands.

- **Backend:** `GET /api/v2/users/{id}/roles`, `POST /api/v2/users/{id}/roles`, `DELETE /api/v2/users/{id}/roles`
- **UI:** User detail → roles section with assigned roles and picker to add/remove
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.12 — Auth0 List Organizations

✅ **Scope:** Add `auth0_list_organizations` to browse Auth0 orgs.

- **Backend:** `GET /api/v2/organizations`
- **UI:** Table with name, display_name, branding, member count
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.13 — Auth0 Organization Members

✅ **Scope:** Add `auth0_list_org_members` to view members of an organization.

- **Backend:** `GET /api/v2/organizations/{id}/members`
- **UI:** Table with user name, email, roles within org
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.14 — Auth0 List Logs

✅ **Scope:** Add `auth0_list_logs` to view recent auth events.

- **Backend:** `GET /api/v2/logs` with pagination and `q` filter
- **UI:** Event log with type (success login, failed login, signup, etc.), user, IP, date, with color-coded event types
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.15 — Auth0 Get Log Event Detail

✅ **Scope:** Add `auth0_get_log` to view detailed info about a specific event.

- **Backend:** `GET /api/v2/logs/{id}`
- **UI:** Full event detail with all fields, user agent, location, connection used
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.16 — Auth0 List Clients (Applications)

✅ **Scope:** Add `auth0_list_clients` to view configured applications.

- **Backend:** `GET /api/v2/clients`
- **UI:** Table with app name, client ID, app type, callbacks, allowed origins
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.17 — Auth0 Client Details

✅ **Scope:** Add `auth0_get_client` for full application config.

- **Backend:** `GET /api/v2/clients/{id}`
- **UI:** Detail view with all settings, grant types, callbacks, logout URLs
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.18 — Auth0 Verify JWT

✅ **Scope:** Add `auth0_verify_jwt` for local JWT decode and verification.

- **Backend:** Fetch JWKS from `https://{domain}/.well-known/jwks.json`, verify RS256
- **UI:** Reuse JWT decode component from Clerk (Task 1.4)
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.19 — Auth0 JWKS Viewer

✅ **Scope:** Add `auth0_get_jwks` to display tenant's public keys.

- **Backend:** `GET https://{domain}/.well-known/jwks.json`
- **UI:** Reuse JWKS viewer component from Clerk (Task 1.11)
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.20 — Auth0 Generate Test Token

✅ **Scope:** Add `auth0_get_token` to obtain a token via client credentials.

- **Backend:** `POST https://{domain}/oauth/token` with `client_credentials` grant
- **Input:** Audience, scope (optional)
- **UI:** Token display with decoded view, copy button, expiry countdown
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.21 — Auth0 List Rules / Actions

✅ **Scope:** Add `auth0_list_actions` to view configured Auth0 Actions.

- **Backend:** `GET /api/v2/actions/actions`
- **UI:** Table with action name, trigger, status (deployed/draft), last deployed date
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.22 — Auth0 List Grants

✅ **Scope:** Add `auth0_list_grants` to view active grants / refresh tokens.

- **Backend:** `GET /api/v2/grants`
- **UI:** Table with user, client, audience, scope, created date
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.23 — Auth0 Revoke Refresh Token

✅ **Scope:** Add `auth0_revoke_grant` to invalidate a grant.

- **Backend:** `DELETE /api/v2/grants/{id}`
- **UI:** Revoke button per row in grants list, confirmation dialog
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 3.24 — Auth0 Tenant Settings

✅ **Scope:** Add `auth0_tenant_settings` to display tenant configuration.

- **Backend:** `GET /api/v2/tenants/settings`
- **UI:** Read-only display of MFA policy, branding, session idle timeout, sandbox version
- **Files:** `auth0.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

## Epic 4: Supabase Auth — Full Provider Integration

**User Story:** _As a developer using Supabase, I want to manage my auth users, generate invite links, and inspect MFA enrollment from AuthPilot so I can handle all auth duties from one tool._

### Task 4.1 — Supabase Provider Scaffold

⬜ **Scope:** Add Supabase Auth as a new provider in AuthPilot.

- **Provider config:** Add `supabase` type to `providers.ts` with secret fields (Project URL, Service Role Key), icon, and color
- **Rust module:** Create `src-tauri/src/supabase.rs` with module structure, helper to build authed requests (apikey header + Authorization: Bearer {service_role_key})
- **Registration:** Add module in `lib.rs`
- **UI:** Supabase appears in provider dropdown
- **Files:** `supabase.rs`, `lib.rs`, `providers.ts`, `tauri.ts`

---

### Task 4.2 — Supabase Verify Connection

⬜ **Scope:** Add `supabase_verify_connection` to validate project URL + service role key.

- **Backend:** `GET {project_url}/auth/v1/settings` with apikey header
- **UI:** Display auth settings: external providers enabled, MFA config, auto confirm status
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.3 — Supabase List Users

⬜ **Scope:** Add `supabase_list_users` with pagination.

- **Backend:** `GET {project_url}/auth/v1/admin/users` with pagination params
- **UI:** Table with email, phone, provider, last sign in, confirmed status, created date
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.4 — Supabase Get User Details

⬜ **Scope:** Add `supabase_get_user` for full user profile.

- **Backend:** `GET {project_url}/auth/v1/admin/users/{id}`
- **UI:** Detail view with all user metadata, app metadata, identities, factors, confirmed channels
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.5 — Supabase Search Users

⬜ **Scope:** Add user search/filter capability.

- **Backend:** Filter on `GET /auth/v1/admin/users` or client-side filtering
- **UI:** Search bar filtering by email/phone
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.6 — Supabase Create User

⬜ **Scope:** Add `supabase_create_user` to create users via admin API.

- **Backend:** `POST {project_url}/auth/v1/admin/users` with email, password, user_metadata
- **UI:** Create form with email, password, phone (optional), metadata JSON, auto-confirm toggle
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.7 — Supabase Update User

⬜ **Scope:** Add `supabase_update_user` to modify user data.

- **Backend:** `PUT {project_url}/auth/v1/admin/users/{id}` with fields to update
- **UI:** Edit form pre-filled with current data, save button
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.8 — Supabase Delete User

⬜ **Scope:** Add `supabase_delete_user` with safety confirmation.

- **Backend:** `DELETE {project_url}/auth/v1/admin/users/{id}`
- **UI:** Destructive confirm dialog
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.9 — Supabase Ban / Unban User

⬜ **Scope:** Add `supabase_ban_user` and `supabase_unban_user`.

- **Backend:** `PUT /auth/v1/admin/users/{id}` with `{ "ban_duration": "876000h" }` to ban, `{ "ban_duration": "none" }` to unban
- **UI:** Toggle on user detail, confirmation dialog
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.10 — Supabase Generate Link

⬜ **Scope:** Add `supabase_generate_link` to create magic links, invite links, signup links, and recovery links.

- **Backend:** `POST {project_url}/auth/v1/admin/generate_link` with type (signup, magiclink, invite, recovery)
- **UI:** Form with link type picker, email input, redirect URL (optional), result displays generated link with copy button
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.11 — Supabase List MFA Factors

⬜ **Scope:** Add `supabase_list_factors` to view a user's MFA enrollments.

- **Backend:** `GET {project_url}/auth/v1/admin/users/{id}/factors`
- **UI:** Table with factor type (totp, webauthn), status (verified/unverified), created date
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.12 — Supabase Delete MFA Factor

⬜ **Scope:** Add `supabase_delete_factor` to remove a factor.

- **Backend:** `DELETE {project_url}/auth/v1/admin/users/{id}/factors/{factor_id}`
- **UI:** Delete button per factor row, confirmation dialog
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.13 — Supabase Auth Settings

⬜ **Scope:** Add `supabase_auth_settings` to view auth configuration.

- **Backend:** `GET {project_url}/auth/v1/settings`
- **UI:** Display external providers (Google, GitHub, etc.), MFA config, mailer settings
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.14 — Supabase Verify JWT

⬜ **Scope:** Add `supabase_verify_jwt` for local decode using the project's JWT secret.

- **Backend:** Decode JWT, verify HS256 signature (or RS256 if JWKS is available)
- **UI:** Reuse JWT decode component
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.15 — Supabase JWKS Viewer

⬜ **Scope:** Add `supabase_get_jwks` to display project's public keys.

- **Backend:** `GET {project_url}/auth/v1/.well-known/jwks.json`
- **UI:** Reuse JWKS viewer component
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.16 — Supabase Invite User

⬜ **Scope:** Add `supabase_invite_user` to send invitation emails.

- **Backend:** `POST {project_url}/auth/v1/invite` with email
- **UI:** Simple form with email input, invite button
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.17 — Supabase Sign Out User

⬜ **Scope:** Add `supabase_signout_user` to invalidate all sessions.

- **Backend:** `POST {project_url}/auth/v1/logout` with admin scope
- **UI:** Sign-out button on user detail, confirmation dialog
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

### Task 4.18 — Supabase List SSO Providers

⬜ **Scope:** Add `supabase_list_sso_providers` to view SAML/SSO providers.

- **Backend:** `GET {project_url}/auth/v1/admin/sso/providers`
- **UI:** Table with provider type, domain, metadata URL, created date
- **Files:** `supabase.rs`, `lib.rs`, `tauri.ts`, `providers.ts`, `provider-tools.tsx`

---

## Epic 5: Cross-Provider Tools

**User Story:** _As a developer managing multiple auth providers, I want universal tools that work across providers so I can debug tokens, compare configs, and get a unified view of all my auth infrastructure._

### Task 5.1 — Universal JWT Decoder

⬜ **Scope:** Add a provider-agnostic JWT decoder that works with any JWT.

- **Backend:** Rust command that decodes any JWT without verification (header + payload), optionally verifies if a JWKS URL or secret is provided
- **UI:** Dedicated page/modal: paste JWT → instant decode, shows header (alg, kid, typ), payload (formatted + highlighted claims like exp, iat, sub, iss), signature status, expiry countdown
- **Reusable:** Build as a shared component that Clerk/Cognito/Auth0/Supabase JWT tools can delegate to
- **Files:** New `jwt.rs` (or add to existing util), `lib.rs`, `tauri.ts`, new component

---

### Task 5.2 — Token Comparator

⬜ **Scope:** Add a tool to compare two JWTs side-by-side.

- **UI:** Two paste areas, decoded payloads side-by-side with diff highlighting (added/removed/changed claims), useful for debugging token issues across environments
- **Files:** New component, `tauri.ts`

---

### Task 5.3 — User Lookup (Multi-Provider)

⬜ **Scope:** Add a tool to search for a user across all configured providers simultaneously.

- **Backend:** Parallel search across all providers by email, returns combined results
- **UI:** Search bar → results grouped by provider with match highlights
- **Files:** Backend commands per provider (reuse existing search commands), new aggregator component

---

### Task 5.4 — Auth Health Dashboard

⬜ **Scope:** Add a dashboard showing health status of all configured providers.

- **UI:** Cards per provider showing: connection status (green/red), user count, last API call latency, key metrics
- **Backend:** Lightweight verify call per provider
- **Files:** New dashboard component, `tauri.ts`

---

### Task 5.5 — Webhook Tester

⬜ **Scope:** Add a tool to send test webhook payloads to a local endpoint.

- **Backend:** Rust HTTP client to send POST with configurable JSON body and headers
- **UI:** Endpoint URL input, payload editor (with templates for common auth events), send button, response display
- **Files:** New `webhooks.rs`, `lib.rs`, `tauri.ts`, new component

---

### Task 5.6 — JWKS Key Inspector (Unified)

⬜ **Scope:** Add a unified JWKS viewer that fetches and compares public keys from all configured providers.

- **UI:** Combined view of all JWKS endpoints, keys grouped by provider, key comparison
- **Files:** Reuse per-provider JWKS commands, new aggregator component

---

### Task 5.7 — Token Expiry Monitor

⬜ **Scope:** Add a monitor that tracks token lifetimes and shows near-expiry warnings.

- **UI:** List of recently generated tokens with countdown timers, color-coded (green > 50%, yellow 10-50%, red < 10%)
- **Backend:** Store tokens in memory (session-only, never persisted)
- **Files:** New component, Zustand store

---

### Task 5.8 — Request Logger

⬜ **Scope:** Add an API request logger that records all HTTP calls made by AuthPilot.

- **Backend:** Wrap all reqwest calls with logging middleware, store last N requests in memory
- **UI:** Log viewer with method, URL, status, duration, expandable request/response bodies
- **Files:** `auth0.rs`, `clerk.rs`, `cognito.rs`, `supabase.rs` (add logging), new component

---

## Epic 6: Data Export Tools

**User Story:** _As a developer, I want to export user data, organization data, and audit logs from any provider as JSON or CSV so I can perform migrations, create reports, or back up my auth data._

### Task 6.1 — Export Infrastructure (File Save Dialog)

⬜ **Scope:** Build the shared export infrastructure using Tauri's save dialog.

- **Backend:** Rust command `export_to_file(data: String, format: String)` that opens a native save dialog and writes the file
- **Add dep:** `tauri-plugin-dialog` for native file dialogs
- **Helpers:** JSON serializer, CSV serializer (flatten nested objects), clipboard writer
- **Files:** New `export.rs`, `lib.rs`, `Cargo.toml`, `tauri.ts`

---

### Task 6.2 — Export UI Component

⬜ **Scope:** Build a reusable Export dialog component.

- **UI:** Format picker (JSON / CSV / Clipboard), optional filter inputs (date range, status), progress bar for paginated exports, success toast with file path
- **Files:** New `ExportDialog.tsx` component

---

### Task 6.3 — Clerk Data Exports

⬜ **Scope:** Add export capabilities for Clerk data.

- **Export Users:** Fetch all users (paginated) → export as JSON/CSV
- **Export Organizations:** Fetch all orgs → export
- **Export Org Members:** For a selected org → export members
- **Export Invitations:** Fetch all invitations → export
- **UI:** Export button on each list view, uses ExportDialog (Task 6.2)
- **Files:** `clerk.rs` (paginated fetch helpers), `tauri.ts`, `provider-tools.tsx`

---

### Task 6.4 — Cognito Data Exports

⬜ **Scope:** Add export capabilities for Cognito data.

- **Export Users:** Paginated `ListUsers` → export
- **Export Groups:** `ListGroups` → export
- **Export Group Members:** For a selected group → export users
- **Files:** `cognito.rs`, `tauri.ts`, `provider-tools.tsx`

---

### Task 6.5 — Auth0 Data Exports

⬜ **Scope:** Add export capabilities for Auth0 data.

- **Export Users:** Paginated user list → export
- **Export Organizations:** Org list → export
- **Export Roles:** Role list → export
- **Export Connections:** Connection list → export
- **Export Logs:** Auth event logs → export (with date range filter)
- **Files:** `auth0.rs`, `tauri.ts`, `provider-tools.tsx`

---

### Task 6.6 — Supabase Data Exports

⬜ **Scope:** Add export capabilities for Supabase data.

- **Export Users:** Paginated admin user list → export
- **Export MFA Factors:** For selected user → export factors
- **Export Invitations:** If applicable → export
- **Files:** `supabase.rs`, `tauri.ts`, `provider-tools.tsx`

---

### Task 6.7 — Cross-Provider Unified Export

⬜ **Scope:** Add unified export tools working across all providers.

- **Export All Users:** Fetch users from all configured providers → merge into single file with provider column
- **Export Project Config:** Export all provider configs (without secrets) for sharing/backup
- **Export Audit Report:** Summary report with user counts, org counts, active sessions per provider
- **Files:** New aggregation logic, export commands, UI

---

## Epic 7: Shared UI Components & Refactoring

**User Story:** _As a developer working on AuthPilot, I want shared reusable components for common patterns (JWT decode, JWKS viewer, user table, metadata editor) so adding new providers is fast and consistent._

### Task 7.1 — Shared JWT Decode Component

⬜ **Scope:** Extract the JWT decode UI into a reusable component.

- **Component:** `JwtDecodeView` — accepts JWT string, optional JWKS URL, shows header/payload/signature/expiry
- **Used by:** Clerk, Cognito, Auth0, Supabase JWT tools + Universal JWT Decoder
- **Files:** New `src/components/shared/jwt-decode-view.tsx`

---

### Task 7.2 — Shared JWKS Viewer Component

⬜ **Scope:** Extract the JWKS viewer into a reusable component.

- **Component:** `JwksViewer` — accepts JWKS JSON, formats keys, copy per key
- **Used by:** All provider JWKS tools + Unified JWKS Inspector
- **Files:** New `src/components/shared/jwks-viewer.tsx`

---

### Task 7.3 — Shared User Table Component

⬜ **Scope:** Build a generic user table component.

- **Component:** `UserTable` — accepts column config + user data, supports search, sort, pagination, row click
- **Used by:** All provider List Users tools
- **Files:** New `src/components/shared/user-table.tsx`

---

### Task 7.4 — Shared Metadata Editor Component

⬜ **Scope:** Build a JSON metadata editor component.

- **Component:** `MetadataEditor` — JSON textarea with validation, diff view, save action
- **Used by:** Clerk Update Metadata, Auth0 Update Metadata, Supabase Update User
- **Files:** New `src/components/shared/metadata-editor.tsx`

---

### Task 7.5 — Shared Confirmation Dialog Component

⬜ **Scope:** Build a reusable destructive action confirmation dialog.

- **Component:** `DestructiveConfirmDialog` — requires typing a confirmation phrase, red styling, countdown
- **Used by:** Delete User, Ban User, Revoke Session, etc. across all providers
- **Files:** New `src/components/shared/destructive-confirm-dialog.tsx`

---

## Summary

| Epic                        | Tasks  | Priority  |
| --------------------------- | ------ | --------- |
| **1. Clerk New Tools**      | 14     | Phase 1   |
| **2. Cognito New Tools**    | 15     | Phase 1   |
| **3. Auth0 Integration**    | 24     | Phase 1   |
| **4. Supabase Integration** | 18     | Phase 1   |
| **5. Cross-Provider Tools** | 8      | Phase 2   |
| **6. Data Export Tools**    | 7      | Phase 2   |
| **7. Shared UI Components** | 5      | Phase 1\* |
| **Total**                   | **91** |           |

> \* Epic 7 should be tackled early (before or alongside Epics 1–4), since the shared components reduce duplication for every provider.

### Recommended Execution Order

1. **Epic 7** (Tasks 7.1–7.5) — Build shared components first
2. **Epic 1** (Tasks 1.1–1.4) — Clerk high-priority tools (uses shared components)
3. **Epic 3** (Tasks 3.1–3.5) — Auth0 scaffold + core tools (biggest new provider)
4. **Epic 4** (Tasks 4.1–4.5) — Supabase scaffold + core tools
5. **Epic 2** (Tasks 2.1–2.4) — Cognito IAM + core tools
6. Complete remaining tasks per epic in priority order
7. **Epic 5** (Tasks 5.1–5.8) — Cross-provider tools
8. **Epic 6** (Tasks 6.1–6.7) — Data export tools
