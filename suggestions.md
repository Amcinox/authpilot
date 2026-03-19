# AuthPilot — Provider Tools Suggestions

A comprehensive breakdown of all tools available (and planned) for each authentication provider, designed to give developers maximum visibility and control over their auth infrastructure.

---

## 🟢 Clerk (Currently Supported)

### Existing Tools

| #   | Tool                       | Description                                            | Input                         | Output                                      |
| --- | -------------------------- | ------------------------------------------------------ | ----------------------------- | ------------------------------------------- |
| 1   | **Verify Key**             | Validates a Clerk secret key and returns instance info | Secret Key                    | Instance type, user count, validity         |
| 2   | **List Organizations**     | Fetches all organizations in the instance              | —                             | Org name, slug, member count, created date  |
| 3   | **List Users**             | Browse all users with search and filtering             | —                             | Name, email, created date, last sign-in     |
| 4   | **Get User by ID**         | Fetch detailed info for a specific user                | User ID                       | Full profile, metadata, email addresses     |
| 5   | **Find User by Email**     | Search for a user by email address                     | Email                         | User profile match                          |
| 6   | **Get User Organizations** | List all orgs a user belongs to                        | User ID                       | Org memberships and roles                   |
| 7   | **List Sessions**          | Browse active sessions for a user                      | User ID                       | Session ID, status, device info, timestamps |
| 8   | **Create Session Token**   | Generate a JWT token for a session                     | Session ID, expiry, org scope | Signed JWT (with inline decode)             |
| 9   | **Revoke Session**         | Immediately invalidate an active session               | Session ID                    | Confirmation                                |

### Suggested New Tools

| #   | Tool                               | Description                                      | API Endpoint                                  | Priority |
| --- | ---------------------------------- | ------------------------------------------------ | --------------------------------------------- | -------- |
| 10  | **List Invitations**               | View pending org/instance invitations            | `GET /invitations`                            | High     |
| 11  | **Revoke Invitation**              | Cancel a pending invitation                      | `POST /invitations/{id}/revoke`               | Medium   |
| 12  | **Ban/Unban User**                 | Toggle user ban status                           | `POST /users/{id}/ban`                        | High     |
| 13  | **Delete User**                    | Permanently remove a user                        | `DELETE /users/{id}`                          | Medium   |
| 14  | **Update User Metadata**           | Edit public/private/unsafe metadata              | `PATCH /users/{id}/metadata`                  | High     |
| 15  | **List Webhooks**                  | View configured webhook endpoints                | `GET /webhooks`                               | Medium   |
| 16  | **Verify JWT**                     | Decode and validate a Clerk-issued JWT locally   | Local decode                                  | High     |
| 17  | **List Email Addresses**           | View all emails for a user                       | `GET /users/{id}` → email_addresses           | Low      |
| 18  | **Get Organization Details**       | Full org info with metadata                      | `GET /organizations/{id}`                     | Medium   |
| 19  | **List Organization Members**      | Browse members of a specific org                 | `GET /organizations/{id}/memberships`         | High     |
| 20  | **Create Organization Invitation** | Invite a user to an org                          | `POST /organizations/{id}/invitations`        | Medium   |
| 21  | **Instance Settings**              | View instance configuration (auth methods, URLs) | `GET /beta_features`, instance info           | Low      |
| 22  | **JWKS Viewer**                    | Fetch and display the public JWKS keys           | `GET /.well-known/jwks.json` via frontend URL | Medium   |
| 23  | **Allowlist/Blocklist**            | View and manage email/domain allow/block lists   | `GET /allowlist_identifiers`                  | Low      |

---

## 🟠 AWS Cognito (Currently Supported)

### Existing Tools

| #   | Tool              | Description                                | Input                                           | Output                     |
| --- | ----------------- | ------------------------------------------ | ----------------------------------------------- | -------------------------- |
| 1   | **Validate Pool** | Checks User Pool exists by fetching JWKS   | User Pool ID, Region                            | Pool validity, key count   |
| 2   | **Get Token**     | Obtain access token via client credentials | Client ID, Client Secret, Scope, Domain, Region | Access token, type, expiry |

### Suggested New Tools

| #   | Tool                       | Description                                  | API Action                             | Priority |
| --- | -------------------------- | -------------------------------------------- | -------------------------------------- | -------- |
| 3   | **List Users**             | Browse all users in a User Pool              | `ListUsers`                            | High     |
| 4   | **Get User Details**       | View attributes for a specific user          | `AdminGetUser`                         | High     |
| 5   | **Search Users**           | Find users by attribute (email, phone, name) | `ListUsers` with filter                | High     |
| 6   | **Disable/Enable User**    | Toggle user access                           | `AdminDisableUser` / `AdminEnableUser` | Medium   |
| 7   | **Reset User Password**    | Force password reset                         | `AdminResetUserPassword`               | Medium   |
| 8   | **Confirm User**           | Manually confirm a pending user              | `AdminConfirmSignUp`                   | Medium   |
| 9   | **List Groups**            | View all groups in the pool                  | `ListGroups`                           | High     |
| 10  | **User Group Membership**  | View/manage groups for a user                | `AdminListGroupsForUser`               | Medium   |
| 11  | **List User Pool Clients** | View app clients configured                  | `ListUserPoolClients`                  | Medium   |
| 12  | **Decode Token**           | Decode and validate a Cognito JWT locally    | Local decode + JWKS verify             | High     |
| 13  | **JWKS Viewer**            | Display the public JSON Web Key Set          | Public JWKS endpoint                   | Medium   |
| 14  | **Pool Statistics**        | User count, estimated pool size              | `DescribeUserPool`                     | Low      |
| 15  | **Custom Attributes**      | View custom attributes schema                | `DescribeUserPool` → SchemaAttributes  | Low      |
| 16  | **Initiate Auth Flow**     | Test USER_PASSWORD_AUTH or SRP flow          | `InitiateAuth`                         | Medium   |
| 17  | **Global Sign Out**        | Sign out a user from all devices             | `AdminUserGlobalSignOut`               | Medium   |

> **Note:** Most Cognito admin operations require AWS IAM credentials (Access Key + Secret Key) with proper permissions. This would require adding a new secret type (AWS IAM) alongside the current Client ID/Secret.

---

## 🔵 Auth0 (Planned)

### Required Secrets

| Field             | Description                  | Example              |
| ----------------- | ---------------------------- | -------------------- |
| **Domain**        | Auth0 tenant domain          | `myapp.us.auth0.com` |
| **Client ID**     | Management API client ID     | `abc123...`          |
| **Client Secret** | Management API client secret | `xyz789...`          |

Auth0's Management API is REST-based with Bearer token auth (obtained via client credentials). Very similar pattern to Clerk.

### Suggested Tools

| #   | Tool                     | Description                                                   | API Endpoint                                         | Priority |
| --- | ------------------------ | ------------------------------------------------------------- | ---------------------------------------------------- | -------- |
| 1   | **Verify Connection**    | Validate domain + credentials, get tenant info                | `POST /oauth/token` + `GET /api/v2/tenants/settings` | High     |
| 2   | **List Users**           | Browse all users with search/filter                           | `GET /api/v2/users`                                  | High     |
| 3   | **Get User Details**     | Full user profile with metadata                               | `GET /api/v2/users/{id}`                             | High     |
| 4   | **Search Users**         | Query users by email, name, or Auth0 query syntax             | `GET /api/v2/users?q=email:"..."`                    | High     |
| 5   | **List Connections**     | View configured identity providers (Google, GitHub, DB, etc.) | `GET /api/v2/connections`                            | High     |
| 6   | **Block/Unblock User**   | Toggle user blocked status                                    | `PATCH /api/v2/users/{id}`                           | Medium   |
| 7   | **Delete User**          | Remove a user                                                 | `DELETE /api/v2/users/{id}`                          | Medium   |
| 8   | **Update User Metadata** | Edit user_metadata / app_metadata                             | `PATCH /api/v2/users/{id}`                           | High     |
| 9   | **List Roles**           | View all roles defined                                        | `GET /api/v2/roles`                                  | Medium   |
| 10  | **Get User Roles**       | Roles assigned to a specific user                             | `GET /api/v2/users/{id}/roles`                       | Medium   |
| 11  | **Assign/Remove Role**   | Manage role assignments                                       | `POST /DELETE /api/v2/users/{id}/roles`              | Medium   |
| 12  | **List Organizations**   | Browse Auth0 organizations                                    | `GET /api/v2/organizations`                          | Medium   |
| 13  | **Organization Members** | View members of an organization                               | `GET /api/v2/organizations/{id}/members`             | Medium   |
| 14  | **List Logs**            | View recent auth events (logins, failures, etc.)              | `GET /api/v2/logs`                                   | High     |
| 15  | **Get Log Event**        | Detailed info about a specific event                          | `GET /api/v2/logs/{id}`                              | Medium   |
| 16  | **List Clients**         | View configured applications                                  | `GET /api/v2/clients`                                | Medium   |
| 17  | **Client Details**       | Configuration for a specific app                              | `GET /api/v2/clients/{id}`                           | Medium   |
| 18  | **List Rules/Actions**   | View configured Auth0 Rules or Actions                        | `GET /api/v2/actions/actions`                        | Low      |
| 19  | **Verify JWT**           | Decode and validate an Auth0 token locally                    | Local decode + JWKS at `/.well-known/jwks.json`      | High     |
| 20  | **JWKS Viewer**          | Fetch and display tenant's public keys                        | `GET /.well-known/jwks.json`                         | Medium   |
| 21  | **Generate Test Token**  | Get a token via client credentials for testing                | `POST /oauth/token`                                  | High     |
| 22  | **List Grants**          | View active grants/refresh tokens for a user                  | `GET /api/v2/grants`                                 | Low      |
| 23  | **Revoke Refresh Token** | Invalidate a specific grant                                   | `DELETE /api/v2/grants/{id}`                         | Low      |
| 24  | **Tenant Settings**      | View tenant config (MFA, branding, etc.)                      | `GET /api/v2/tenants/settings`                       | Low      |

---

## 🟣 Supabase Auth (Planned)

### Required Secrets

| Field                | Description                    | Example                          |
| -------------------- | ------------------------------ | -------------------------------- |
| **Project URL**      | Supabase project URL           | `https://xyzproject.supabase.co` |
| **Service Role Key** | Admin-level JWT (bypasses RLS) | `eyJhbGciOi...`                  |

Supabase Auth uses the GoTrue API under the hood. The service_role key gives admin access to all auth endpoints.

### Suggested Tools

| #   | Tool                   | Description                                         | API Endpoint                                     | Priority |
| --- | ---------------------- | --------------------------------------------------- | ------------------------------------------------ | -------- |
| 1   | **Verify Connection**  | Validate project URL + service role key             | `GET /auth/v1/settings`                          | High     |
| 2   | **List Users**         | Browse all users with pagination                    | `GET /auth/v1/admin/users`                       | High     |
| 3   | **Get User Details**   | Full user profile with metadata                     | `GET /auth/v1/admin/users/{id}`                  | High     |
| 4   | **Search Users**       | Filter users by email or phone                      | `GET /auth/v1/admin/users?filter=...`            | High     |
| 5   | **Create User**        | Create a new user (with email/password or phone)    | `POST /auth/v1/admin/users`                      | Medium   |
| 6   | **Update User**        | Modify email, phone, metadata, or role              | `PUT /auth/v1/admin/users/{id}`                  | Medium   |
| 7   | **Delete User**        | Remove a user                                       | `DELETE /auth/v1/admin/users/{id}`               | Medium   |
| 8   | **Ban/Unban User**     | Toggle user ban (set `banned_until`)                | `PUT /auth/v1/admin/users/{id}`                  | Medium   |
| 9   | **Generate Link**      | Create magic link, invite, signup, or recovery link | `POST /auth/v1/admin/generate_link`              | High     |
| 10  | **List Factors (MFA)** | View MFA factors for a user                         | `GET /auth/v1/admin/users/{id}/factors`          | Medium   |
| 11  | **Delete MFA Factor**  | Remove a TOTP/WebAuthn factor                       | `DELETE /auth/v1/admin/users/{id}/factors/{fid}` | Medium   |
| 12  | **Auth Settings**      | View auth configuration (providers, MFA, etc.)      | `GET /auth/v1/settings`                          | Medium   |
| 13  | **List SSO Providers** | View configured SAML/SSO providers                  | `GET /auth/v1/admin/sso/providers`               | Low      |
| 14  | **Verify JWT**         | Decode and validate a Supabase JWT locally          | Local decode using JWT secret                    | High     |
| 15  | **JWKS Viewer**        | Display project's public keys                       | `GET /auth/v1/.well-known/jwks.json`             | Medium   |
| 16  | **Invite User**        | Send an invite email to a new user                  | `POST /auth/v1/invite`                           | Medium   |
| 17  | **Sign Out User**      | Invalidate all sessions for a user                  | `POST /auth/v1/logout` with admin token          | Medium   |
| 18  | **List Sessions**      | View active sessions for a user                     | Via user identities/sessions data                | Low      |

---

## Cross-Provider Tools (Future)

Tools that work across all providers, for maximum developer productivity:

| #   | Tool                      | Description                                                  | Priority |
| --- | ------------------------- | ------------------------------------------------------------ | -------- |
| 1   | **Universal JWT Decoder** | Paste any JWT → decode header, payload, and verify signature | High     |
| 2   | **Token Comparator**      | Compare two tokens side-by-side (claims diff)                | Medium   |
| 3   | **Webhook Tester**        | Send test webhook payloads to a local endpoint               | Medium   |
| 4   | **User Lookup**           | Search for a user across all configured providers at once    | High     |
| 5   | **Auth Health Dashboard** | At-a-glance status of all configured providers               | Medium   |
| 6   | **Token Expiry Monitor**  | Track token lifetimes and alert on near-expiry               | Low      |
| 7   | **JWKS Key Inspector**    | Unified viewer for public keys from any provider             | Medium   |
| 8   | **Request Logger**        | View all API requests made by AuthPilot with timing          | Low      |

---

## Implementation Priority Matrix

### Phase 1 — High Value, Low Effort

- Clerk: Ban/Unban User, Update Metadata, List Org Members, Verify JWT
- Cognito: List Users, Get User Details, Decode Token
- Auth0: Full initial integration (Verify, List Users, Get User, Search, Logs)
- Supabase: Full initial integration (Verify, List Users, Get User, Generate Link)
- Cross-provider: Universal JWT Decoder

### Phase 2 — Medium Value

- Clerk: Invitations, Org Invitations, Webhooks, JWKS Viewer
- Cognito: Groups, Enable/Disable, AWS IAM credential support
- Auth0: Roles, Organizations, Connections, Actions
- Supabase: Create/Update/Delete User, MFA, SSO Providers

### Phase 3 — Nice to Have

- Clerk: Allowlist/Blocklist, Instance Settings
- Cognito: Pool Statistics, Custom Attributes, Initiate Auth
- Auth0: Grants, Tenant Settings, Rules
- Supabase: Sessions, Auth Settings
- Cross-provider: Webhook Tester, Token Comparator, Request Logger

---

## Data Export Tools

Export capabilities across all providers — lets developers extract data as JSON or CSV for migration, auditing, reporting, or backup purposes.

### Per-Provider Export Tools

| #   | Export Tool                     | Providers                       | Description                                            | Output Formats |
| --- | ------------------------------- | ------------------------------- | ------------------------------------------------------ | -------------- |
| 1   | **Export Users**                | Clerk, Auth0, Cognito, Supabase | Export all users with profile data, emails, metadata   | JSON, CSV      |
| 2   | **Export Organizations**        | Clerk, Auth0                    | Export all orgs with member counts, metadata, settings | JSON, CSV      |
| 3   | **Export Organization Members** | Clerk, Auth0                    | Export members + roles for a specific org              | JSON, CSV      |
| 4   | **Export Groups**               | Cognito                         | Export all groups with descriptions and user counts    | JSON, CSV      |
| 5   | **Export Group Members**        | Cognito                         | Export users belonging to a specific group             | JSON, CSV      |
| 6   | **Export Roles**                | Auth0                           | Export all roles with permissions                      | JSON, CSV      |
| 7   | **Export Connections**          | Auth0                           | Export configured identity providers                   | JSON           |
| 8   | **Export Logs**                 | Auth0                           | Export recent auth events (logins, failures, signups)  | JSON, CSV      |
| 9   | **Export Invitations**          | Clerk, Supabase                 | Export pending invitations                             | JSON, CSV      |
| 10  | **Export MFA Factors**          | Supabase                        | Export MFA enrollment status per user                  | JSON, CSV      |

### Cross-Provider Export Tools

| #   | Export Tool                           | Description                                                              | Priority |
| --- | ------------------------------------- | ------------------------------------------------------------------------ | -------- |
| 1   | **Export All Users (Multi-Provider)** | Export users from all configured providers into a single unified file    | High     |
| 2   | **Export Project Config**             | Export all provider configurations (without secrets) for sharing/backup  | Medium   |
| 3   | **Export Audit Report**               | Generate a report: user counts, org counts, active sessions per provider | Medium   |

### Export Format Options

- **JSON** — Full fidelity, nested objects, ideal for migration or API re-import
- **CSV** — Flat table, opens in Excel/Sheets, ideal for reporting and auditing
- **Clipboard** — Quick copy for pasting into other tools

### UX Flow

1. User clicks an export tool (e.g. "Export Users")
2. Dialog shows: format picker (JSON / CSV), optional filters (date range, status)
3. Tauri saves the file via native file dialog (`save_dialog`)
4. Progress bar for large exports (paginated API calls)
5. Toast notification on completion with file path

---

## Architecture Notes

All providers follow the same pattern already established:

1. **Rust backend** (`src-tauri/src/{provider}.rs`) — HTTP client with API calls
2. **TypeScript wrappers** (`src/lib/tauri.ts`) — Typed invoke functions
3. **Provider config** (`src/lib/providers.ts`) — Tool definitions, secret fields, icons
4. **UI components** (`src/components/shared/provider-tools.tsx`) — Result views and interactive flows

Adding a new provider requires:

- New Rust module with `#[tauri::command]` functions
- Register commands in `src-tauri/src/lib.rs`
- Add TypeScript invoke wrappers
- Add provider type, tools, and secret fields to `providers.ts`
- Add result views in `provider-tools.tsx`
