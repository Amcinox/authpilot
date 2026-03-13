// ─── Provider Type Definitions ───────────────────────────────────────────────

export const PROVIDER_TYPES = ["clerk", "cognito"] as const;
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
    { key: "clientId", label: "App Client ID", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxx", sensitive: false },
    { key: "clientSecret", label: "App Client Secret", placeholder: "xxxxxxxxxx", sensitive: true },
    { key: "region", label: "AWS Region", placeholder: "us-east-1", sensitive: false },
];

export const PROVIDER_SECRET_FIELDS: Record<ProviderType, SecretFieldSchema[]> = {
    clerk: clerkSecretFields,
    cognito: cognitoSecretFields,
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
];

const cognitoTools: ProviderTool[] = [
    { id: "cognito-validate", label: "Validate Config", description: "Verify your User Pool configuration", icon: "ShieldCheck" },
    { id: "cognito-get-token", label: "Test Connection", description: "Test client credentials", icon: "KeyRound" },
];

export const PROVIDER_TOOLS: Record<ProviderType, ProviderTool[]> = {
    clerk: clerkTools,
    cognito: cognitoTools,
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
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get the default (empty) secrets object for a provider */
export function getDefaultSecrets(provider: ProviderType): Record<string, string> {
    const fields = PROVIDER_SECRET_FIELDS[provider];
    return Object.fromEntries(fields.map((f) => [f.key, ""]));
}
