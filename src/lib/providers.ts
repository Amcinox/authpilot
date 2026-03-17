// ─── Provider Type Definitions ───────────────────────────────────────────────

export const PROVIDER_TYPES = ["clerk", "cognito", "auth0"] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

// ─── Per-Provider Secret Field Schemas ───────────────────────────────────────

export interface SecretFieldSchema {
    key: string;
    label: string;
    placeholder: string;
    sensitive: boolean;
}

const clerkSecretFields: SecretFieldSchema[] = [
    { key: "secretKey", label: "Secret Key", placeholder: "sk_test_...", sensitive: true },
    { key: "publishableKey", label: "Publishable Key", placeholder: "pk_test_...", sensitive: false },
    { key: "webhookSecret", label: "Webhook Signing Secret", placeholder: "whsec_...", sensitive: true },
];

const cognitoSecretFields: SecretFieldSchema[] = [
    { key: "userPoolId", label: "User Pool ID", placeholder: "us-east-1_xxxxxx", sensitive: false },
    { key: "region", label: "AWS Region", placeholder: "us-east-1", sensitive: false },
    { key: "awsAccessKeyId", label: "AWS Access Key ID", placeholder: "AKIA...", sensitive: false },
    { key: "awsSecretAccessKey", label: "AWS Secret Access Key", placeholder: "wJalr...", sensitive: true },
    { key: "clientId", label: "App Client ID (optional)", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxx", sensitive: false },
    { key: "clientSecret", label: "App Client Secret (optional)", placeholder: "xxxxxxxxxx", sensitive: true },
];

const auth0SecretFields: SecretFieldSchema[] = [
    { key: "domain", label: "Domain", placeholder: "your-tenant.auth0.com", sensitive: false },
    { key: "clientId", label: "Client ID", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", sensitive: false },
    { key: "clientSecret", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", sensitive: true },
];

export const PROVIDER_SECRET_FIELDS: Record<ProviderType, SecretFieldSchema[]> = {
    clerk: clerkSecretFields,
    cognito: cognitoSecretFields,
    auth0: auth0SecretFields,
};

// ─── Provider Tool Definitions ───────────────────────────────────────────────

export interface ProviderTool {
    id: string;
    label: string;
    description: string;
    icon: string; // lucide icon name reference
}

const clerkTools: ProviderTool[] = [
    { id: "clerk-verify-key", label: "Verify Key", description: "Validate your Clerk secret key", icon: "ShieldCheck" },
    { id: "clerk-list-orgs", label: "List Organizations", description: "List all organizations in your instance", icon: "Building2" },
    { id: "clerk-list-users", label: "List Users", description: "List users in your Clerk instance", icon: "Users" },
    { id: "clerk-find-user", label: "Find User by Email", description: "Search for a user by email address", icon: "Search" },
    { id: "clerk-get-user", label: "Get User by ID", description: "Get detailed user info by their ID", icon: "User" },
    { id: "clerk-get-user-orgs", label: "User Organizations", description: "Get organization memberships for a user", icon: "Building2" },
    { id: "clerk-list-sessions", label: "List Sessions", description: "List active sessions (filter by user)", icon: "Activity" },
    { id: "clerk-create-token", label: "Create Session Token", description: "Generate a JWT for a session", icon: "KeyRound" },
    { id: "clerk-revoke-session", label: "Revoke Session", description: "Revoke an active session", icon: "Ban" },
    { id: "clerk-ban-user", label: "Ban / Unban User", description: "Toggle user ban status", icon: "UserX" },
    { id: "clerk-update-metadata", label: "Update Metadata", description: "Edit user public/private metadata", icon: "FileEdit" },
    { id: "clerk-list-org-members", label: "Org Members", description: "List members of an organization", icon: "Users" },
    { id: "clerk-verify-jwt", label: "Verify JWT", description: "Decode and verify a Clerk JWT token", icon: "KeyRound" },
    { id: "clerk-list-invitations", label: "List Invitations", description: "View pending instance invitations", icon: "Mail" },
    { id: "clerk-webhooks", label: "Webhooks", description: "Open SVIX webhook dashboard", icon: "Wrench" },
    { id: "clerk-jwks", label: "JWKS Viewer", description: "View instance public keys (JWKS)", icon: "KeyRound" },
    { id: "clerk-allowblock", label: "Allow / Block Lists", description: "Manage email & domain allow/block lists", icon: "ListFilter" },
    { id: "clerk-instance", label: "Instance Settings", description: "View instance configuration & settings", icon: "ShieldCheck" },
];

const cognitoTools: ProviderTool[] = [
    { id: "cognito-validate", label: "Validate Config", description: "Verify your User Pool configuration", icon: "ShieldCheck" },
    { id: "cognito-pool-stats", label: "Pool Statistics", description: "View User Pool info and statistics", icon: "BarChart3" },
    { id: "cognito-list-users", label: "List Users", description: "Browse all users in the pool", icon: "Users" },
    { id: "cognito-get-user", label: "Get User", description: "Get detailed user info by username", icon: "User" },
    { id: "cognito-search-users", label: "Search Users", description: "Find users by attribute filter", icon: "Search" },
    { id: "cognito-disable-user", label: "Disable / Enable", description: "Toggle user access", icon: "Ban" },
    { id: "cognito-reset-password", label: "Reset Password", description: "Force user password reset", icon: "RotateCcw" },
    { id: "cognito-confirm-user", label: "Confirm User", description: "Manually confirm a pending user", icon: "UserCheck" },
    { id: "cognito-list-groups", label: "List Groups", description: "View all groups in the pool", icon: "Layers" },
    { id: "cognito-user-groups", label: "User Groups", description: "View groups for a user", icon: "Users" },
    { id: "cognito-list-clients", label: "List Clients", description: "View app clients configured", icon: "Wrench" },
    { id: "cognito-decode-token", label: "Decode Token", description: "Decode and verify a Cognito JWT", icon: "KeyRound" },
    { id: "cognito-jwks", label: "JWKS Viewer", description: "View pool public keys (JWKS)", icon: "KeyRound" },
    { id: "cognito-initiate-auth", label: "Initiate Auth", description: "Test USER_PASSWORD_AUTH flow", icon: "KeyRound" },
    { id: "cognito-global-signout", label: "Global Sign Out", description: "Sign out user from all devices", icon: "LogOut" },
];

const auth0Tools: ProviderTool[] = [
    { id: "auth0-verify", label: "Verify Connection", description: "Validate credentials and view tenant info", icon: "ShieldCheck" },
    { id: "auth0-tenant-settings", label: "Tenant Settings", description: "View tenant configuration", icon: "ShieldCheck" },
    { id: "auth0-list-users", label: "List Users", description: "Browse all users in the tenant", icon: "Users" },
    { id: "auth0-search-users", label: "Search Users", description: "Search users with Lucene query", icon: "Search" },
    { id: "auth0-get-user", label: "Get User", description: "Get user details by ID", icon: "User" },
    { id: "auth0-list-connections", label: "List Connections", description: "View identity provider connections", icon: "Activity" },
    { id: "auth0-list-roles", label: "List Roles", description: "View all defined roles", icon: "Layers" },
    { id: "auth0-list-orgs", label: "List Organizations", description: "Browse Auth0 organizations", icon: "Building2" },
    { id: "auth0-list-logs", label: "View Logs", description: "Browse recent auth events", icon: "Activity" },
    { id: "auth0-list-clients", label: "List Applications", description: "View configured app clients", icon: "Wrench" },
    { id: "auth0-verify-jwt", label: "Verify JWT", description: "Decode and verify an Auth0 JWT", icon: "KeyRound" },
    { id: "auth0-jwks", label: "JWKS Viewer", description: "View tenant public keys (JWKS)", icon: "KeyRound" },
    { id: "auth0-get-token", label: "Generate Token", description: "Get token via client_credentials", icon: "KeyRound" },
    { id: "auth0-list-actions", label: "List Actions", description: "View configured Auth0 Actions", icon: "Activity" },
    { id: "auth0-list-grants", label: "List Grants", description: "View active grants / refresh tokens", icon: "KeyRound" },
];

export const PROVIDER_TOOLS: Record<ProviderType, ProviderTool[]> = {
    clerk: clerkTools,
    cognito: cognitoTools,
    auth0: auth0Tools,
};

// ─── Provider Display Info ───────────────────────────────────────────────────

export interface ProviderInfo {
    type: ProviderType;
    name: string;
    description: string;
    color: string; // tailwind color class
    icon: string;
}

export const PROVIDER_INFO: Record<ProviderType, ProviderInfo> = {
    clerk: {
        type: "clerk",
        name: "Clerk",
        description: "Authentication & user management",
        color: "text-violet-500",
        icon: "Shield",
    },
    cognito: {
        type: "cognito",
        name: "AWS Cognito",
        description: "AWS identity & access management",
        color: "text-orange-500",
        icon: "Cloud",
    },
    auth0: {
        type: "auth0",
        name: "Auth0",
        description: "Identity platform by Okta",
        color: "text-red-500",
        icon: "Shield",
    },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get the default (empty) secrets object for a provider */
export function getDefaultSecrets(provider: ProviderType): Record<string, string> {
    const fields = PROVIDER_SECRET_FIELDS[provider];
    return Object.fromEntries(fields.map((f) => [f.key, ""]));
}
