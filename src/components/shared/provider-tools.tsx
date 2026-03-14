import React, { useState, useMemo } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
    type ProviderType,
    PROVIDER_TOOLS,
    PROVIDER_INFO,
    PROVIDER_SECRET_FIELDS,
} from "@/lib/providers";
import {
    clerkVerifyKey,
    clerkListOrganizations,
    clerkListUsers,
    clerkGetUser,
    clerkFindUserByEmail,
    clerkGetUserOrgs,
    clerkListSessions,
    clerkCreateSessionToken,
    clerkRevokeSession,
    clerkBanUser,
    clerkUnbanUser,
    clerkUpdateUserMetadata,
    clerkListOrgMembers,
    clerkVerifyJwt,
    clerkListInvitations,
    clerkRevokeInvitation,
    clerkDeleteUser,
    clerkGetOrganization,
    clerkCreateOrgInvitation,
    clerkGetSvixUrl,
    clerkGetJwks,
    clerkListAllowlist,
    clerkAddAllowlist,
    clerkDeleteAllowlist,
    clerkListBlocklist,
    clerkAddBlocklist,
    clerkDeleteBlocklist,
    clerkGetInstance,
    cognitoValidate,
    cognitoGetToken,
    type ClerkVerifyResult,
    type ClerkListResult,
    type ClerkOrg,
    type ClerkUser,
    type ClerkUserDetail,
    type ClerkSession,
    type ClerkSessionToken,
    type ClerkUserOrgMembership,
    type ClerkOrgMember,
    type ClerkJwtResult,
    type ClerkInvitation,
    type ClerkAllowBlockIdentifier,
    type CognitoValidateResult,
} from "@/lib/tauri";
import { useToastStore } from "@/stores/toast-store";
import type { Environment } from "@/stores/project-store";
import {
    ShieldCheck,
    Building2,
    Users,
    KeyRound,
    Wrench,
    Loader2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    ChevronDown,
    ChevronLeft,
    Search,
    Activity,
    Ban,
    Copy,
    User,
    UserX,
    ArrowRight,
    Clock,
    Shield,
    Mail,
    Hash,
    Calendar,
    Timer,
    FileEdit,
    Trash2,
    UserPlus,
    ExternalLink,
    ListFilter,
} from "lucide-react";

// Map icon string names to actual components
const iconMap: Record<string, React.FC<{ className?: string }>> = {
    ShieldCheck,
    Building2,
    Users,
    KeyRound,
    Search,
    Activity,
    Ban,
    User,
    UserX,
    FileEdit,
    Mail,
    ListFilter,
    Wrench,
};

// ─── Result Types ────────────────────────────────────────────────────────────

type ToolResult =
    | { type: "clerk-verify"; data: ClerkVerifyResult }
    | { type: "clerk-orgs"; data: ClerkListResult<ClerkOrg> }
    | { type: "clerk-users"; data: ClerkListResult<ClerkUser> }
    | { type: "clerk-user-detail"; data: ClerkUserDetail }
    | { type: "clerk-user-orgs"; data: ClerkListResult<ClerkUserOrgMembership> }
    | { type: "clerk-sessions"; data: ClerkListResult<ClerkSession> }
    | { type: "clerk-token"; data: ClerkSessionToken }
    | { type: "clerk-session-revoked"; data: ClerkSession }
    | { type: "clerk-user-banned"; data: ClerkUserDetail }
    | { type: "clerk-user-unbanned"; data: ClerkUserDetail }
    | { type: "clerk-metadata-updated"; data: ClerkUserDetail }
    | { type: "clerk-org-detail"; data: Record<string, unknown> }
    | { type: "clerk-org-invitation-sent"; data: Record<string, unknown> }
    | { type: "clerk-org-members"; data: ClerkListResult<ClerkOrgMember> }
    | { type: "clerk-jwt"; data: ClerkJwtResult }
    | { type: "clerk-invitations"; data: ClerkListResult<ClerkInvitation> }
    | { type: "clerk-invitation-revoked"; data: ClerkInvitation }
    | { type: "clerk-webhooks"; data: Record<string, unknown> }
    | { type: "clerk-jwks"; data: Record<string, unknown> }
    | { type: "clerk-user-deleted"; data: { userId: string } }
    | { type: "clerk-user-emails"; data: ClerkUserDetail }
    | { type: "clerk-allowblock"; data: { allowlist: ClerkAllowBlockIdentifier[]; blocklist: ClerkAllowBlockIdentifier[] } }
    | { type: "clerk-instance"; data: Record<string, unknown> }
    | { type: "cognito-validate"; data: CognitoValidateResult }
    | { type: "error"; message: string };

// ─── Input Prompt config ─────────────────────────────────────────────────────

interface InputPromptConfig {
    toolId: string;
    label: string;
    placeholder: string;
    field: string;
}

// ─── Navigation stack entry ──────────────────────────────────────────────────

interface NavEntry {
    result: ToolResult;
    title: string;
}

// ─── Org-scoped token picker config ──────────────────────────────────────────

interface OrgTokenPickerState {
    sessionId: string;
    userId: string;
    orgs: ClerkOrg[];
    loading: boolean;
}

// ─── JWT decode helper ───────────────────────────────────────────────────────

interface JwtClaims {
    sub?: string;
    iss?: string;
    iat?: number;
    exp?: number;
    nbf?: number;
    org_id?: string;
    org_slug?: string;
    org_role?: string;
    [key: string]: unknown;
}

function decodeJwt(jwt: string): JwtClaims | null {
    try {
        const parts = jwt.split(".");
        if (parts.length !== 3) return null;
        const payload = parts[1];
        const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

function formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleString();
}

function timeUntil(ts: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = ts - now;
    if (diff <= 0) return "expired";
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
    return `${Math.floor(diff / 86400)}d ${Math.floor((diff % 86400) / 3600)}h`;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ProviderToolsPanelProps {
    provider: ProviderType;
    environments: Environment[];
}

export const ProviderToolsPanel: React.FC<ProviderToolsPanelProps> = ({
    provider,
    environments,
}) => {
    const tools = PROVIDER_TOOLS[provider];
    const info = PROVIDER_INFO[provider];
    const addToast = useToastStore((s) => s.addToast);

    const [selectedEnvId, setSelectedEnvId] = useState<string>(
        environments[0]?.id || ""
    );
    const [loading, setLoading] = useState<string | null>(null);
    const [result, setResult] = useState<ToolResult | null>(null);
    const [resultTitle, setResultTitle] = useState("");
    const [showEnvPicker, setShowEnvPicker] = useState(false);

    // Navigation stack for back button
    const [navStack, setNavStack] = useState<NavEntry[]>([]);

    // Input prompt state for tools that require user input
    const [inputPrompt, setInputPrompt] = useState<InputPromptConfig | null>(null);
    const [inputValue, setInputValue] = useState("");

    // Org-scoped token picker state
    const [orgTokenPicker, setOrgTokenPicker] = useState<OrgTokenPickerState | null>(null);

    const selectedEnv = environments.find((e) => e.id === selectedEnvId);

    const getSecret = (key: string) => selectedEnv?.secrets[key] || "";

    const checkRequiredSecrets = (keys: string[]): boolean => {
        for (const key of keys) {
            if (!getSecret(key)) {
                const fieldLabel =
                    PROVIDER_SECRET_FIELDS[provider].find((f) => f.key === key)?.label || key;
                addToast({
                    type: "error",
                    message: `Missing "${fieldLabel}" — fill it in the ${selectedEnv?.name || "selected"} environment first`,
                });
                return false;
            }
        }
        return true;
    };

    // Push current result onto nav stack before navigating
    const pushNav = () => {
        if (result) {
            setNavStack((prev) => [...prev, { result, title: resultTitle }]);
        }
    };

    const goBack = () => {
        const prev = navStack[navStack.length - 1];
        if (prev) {
            setNavStack((s) => s.slice(0, -1));
            setResult(prev.result);
            setResultTitle(prev.title);
        }
    };

    const closeDialog = () => {
        setResult(null);
        setNavStack([]);
    };

    const handleToolClick = async (toolId: string, toolLabel: string) => {
        if (!selectedEnv) {
            addToast({ type: "error", message: "No environment selected" });
            return;
        }

        // Tools that require user input — show prompt first
        const inputTools: Record<string, InputPromptConfig> = {
            "clerk-find-user": { toolId: "clerk-find-user", label: "Email Address", placeholder: "user@example.com", field: "email" },
            "clerk-get-user": { toolId: "clerk-get-user", label: "User ID", placeholder: "user_xxxxxxxxxxxx", field: "userId" },
            "clerk-get-user-orgs": { toolId: "clerk-get-user-orgs", label: "User ID", placeholder: "user_xxxxxxxxxxxx", field: "userId" },
            "clerk-list-sessions": { toolId: "clerk-list-sessions", label: "User ID (optional)", placeholder: "user_xxxxxxxxxxxx or leave empty", field: "userId" },
            "clerk-create-token": { toolId: "clerk-create-token", label: "Session ID", placeholder: "sess_xxxxxxxxxxxx", field: "sessionId" },
            "clerk-revoke-session": { toolId: "clerk-revoke-session", label: "Session ID", placeholder: "sess_xxxxxxxxxxxx", field: "sessionId" },
            "clerk-ban-user": { toolId: "clerk-ban-user", label: "User ID", placeholder: "user_xxxxxxxxxxxx", field: "userId" },
            "clerk-update-metadata": { toolId: "clerk-update-metadata", label: "User ID", placeholder: "user_xxxxxxxxxxxx", field: "userId" },
            "clerk-list-org-members": { toolId: "clerk-list-org-members", label: "Organization ID", placeholder: "org_xxxxxxxxxxxx", field: "organizationId" },
            "clerk-verify-jwt": { toolId: "clerk-verify-jwt", label: "JWT Token", placeholder: "eyJhbGciOi...", field: "token" },
        };

        if (inputTools[toolId]) {
            setResultTitle(toolLabel);
            setInputPrompt(inputTools[toolId]);
            setInputValue("");
            return;
        }

        await executeTool(toolId, toolLabel);
    };

    const executeToolWithInput = async () => {
        if (!inputPrompt) return;
        const { toolId } = inputPrompt;
        setInputPrompt(null);
        await executeTool(toolId, resultTitle, inputValue);
    };

    const executeTool = async (toolId: string, toolLabel: string, inputVal?: string) => {
        if (!selectedEnv) return;

        setLoading(toolId);
        setResultTitle(toolLabel);
        setNavStack([]);

        try {
            switch (toolId) {
                // ── Clerk Tools ─────────────────────────────────────────────
                case "clerk-verify-key": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    const data = await clerkVerifyKey(getSecret("secretKey"));
                    setResult({ type: "clerk-verify", data });
                    break;
                }
                case "clerk-list-orgs": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    const data = await clerkListOrganizations(getSecret("secretKey"));
                    setResult({ type: "clerk-orgs", data });
                    break;
                }
                case "clerk-list-users": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    const data = await clerkListUsers(getSecret("secretKey"));
                    setResult({ type: "clerk-users", data });
                    break;
                }
                case "clerk-find-user": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    if (!inputVal) { addToast({ type: "error", message: "Email is required" }); break; }
                    const data = await clerkFindUserByEmail(getSecret("secretKey"), inputVal);
                    setResult({ type: "clerk-users", data });
                    break;
                }
                case "clerk-get-user": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    if (!inputVal) { addToast({ type: "error", message: "User ID is required" }); break; }
                    const data = await clerkGetUser(getSecret("secretKey"), inputVal);
                    setResult({ type: "clerk-user-detail", data });
                    break;
                }
                case "clerk-get-user-orgs": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    if (!inputVal) { addToast({ type: "error", message: "User ID is required" }); break; }
                    const data = await clerkGetUserOrgs(getSecret("secretKey"), inputVal);
                    setResult({ type: "clerk-user-orgs", data });
                    break;
                }
                case "clerk-list-sessions": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    const data = await clerkListSessions(getSecret("secretKey"), inputVal || undefined);
                    setResult({ type: "clerk-sessions", data });
                    break;
                }
                case "clerk-create-token": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    if (!inputVal) { addToast({ type: "error", message: "Session ID is required" }); break; }
                    const data = await clerkCreateSessionToken(getSecret("secretKey"), inputVal);
                    setResult({ type: "clerk-token", data });
                    break;
                }
                case "clerk-revoke-session": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    if (!inputVal) { addToast({ type: "error", message: "Session ID is required" }); break; }
                    const data = await clerkRevokeSession(getSecret("secretKey"), inputVal);
                    setResult({ type: "clerk-session-revoked", data });
                    break;
                }
                case "clerk-ban-user": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    if (!inputVal) { addToast({ type: "error", message: "User ID is required" }); break; }
                    // First fetch user to check current ban status
                    const user = await clerkGetUser(getSecret("secretKey"), inputVal);
                    if (user.banned) {
                        const unbanned = await clerkUnbanUser(getSecret("secretKey"), inputVal);
                        setResult({ type: "clerk-user-unbanned", data: unbanned });
                    } else {
                        const banned = await clerkBanUser(getSecret("secretKey"), inputVal);
                        setResult({ type: "clerk-user-banned", data: banned });
                    }
                    break;
                }
                case "clerk-update-metadata": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    if (!inputVal) { addToast({ type: "error", message: "User ID is required" }); break; }
                    // Fetch user to get current metadata, then show editor via result view
                    const userData = await clerkGetUser(getSecret("secretKey"), inputVal);
                    setResult({ type: "clerk-metadata-updated", data: userData });
                    break;
                }
                case "clerk-list-org-members": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    if (!inputVal) { addToast({ type: "error", message: "Organization ID is required" }); break; }
                    const membersData = await clerkListOrgMembers(getSecret("secretKey"), inputVal);
                    setResult({ type: "clerk-org-members", data: membersData });
                    break;
                }
                case "clerk-verify-jwt": {
                    if (!inputVal) { addToast({ type: "error", message: "JWT token is required" }); break; }
                    // Build JWKS URL from publishable key if available
                    const pk = getSecret("publishableKey");
                    let jwksUrl: string | undefined;
                    if (pk) {
                        // Clerk publishable key format: pk_test_xxxx or pk_live_xxxx
                        // The frontend API domain is base64-decoded from the suffix after pk_test_ or pk_live_
                        const parts = pk.split("_");
                        if (parts.length >= 3) {
                            const encoded = parts.slice(2).join("_");
                            try {
                                const domain = atob(encoded).replace(/\$$/, "");
                                jwksUrl = `https://${domain}/.well-known/jwks.json`;
                            } catch {
                                // If base64 decode fails, skip JWKS verification
                            }
                        }
                    }
                    const jwtResult = await clerkVerifyJwt(inputVal, jwksUrl);
                    setResult({ type: "clerk-jwt", data: jwtResult });
                    break;
                }
                case "clerk-list-invitations": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    const invData = await clerkListInvitations(getSecret("secretKey"));
                    setResult({ type: "clerk-invitations", data: invData });
                    break;
                }
                case "clerk-webhooks": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    const svixData = await clerkGetSvixUrl(getSecret("secretKey"));
                    setResult({ type: "clerk-webhooks", data: svixData });
                    break;
                }
                case "clerk-jwks": {
                    if (!checkRequiredSecrets(["publishableKey"])) break;
                    const jwksData = await clerkGetJwks(getSecret("publishableKey"));
                    setResult({ type: "clerk-jwks", data: jwksData });
                    break;
                }
                case "clerk-allowblock": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    const sk = getSecret("secretKey");
                    const [allowlist, blocklist] = await Promise.all([
                        clerkListAllowlist(sk),
                        clerkListBlocklist(sk),
                    ]);
                    setResult({ type: "clerk-allowblock", data: { allowlist, blocklist } });
                    break;
                }
                case "clerk-instance": {
                    if (!checkRequiredSecrets(["secretKey"])) break;
                    const instanceData = await clerkGetInstance(getSecret("secretKey"));
                    setResult({ type: "clerk-instance", data: instanceData });
                    break;
                }

                // ── Cognito Tools ───────────────────────────────────────────
                case "cognito-validate": {
                    if (!checkRequiredSecrets(["userPoolId", "region"])) break;
                    const data = await cognitoValidate(
                        getSecret("userPoolId"),
                        getSecret("region")
                    );
                    setResult({ type: "cognito-validate", data });
                    break;
                }
                case "cognito-get-token": {
                    if (!checkRequiredSecrets(["clientId", "clientSecret", "region"])) break;
                    const data = await cognitoGetToken(
                        getSecret("clientId"),
                        getSecret("clientSecret"),
                        getSecret("region")
                    );
                    addToast({
                        type: "success",
                        message: `Token received (expires in ${data.expires_in}s)`,
                    });
                    break;
                }
                default:
                    addToast({ type: "info", message: `${toolLabel} — coming soon` });
            }
        } catch (err) {
            setResult({
                type: "error",
                message: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setLoading(null);
        }
    };

    if (tools.length === 0) return null;

    // ── Result action handler — drills into a follow-up command ──────
    const handleResultAction = async (action: string, id: string) => {
        if (!selectedEnv) return;
        if (!checkRequiredSecrets(["secretKey"])) return;
        const sk = getSecret("secretKey");

        setLoading(action);
        try {
            switch (action) {
                case "view-user": {
                    pushNav();
                    const data = await clerkGetUser(sk, id);
                    setResult({ type: "clerk-user-detail", data });
                    setResultTitle("User Detail");
                    break;
                }
                case "ban-user": {
                    pushNav();
                    const data = await clerkBanUser(sk, id);
                    setResult({ type: "clerk-user-banned", data });
                    setResultTitle("User Banned");
                    break;
                }
                case "unban-user": {
                    pushNav();
                    const data = await clerkUnbanUser(sk, id);
                    setResult({ type: "clerk-user-unbanned", data });
                    setResultTitle("User Unbanned");
                    break;
                }
                case "edit-metadata": {
                    pushNav();
                    const userData = await clerkGetUser(sk, id);
                    setResult({ type: "clerk-metadata-updated", data: userData });
                    setResultTitle("Update Metadata");
                    break;
                }
                case "view-user-orgs": {
                    pushNav();
                    const data = await clerkGetUserOrgs(sk, id);
                    setResult({ type: "clerk-user-orgs", data });
                    setResultTitle("User Organizations");
                    break;
                }
                case "view-org-detail": {
                    pushNav();
                    const orgDetail = await clerkGetOrganization(sk, id);
                    setResult({ type: "clerk-org-detail", data: orgDetail });
                    setResultTitle("Organization Details");
                    break;
                }
                case "view-org-members": {
                    pushNav();
                    const members = await clerkListOrgMembers(sk, id);
                    setResult({ type: "clerk-org-members", data: members });
                    setResultTitle("Organization Members");
                    break;
                }
                case "view-user-sessions": {
                    pushNav();
                    const data = await clerkListSessions(sk, id);
                    setResult({ type: "clerk-sessions", data });
                    setResultTitle("User Sessions");
                    break;
                }
                case "session-create-token": {
                    // Fetch user's orgs to offer org-scoped token option
                    try {
                        const currentSessions = (result as Extract<ToolResult, { type: "clerk-sessions" }>);
                        const session = currentSessions?.data?.data?.find((s: ClerkSession) => s.id === id);
                        const userId = session?.user_id;
                        if (userId) {
                            const orgsResult = await clerkGetUserOrgs(sk, userId);
                            if (orgsResult.data.length > 0) {
                                setOrgTokenPicker({
                                    sessionId: id,
                                    userId,
                                    orgs: orgsResult.data.map(m => m.organization),
                                    loading: false,
                                });
                                break;
                            }
                        }
                    } catch {
                        // If we can't fetch orgs, just create token without org scope
                    }
                    pushNav();
                    const data = await clerkCreateSessionToken(sk, id);
                    setResult({ type: "clerk-token", data });
                    setResultTitle("Session Token");
                    break;
                }
                case "session-revoke": {
                    pushNav();
                    const data = await clerkRevokeSession(sk, id);
                    setResult({ type: "clerk-session-revoked", data });
                    setResultTitle("Session Revoked");
                    break;
                }
                case "revoke-invitation": {
                    pushNav();
                    const revokedInv = await clerkRevokeInvitation(sk, id);
                    setResult({ type: "clerk-invitation-revoked", data: revokedInv });
                    setResultTitle("Invitation Revoked");
                    break;
                }
                case "delete-user": {
                    pushNav();
                    await clerkDeleteUser(sk, id);
                    setResult({ type: "clerk-user-deleted", data: { userId: id } });
                    setResultTitle("User Deleted");
                    break;
                }
                case "view-user-emails": {
                    pushNav();
                    const userData = await clerkGetUser(sk, id);
                    setResult({ type: "clerk-user-emails", data: userData });
                    setResultTitle("Email Addresses");
                    break;
                }
                case "user-get-token": {
                    // id = user_id — fetch active sessions, then create token
                    const sessions = await clerkListSessions(sk, id, "active");
                    const activeSession = sessions.data.find(s => s.status === "active");
                    if (!activeSession) {
                        pushNav();
                        setResult({ type: "error", message: "No active session found for this user. The user needs to sign in first." });
                        setResultTitle("No Active Session");
                        break;
                    }
                    try {
                        const orgsResult = await clerkGetUserOrgs(sk, id);
                        if (orgsResult.data.length > 0) {
                            setOrgTokenPicker({
                                sessionId: activeSession.id,
                                userId: id,
                                orgs: orgsResult.data.map(m => m.organization),
                                loading: false,
                            });
                            break;
                        }
                    } catch {
                        // No orgs
                    }
                    pushNav();
                    const tokenData = await clerkCreateSessionToken(sk, activeSession.id);
                    setResult({ type: "clerk-token", data: tokenData });
                    setResultTitle("User Token");
                    break;
                }
            }
        } catch (err) {
            setResult({
                type: "error",
                message: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setLoading(null);
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Wrench className="h-5 w-5" />
                                {info.name} Tools
                            </CardTitle>
                            <CardDescription>
                                Provider-specific actions for {info.name}
                            </CardDescription>
                        </div>

                        {/* Environment selector */}
                        {environments.length > 0 && (
                            <div className="relative">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowEnvPicker(!showEnvPicker)}
                                    className="min-w-35 justify-between"
                                >
                                    <span className="text-xs">
                                        {selectedEnv?.name || "Select env"}
                                    </span>
                                    <ChevronDown className="h-3.5 w-3.5 ml-2 opacity-50" />
                                </Button>
                                {showEnvPicker && (
                                    <div className="absolute right-0 top-full mt-1 z-50 min-w-40 rounded-md border bg-popover p-1 shadow-md">
                                        {environments.map((env) => (
                                            <button
                                                key={env.id}
                                                type="button"
                                                className={`w-full rounded-sm px-3 py-1.5 text-left text-xs hover:bg-accent cursor-pointer ${env.id === selectedEnvId ? "bg-accent font-medium" : ""
                                                    }`}
                                                onClick={() => {
                                                    setSelectedEnvId(env.id);
                                                    setShowEnvPicker(false);
                                                }}
                                            >
                                                {env.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {tools.map((tool) => {
                            const Icon = iconMap[tool.icon] || Wrench;
                            const isLoading = loading === tool.id;
                            return (
                                <button
                                    key={tool.id}
                                    type="button"
                                    disabled={isLoading || !selectedEnv}
                                    onClick={() => handleToolClick(tool.id, tool.label)}
                                    className="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className={`mt-0.5 ${info.color}`}>
                                        {isLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Icon className="h-4 w-4" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{tool.label}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {tool.description}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Result Dialog */}
            <Dialog open={result !== null} onOpenChange={closeDialog}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            {navStack.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 shrink-0"
                                    onClick={goBack}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                            )}
                            <div className="min-w-0">
                                <DialogTitle>{resultTitle}</DialogTitle>
                                <DialogDescription>
                                    {navStack.length > 0 ? (
                                        <span className="text-xs">
                                            {navStack.map(n => n.title).join(" → ")} → {resultTitle}
                                        </span>
                                    ) : (
                                        <span>Results from {selectedEnv?.name || "environment"}</span>
                                    )}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    {loading && (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin mr-2 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Loading…</span>
                        </div>
                    )}
                    {result && !loading && (
                        <ToolResultView
                            result={result}
                            onAction={handleResultAction}
                            secretKey={getSecret("secretKey")}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Org-Scoped Token Picker Dialog */}
            <Dialog open={orgTokenPicker !== null} onOpenChange={() => setOrgTokenPicker(null)}>
                <DialogContent className="max-w-sm max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Create Session Token</DialogTitle>
                        <DialogDescription>
                            Choose scope and expiry for the token
                        </DialogDescription>
                    </DialogHeader>
                    {orgTokenPicker && (
                        <OrgTokenPicker
                            picker={orgTokenPicker}
                            onSelect={async (orgId, expiresIn) => {
                                if (!selectedEnv) return;
                                setOrgTokenPicker({ ...orgTokenPicker, loading: true });
                                try {
                                    const data = await clerkCreateSessionToken(
                                        getSecret("secretKey"),
                                        orgTokenPicker.sessionId,
                                        orgId,
                                        expiresIn,
                                    );
                                    setOrgTokenPicker(null);
                                    pushNav();
                                    setResult({ type: "clerk-token", data });
                                    setResultTitle(orgId ? "Org-Scoped Token" : "Personal Token");
                                } catch (err) {
                                    setOrgTokenPicker(null);
                                    setResult({ type: "error", message: err instanceof Error ? err.message : String(err) });
                                }
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Input Prompt Dialog */}
            <Dialog open={inputPrompt !== null} onOpenChange={() => setInputPrompt(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{resultTitle}</DialogTitle>
                        <DialogDescription>
                            Enter the required value to continue
                        </DialogDescription>
                    </DialogHeader>
                    {inputPrompt && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{inputPrompt.label}</label>
                                <Input
                                    placeholder={inputPrompt.placeholder}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") executeToolWithInput(); }}
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setInputPrompt(null)}>
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={executeToolWithInput}>
                                    Run
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
};

// ─── Org Token Picker with Expiry Control ────────────────────────────────────

const EXPIRY_OPTIONS = [
    { label: "Default (60s)", value: undefined },
    { label: "5 minutes", value: 300 },
    { label: "1 hour", value: 3600 },
    { label: "24 hours", value: 86400 },
    { label: "7 days", value: 604800 },
    { label: "30 days", value: 2592000 },
] as const;

const OrgTokenPicker: React.FC<{
    picker: OrgTokenPickerState;
    onSelect: (orgId?: string, expiresIn?: number) => void;
}> = ({ picker, onSelect }) => {
    const [expiryIdx, setExpiryIdx] = useState(0);
    const [orgSearch, setOrgSearch] = useState("");
    const expiry = EXPIRY_OPTIONS[expiryIdx].value;

    const filteredOrgs = useMemo(() => {
        if (!orgSearch.trim()) return picker.orgs;
        const q = orgSearch.toLowerCase();
        return picker.orgs.filter(
            (org) =>
                org.name.toLowerCase().includes(q) ||
                (org.slug && org.slug.toLowerCase().includes(q))
        );
    }, [picker.orgs, orgSearch]);

    return (
        <div className="space-y-4 min-h-0 flex flex-col">
            {/* Expiry selector — always visible */}
            <div className="space-y-2 shrink-0">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5" />
                    Token Expiry
                </label>
                <div className="flex flex-wrap gap-1.5">
                    {EXPIRY_OPTIONS.map((opt, i) => (
                        <button
                            key={i}
                            type="button"
                            className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${expiryIdx === i
                                ? "bg-primary text-primary-foreground border-primary"
                                : "hover:bg-accent border-border"
                                }`}
                            onClick={() => setExpiryIdx(i)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-2 min-h-0 flex flex-col">
                <label className="text-xs font-medium text-muted-foreground shrink-0">Organization Scope</label>

                {/* Search orgs — show when 4+ orgs */}
                {picker.orgs.length >= 4 && (
                    <div className="relative shrink-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search organizations…"
                            value={orgSearch}
                            onChange={(e) => setOrgSearch(e.target.value)}
                            className="pl-8 h-8 text-xs"
                        />
                    </div>
                )}

                {/* Scrollable org list */}
                <div className="overflow-y-auto max-h-60 space-y-1.5 pr-1">
                    {/* Personal token — always first */}
                    <Button
                        variant="outline"
                        className="w-full justify-start h-auto py-3 shrink-0"
                        disabled={picker.loading}
                        onClick={() => onSelect(undefined, expiry)}
                    >
                        <User className="h-4 w-4 mr-2.5 shrink-0 text-muted-foreground" />
                        <div className="text-left">
                            <p className="text-sm font-medium">Personal Token</p>
                            <p className="text-xs text-muted-foreground">No organization scope</p>
                        </div>
                    </Button>

                    {filteredOrgs.length === 0 && orgSearch.trim() ? (
                        <div className="flex flex-col items-center py-4 text-muted-foreground">
                            <Search className="h-5 w-5 mb-1.5 opacity-30" />
                            <p className="text-xs">No orgs matching "{orgSearch}"</p>
                        </div>
                    ) : (
                        filteredOrgs.map((org) => (
                            <Button
                                key={org.id}
                                variant="outline"
                                className="w-full justify-start h-auto py-3"
                                disabled={picker.loading}
                                onClick={() => onSelect(org.id, expiry)}
                            >
                                <Building2 className="h-4 w-4 mr-2.5 shrink-0 text-muted-foreground" />
                                <div className="text-left min-w-0">
                                    <p className="text-sm font-medium truncate">{org.name}</p>
                                    {org.slug && <p className="text-xs text-muted-foreground truncate">{org.slug}</p>}
                                </div>
                            </Button>
                        ))
                    )}
                </div>

                {/* Count indicator */}
                {picker.orgs.length >= 4 && (
                    <p className="text-[10px] text-muted-foreground text-center shrink-0">
                        {filteredOrgs.length} of {picker.orgs.length} organization{picker.orgs.length !== 1 ? "s" : ""}
                    </p>
                )}
            </div>

            {picker.loading && (
                <div className="flex items-center justify-center py-2 shrink-0">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Generating token…</span>
                </div>
            )}
        </div>
    );
};

// ─── Tool Result Renderers ───────────────────────────────────────────────────

const ToolResultView: React.FC<{
    result: ToolResult;
    onAction: (action: string, id: string) => void;
    secretKey?: string;
}> = ({ result, onAction, secretKey }) => {
    switch (result.type) {
        case "error":
            return (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-destructive">Error</p>
                        <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
                    </div>
                </div>
            );

        case "clerk-verify":
            return <ClerkVerifyView data={result.data} />;

        case "clerk-orgs":
            return <ClerkOrgsView data={result.data} onAction={onAction} />;

        case "clerk-users":
            return <ClerkUsersView data={result.data} onAction={onAction} />;

        case "clerk-user-detail":
            return <ClerkUserDetailView data={result.data} onAction={onAction} />;

        case "clerk-user-emails":
            return <ClerkEmailsView data={result.data} />;

        case "clerk-user-orgs":
            return <ClerkUserOrgsView data={result.data} />;

        case "clerk-sessions":
            return <ClerkSessionsView data={result.data} onAction={onAction} />;

        case "clerk-token":
            return <ClerkTokenView data={result.data} />;

        case "clerk-session-revoked":
            return <ClerkSessionRevokedView data={result.data} />;

        case "clerk-user-banned":
            return <ClerkBanResultView data={result.data} banned={true} onAction={onAction} />;

        case "clerk-user-unbanned":
            return <ClerkBanResultView data={result.data} banned={false} onAction={onAction} />;

        case "clerk-metadata-updated":
            return <ClerkMetadataEditorView data={result.data} secretKey={secretKey || ""} />;

        case "clerk-org-detail":
            return <ClerkOrgDetailView data={result.data} onAction={onAction} secretKey={secretKey || ""} />;

        case "clerk-org-invitation-sent":
            return <ClerkOrgInvitationSentView data={result.data} />;

        case "clerk-org-members":
            return <ClerkOrgMembersView data={result.data} onAction={onAction} />;

        case "clerk-jwt":
            return <ClerkJwtView data={result.data} />;

        case "clerk-invitations":
            return <ClerkInvitationsView data={result.data} onAction={onAction} />;

        case "clerk-invitation-revoked":
            return <ClerkInvitationRevokedView data={result.data} />;

        case "clerk-webhooks":
            return <ClerkWebhooksView data={result.data} />;

        case "clerk-jwks":
            return <ClerkJwksView data={result.data} />;

        case "clerk-allowblock":
            return <ClerkAllowBlockView data={result.data} secretKey={secretKey || ""} />;

        case "clerk-instance":
            return <ClerkInstanceView data={result.data} />;

        case "clerk-user-deleted":
            return <ClerkUserDeletedView data={result.data} />;

        case "cognito-validate":
            return <CognitoValidateView data={result.data} />;
    }
};

// ─── Clerk Verify ────────────────────────────────────────────────────────────

const ClerkVerifyView: React.FC<{ data: ClerkVerifyResult }> = ({ data }) => (
    <div className="space-y-3">
        <div
            className={`flex items-start gap-3 rounded-lg border p-4 ${data.valid
                ? "border-green-500/50 bg-green-500/10"
                : "border-destructive/50 bg-destructive/10"
                }`}
        >
            {data.valid ? (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            ) : (
                <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            )}
            <div className="space-y-1">
                <p className="text-sm font-medium">
                    {data.valid ? "Key is valid" : "Key is invalid"}
                </p>
                {data.error && (
                    <p className="text-sm text-muted-foreground">{data.error}</p>
                )}
            </div>
        </div>
        {data.valid && (
            <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Instance Type" value={data.instance_type || "—"} />
                <InfoCard label="Total Users" value={data.user_count !== null ? data.user_count.toString() : "—"} />
            </div>
        )}
    </div>
);

// ─── Clerk JWT Verification ──────────────────────────────────────────────────

const ClerkJwtView: React.FC<{ data: ClerkJwtResult }> = ({ data }) => {
    const addToast = useToastStore((s) => s.addToast);
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        addToast({ type: "success", message: "Copied to clipboard" });
    };

    const expiresIn = data.expires_at
        ? (() => {
            const diff = data.expires_at * 1000 - Date.now();
            if (diff <= 0) return "Expired";
            const mins = Math.floor(diff / 60000);
            const hrs = Math.floor(mins / 60);
            if (hrs > 0) return `${hrs}h ${mins % 60}m remaining`;
            return `${mins}m remaining`;
        })()
        : null;

    return (
        <div className="space-y-3">
            {/* Status banner */}
            <div className={`flex items-center gap-2 rounded-lg border p-3 ${data.valid
                ? "border-green-500/50 bg-green-500/10"
                : data.expired
                    ? "border-amber-500/50 bg-amber-500/10"
                    : "border-destructive/50 bg-destructive/10"
                }`}>
                {data.valid ? (
                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                ) : data.expired ? (
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                ) : (
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                )}
                <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                        {data.valid ? "Valid Token" : data.expired ? "Token Expired" : "Invalid Token"}
                    </p>
                    {data.error && (
                        <p className="text-xs text-muted-foreground">{data.error}</p>
                    )}
                </div>
            </div>

            {/* Verification details */}
            <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 rounded-md border p-2.5">
                    <Shield className={`h-4 w-4 ${data.signature_verified ? "text-green-500" : "text-muted-foreground"}`} />
                    <div>
                        <p className="text-xs text-muted-foreground">Signature</p>
                        <p className="text-sm font-medium">{data.signature_verified ? "Verified" : "Not Verified"}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 rounded-md border p-2.5">
                    <Timer className={`h-4 w-4 ${data.expired ? "text-amber-500" : "text-green-500"}`} />
                    <div>
                        <p className="text-xs text-muted-foreground">Expiry</p>
                        <p className="text-sm font-medium">{expiresIn || "No expiry"}</p>
                    </div>
                </div>
            </div>

            {/* Timestamps */}
            {(data.issued_at || data.expires_at) && (
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {data.issued_at && (
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Issued: {new Date(data.issued_at * 1000).toLocaleString()}
                        </span>
                    )}
                    {data.expires_at && (
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires: {new Date(data.expires_at * 1000).toLocaleString()}
                        </span>
                    )}
                </div>
            )}

            {/* Header */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Header</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => copyToClipboard(JSON.stringify(data.header, null, 2))}
                    >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                    </Button>
                </div>
                <pre className="rounded-md border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-32">
                    {JSON.stringify(data.header, null, 2)}
                </pre>
            </div>

            {/* Payload */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payload (Claims)</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => copyToClipboard(JSON.stringify(data.payload, null, 2))}
                    >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                    </Button>
                </div>
                <pre className="rounded-md border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-64">
                    {JSON.stringify(data.payload, null, 2)}
                </pre>
            </div>
        </div>
    );
};

// ─── Clerk Invitations ───────────────────────────────────────────────────────

const ClerkInvitationsView: React.FC<{
    data: ClerkListResult<ClerkInvitation>;
    onAction: (action: string, id: string) => void;
}> = ({ data, onAction }) => {
    const statusColor = (status: string) => {
        switch (status) {
            case "pending": return "bg-amber-500/10 text-amber-600 border-amber-500/30";
            case "accepted": return "bg-green-500/10 text-green-600 border-green-500/30";
            case "revoked": return "bg-red-500/10 text-red-600 border-red-500/30";
            default: return "";
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{data.total_count} invitation{data.total_count !== 1 ? "s" : ""}</span>
            </div>
            {data.data.length === 0 ? (
                <EmptyState icon={Mail} message="No invitations found" />
            ) : (
                <div className="rounded-lg border divide-y">
                    {data.data.map((inv) => (
                        <div key={inv.id} className="p-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <Mail className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{inv.email_address}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{inv.id}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className={`text-xs capitalize ${statusColor(inv.status)}`}>
                                        {inv.status}
                                    </Badge>
                                    {inv.status === "pending" && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                            onClick={() => onAction("revoke-invitation", inv.id)}
                                        >
                                            <Ban className="h-3 w-3 mr-1" />
                                            Revoke
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 pl-10 text-xs text-muted-foreground">
                                {inv.created_at && (
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(inv.created_at).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ClerkInvitationRevokedView: React.FC<{ data: ClerkInvitation }> = ({ data }) => (
    <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
            <Ban className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
                <p className="text-sm font-medium">Invitation Revoked</p>
                <p className="text-sm text-muted-foreground mt-1">{data.email_address}</p>
            </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {data.id}
            </span>
            <Badge variant="secondary" className="text-xs capitalize bg-red-500/10 text-red-600 border-red-500/30">
                {data.status}
            </Badge>
        </div>
    </div>
);

// ─── Clerk Webhooks (SVIX Dashboard) ─────────────────────────────────────────

const ClerkWebhooksView: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
    const svixUrl = data.svix_url as string | undefined;

    const handleOpen = async () => {
        if (svixUrl) {
            try {
                await openUrl(svixUrl);
            } catch {
                // Fallback: copy to clipboard
                await navigator.clipboard.writeText(svixUrl);
            }
        }
    };

    if (!svixUrl) {
        return (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                    <p className="text-sm font-medium">Webhooks Not Available</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        SVIX webhook integration is not enabled for this Clerk instance.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Webhook Dashboard Ready</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Your SVIX webhook dashboard URL has been generated. Click below to open it in your browser.
                    </p>
                </div>
            </div>

            <Button onClick={handleOpen} className="w-full gap-2">
                <ExternalLink className="h-4 w-4" />
                Open Webhook Dashboard
            </Button>

            <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Dashboard URL</p>
                <p className="text-xs font-mono break-all text-muted-foreground">{svixUrl.slice(0, 80)}…</p>
            </div>
        </div>
    );
};

// ─── Clerk JWKS Viewer ───────────────────────────────────────────────────────

const ClerkJwksView: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
    const keys = (data.keys as Array<Record<string, unknown>>) ?? [];
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

    const handleCopyKey = async (key: Record<string, unknown>, idx: number) => {
        await navigator.clipboard.writeText(JSON.stringify(key, null, 2));
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    };

    if (keys.length === 0) {
        return (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                    <p className="text-sm font-medium">No Keys Found</p>
                    <p className="text-sm text-muted-foreground mt-1">The JWKS endpoint returned no keys.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <KeyRound className="h-4 w-4" />
                <span>{keys.length} key{keys.length !== 1 ? "s" : ""}</span>
            </div>
            {keys.map((key, idx) => (
                <div key={String(key.kid ?? idx)} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs font-mono">{String(key.kty ?? "—")}</Badge>
                            <Badge variant="secondary" className="text-xs font-mono">{String(key.alg ?? "—")}</Badge>
                            {key.use !== undefined && <Badge variant="secondary" className="text-xs">{String(key.use)}</Badge>}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyKey(key, idx)}
                            className="h-7 px-2"
                        >
                            {copiedIdx === idx ? (
                                <><CheckCircle className="h-3 w-3 mr-1 text-green-500" /> Copied</>
                            ) : (
                                <><Copy className="h-3 w-3 mr-1" /> Copy</>
                            )}
                        </Button>
                    </div>
                    <div className="space-y-2">
                        <div>
                            <p className="text-xs text-muted-foreground">Key ID (kid)</p>
                            <p className="text-sm font-mono break-all">{String(key.kid ?? "—")}</p>
                        </div>
                        {key.n !== undefined && (
                            <div>
                                <p className="text-xs text-muted-foreground">Modulus (n)</p>
                                <p className="text-xs font-mono break-all text-muted-foreground max-h-16 overflow-hidden">
                                    {String(key.n).slice(0, 120)}…
                                </p>
                            </div>
                        )}
                        {key.e !== undefined && (
                            <div>
                                <p className="text-xs text-muted-foreground">Exponent (e)</p>
                                <p className="text-sm font-mono">{String(key.e)}</p>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ─── Clerk Organizations ─────────────────────────────────────────────────────

const ClerkOrgsView: React.FC<{
    data: ClerkListResult<ClerkOrg>;
    onAction: (action: string, id: string) => void;
}> = ({ data, onAction }) => (
    <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>{data.total_count} organization{data.total_count !== 1 ? "s" : ""}</span>
        </div>
        {data.data.length === 0 ? (
            <EmptyState icon={Building2} message="No organizations found" />
        ) : (
            <div className="rounded-lg border divide-y">
                {data.data.map((org) => (
                    <button
                        type="button"
                        key={org.id}
                        className="w-full p-3 space-y-1.5 text-left hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => onAction("view-org-detail", org.id)}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                    <Building2 className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{org.name}</p>
                                    {org.slug && (
                                        <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {org.members_count !== null && (
                                    <Badge variant="secondary" className="text-xs">
                                        {org.members_count} member{org.members_count !== 1 ? "s" : ""}
                                    </Badge>
                                )}
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 pl-10 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                {org.id.length > 20 ? `${org.id.slice(0, 20)}…` : org.id}
                            </span>
                            {org.created_at && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(org.created_at).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </button>
                ))}
            </div>
        )}
    </div>
);

// ─── Clerk Organization Detail ───────────────────────────────────────────────

const ClerkOrgDetailView: React.FC<{
    data: Record<string, unknown>;
    onAction: (action: string, id: string) => void;
    secretKey: string;
}> = ({ data, onAction, secretKey }) => {
    const name = data.name as string | undefined;
    const slug = data.slug as string | undefined;
    const id = data.id as string;
    const logo = data.image_url as string | undefined;
    const hasImage = data.has_image as boolean | undefined;
    const membersCount = data.members_count as number | undefined;
    const pendingInvitationsCount = data.pending_invitations_count as number | undefined;
    const maxAllowedMemberships = data.max_allowed_memberships as number | undefined;
    const adminDeleteEnabled = data.admin_delete_enabled as boolean | undefined;
    const createdAt = data.created_at as number | undefined;
    const updatedAt = data.updated_at as number | undefined;
    const publicMetadata = data.public_metadata as Record<string, unknown> | undefined;
    const privateMetadata = data.private_metadata as Record<string, unknown> | undefined;

    const [showInviteForm, setShowInviteForm] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("org:member");
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const addToast = useToastStore((s) => s.addToast);

    const handleInvite = async () => {
        if (!inviteEmail.trim() || !secretKey) return;
        setInviteLoading(true);
        setInviteError(null);
        setInviteSuccess(null);
        try {
            await clerkCreateOrgInvitation(secretKey, id, inviteEmail.trim(), inviteRole);
            setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`);
            setInviteEmail("");
            addToast({ type: "success", message: `Invited ${inviteEmail.trim()} as ${inviteRole.replace("org:", "")}` });
        } catch (err) {
            setInviteError(err instanceof Error ? err.message : String(err));
        } finally {
            setInviteLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header with logo */}
            <div className="flex items-center gap-4">
                {hasImage && logo ? (
                    <img src={logo} alt={name} className="h-14 w-14 rounded-lg object-cover border" />
                ) : (
                    <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-7 w-7 text-primary" />
                    </div>
                )}
                <div>
                    <h3 className="text-lg font-semibold">{name}</h3>
                    {slug && <p className="text-sm text-muted-foreground font-mono">/{slug}</p>}
                </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Members</p>
                    <p className="text-sm font-medium">{membersCount ?? "—"}</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Pending Invitations</p>
                    <p className="text-sm font-medium">{pendingInvitationsCount ?? "—"}</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Max Memberships</p>
                    <p className="text-sm font-medium">{maxAllowedMemberships ?? "Unlimited"}</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Admin Delete</p>
                    <p className="text-sm font-medium">{adminDeleteEnabled ? "Enabled" : "Disabled"}</p>
                </div>
            </div>

            {/* ID */}
            <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="h-3 w-3" />Organization ID</p>
                <p className="text-sm font-mono break-all">{id}</p>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-3">
                {createdAt && (
                    <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Created</p>
                        <p className="text-sm">{new Date(createdAt).toLocaleString()}</p>
                    </div>
                )}
                {updatedAt && (
                    <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Updated</p>
                        <p className="text-sm">{new Date(updatedAt).toLocaleString()}</p>
                    </div>
                )}
            </div>

            {/* Metadata */}
            {publicMetadata && Object.keys(publicMetadata).length > 0 && (
                <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Public Metadata</p>
                    <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto max-h-40">
                        {JSON.stringify(publicMetadata, null, 2)}
                    </pre>
                </div>
            )}
            {privateMetadata && Object.keys(privateMetadata).length > 0 && (
                <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Private Metadata</p>
                    <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto max-h-40">
                        {JSON.stringify(privateMetadata, null, 2)}
                    </pre>
                </div>
            )}

            {/* Actions */}
            <div className="rounded-lg border divide-y">
                <button
                    type="button"
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => onAction("view-org-members", id)}
                >
                    <div className="flex items-center gap-2.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">View Members</span>
                        {membersCount != null && (
                            <Badge variant="secondary" className="text-xs">{membersCount}</Badge>
                        )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
                <button
                    type="button"
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setShowInviteForm((v) => !v)}
                >
                    <div className="flex items-center gap-2.5">
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Invite Member</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showInviteForm ? "rotate-180" : ""}`} />
                </button>
            </div>

            {/* Inline Invite Form */}
            {showInviteForm && (
                <div className="rounded-lg border p-4 space-y-3">
                    <p className="text-sm font-medium">Invite to {name}</p>
                    <Input
                        type="email"
                        placeholder="Email address"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                        <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            <option value="org:member">Member</option>
                            <option value="org:admin">Admin</option>
                        </select>
                    </div>
                    {inviteSuccess && (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            {inviteSuccess}
                        </div>
                    )}
                    {inviteError && (
                        <div className="flex items-center gap-2 text-sm text-destructive">
                            <XCircle className="h-4 w-4" />
                            {inviteError}
                        </div>
                    )}
                    <Button
                        size="sm"
                        onClick={handleInvite}
                        disabled={!inviteEmail.trim() || inviteLoading}
                    >
                        {inviteLoading ? (
                            <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Sending…</>
                        ) : (
                            <><Mail className="h-3 w-3 mr-1" /> Send Invitation</>
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
};

// ─── Clerk Org Invitation Sent ───────────────────────────────────────────────

const ClerkOrgInvitationSentView: React.FC<{ data: Record<string, unknown> }> = ({ data }) => (
    <div className="flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
        <div>
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Invitation Sent</p>
            <p className="text-sm text-muted-foreground mt-1">
                Invited <span className="font-medium">{data.email_address as string}</span> as{" "}
                <span className="font-medium">{(data.role as string)?.replace("org:", "")}</span>
            </p>
        </div>
    </div>
);

// ─── Clerk Users (with search) ───────────────────────────────────────────────

const ClerkUsersView: React.FC<{
    data: ClerkListResult<ClerkUser>;
    onAction: (action: string, id: string) => void;
}> = ({ data, onAction }) => {
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        if (!search.trim()) return data.data;
        const q = search.toLowerCase();
        return data.data.filter((user) => {
            const name = [user.first_name, user.last_name].filter(Boolean).join(" ").toLowerCase();
            const email = user.email_addresses[0]?.email_address?.toLowerCase() || "";
            return name.includes(q) || email.includes(q) || user.id.toLowerCase().includes(q);
        });
    }, [data.data, search]);

    return (
        <div className="space-y-3">
            {/* Header with count */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{data.total_count} user{data.total_count !== 1 ? "s" : ""}</span>
                </div>
                {filtered.length !== data.data.length && (
                    <span className="text-xs text-muted-foreground">
                        Showing {filtered.length} of {data.data.length}
                    </span>
                )}
            </div>

            {/* Search bar */}
            {data.data.length > 0 && (
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, email, or ID…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 h-8 text-xs"
                    />
                </div>
            )}

            {data.data.length === 0 ? (
                <EmptyState icon={Users} message="No users found" />
            ) : filtered.length === 0 ? (
                <EmptyState icon={Search} message={`No users matching "${search}"`} />
            ) : (
                <div className="rounded-lg border divide-y">
                    {filtered.map((user) => {
                        const email = user.email_addresses[0]?.email_address;
                        const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
                        const initials = [user.first_name, user.last_name]
                            .filter(Boolean)
                            .map(n => n!.charAt(0).toUpperCase())
                            .join("") || "?";

                        return (
                            <button
                                key={user.id}
                                type="button"
                                className="flex items-center gap-3 p-3 w-full text-left hover:bg-accent/50 transition-colors cursor-pointer group"
                                onClick={() => onAction("view-user", user.id)}
                            >
                                {/* Avatar */}
                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                                    {initials}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{name || "Unnamed"}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {email && (
                                            <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                <Mail className="h-3 w-3 shrink-0" />
                                                {email}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Right side */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="text-right hidden sm:block">
                                        <span className="text-[10px] text-muted-foreground leading-none">
                                            {user.last_sign_in_at
                                                ? new Date(user.last_sign_in_at).toLocaleDateString()
                                                : "Never"}
                                        </span>
                                    </div>
                                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Clerk User Detail ───────────────────────────────────────────────────────

const ClerkUserDetailView: React.FC<{
    data: ClerkUserDetail;
    onAction: (action: string, id: string) => void;
}> = ({ data, onAction }) => {
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || "Unnamed";
    const initials = [data.first_name, data.last_name]
        .filter(Boolean)
        .map(n => n!.charAt(0).toUpperCase())
        .join("") || "?";
    const statusColor = data.banned
        ? "text-destructive bg-destructive/10 border-destructive/30"
        : data.locked
            ? "text-yellow-600 bg-yellow-500/10 border-yellow-500/30"
            : "text-green-600 bg-green-500/10 border-green-500/30";
    const statusLabel = data.banned ? "Banned" : data.locked ? "Locked" : "Active";

    return (
        <div className="space-y-4">
            {/* Profile header */}
            <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-base font-semibold text-primary">
                    {initials}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-base font-semibold truncate">{name}</p>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColor}`}>
                            {statusLabel}
                        </Badge>
                    </div>
                    {data.email_addresses[0] && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3" />
                            {data.email_addresses[0].email_address}
                        </p>
                    )}
                    {data.username && (
                        <p className="text-xs text-muted-foreground">@{data.username}</p>
                    )}
                </div>
            </div>

            {/* ID badge */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-md font-mono">
                <Hash className="h-3 w-3 shrink-0" />
                <span className="truncate">{data.id}</span>
                <CopyButton text={data.id} />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
                <MiniCard
                    icon={Calendar}
                    label="Created"
                    value={data.created_at ? new Date(data.created_at).toLocaleDateString() : "—"}
                />
                <MiniCard
                    icon={Activity}
                    label="Last Active"
                    value={data.last_active_at ? new Date(data.last_active_at).toLocaleDateString() : "—"}
                />
                <MiniCard
                    icon={Clock}
                    label="Last Sign In"
                    value={data.last_sign_in_at ? new Date(data.last_sign_in_at).toLocaleDateString() : "Never"}
                />
                <MiniCard
                    icon={Shield}
                    label="Updated"
                    value={data.updated_at ? new Date(data.updated_at).toLocaleDateString() : "—"}
                />
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => onAction("view-user-emails", data.id)}
                >
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                    Emails
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => onAction("view-user-orgs", data.id)}
                >
                    <Building2 className="h-3.5 w-3.5 mr-1.5" />
                    Orgs
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => onAction("view-user-sessions", data.id)}
                >
                    <Activity className="h-3.5 w-3.5 mr-1.5" />
                    Sessions
                </Button>
                <Button
                    size="sm"
                    className="h-9"
                    onClick={() => onAction("user-get-token", data.id)}
                >
                    <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                    Get Token
                </Button>
                <Button
                    variant={data.banned ? "outline" : "destructive"}
                    size="sm"
                    className="h-9"
                    onClick={() => onAction(data.banned ? "unban-user" : "ban-user", data.id)}
                >
                    {data.banned ? (
                        <>
                            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                            Unban
                        </>
                    ) : (
                        <>
                            <UserX className="h-3.5 w-3.5 mr-1.5" />
                            Ban
                        </>
                    )}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => onAction("edit-metadata", data.id)}
                >
                    <FileEdit className="h-3.5 w-3.5 mr-1.5" />
                    Metadata
                </Button>
            </div>

            {/* Delete section */}
            <DeleteUserConfirmation
                userId={data.id}
                email={data.email_addresses[0]?.email_address || ""}
                onAction={onAction}
            />
        </div>
    );
};

// ─── Delete User Confirmation ────────────────────────────────────────────────

const DeleteUserConfirmation: React.FC<{
    userId: string;
    email: string;
    onAction: (action: string, id: string) => void;
}> = ({ userId, email, onAction }) => {
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmText, setConfirmText] = useState("");

    const expectedText = email || userId;
    const canDelete = confirmText === expectedText;

    if (!showConfirm) {
        return (
            <div className="pt-2 border-t">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowConfirm(true)}
                >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Delete User
                </Button>
            </div>
        );
    }

    return (
        <div className="pt-2 border-t space-y-2">
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2.5">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="text-xs">
                    <p className="font-medium text-destructive">This action is irreversible</p>
                    <p className="text-muted-foreground mt-0.5">
                        Type <span className="font-mono font-medium text-foreground">{expectedText}</span> to confirm
                    </p>
                </div>
            </div>
            <input
                type="text"
                placeholder={expectedText}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/50"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoFocus
            />
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8"
                    onClick={() => { setShowConfirm(false); setConfirmText(""); }}
                >
                    Cancel
                </Button>
                <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1 h-8"
                    disabled={!canDelete}
                    onClick={() => onAction("delete-user", userId)}
                >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete
                </Button>
            </div>
        </div>
    );
};

const ClerkUserDeletedView: React.FC<{ data: { userId: string } }> = ({ data }) => (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <Trash2 className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
        <div>
            <p className="text-sm font-medium text-destructive">User Permanently Deleted</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{data.userId}</p>
        </div>
    </div>
);

// ─── Clerk Allowlist / Blocklist ─────────────────────────────────────────────

const ClerkAllowBlockView: React.FC<{
    data: { allowlist: ClerkAllowBlockIdentifier[]; blocklist: ClerkAllowBlockIdentifier[] };
    secretKey: string;
}> = ({ data, secretKey }) => {
    const [tab, setTab] = useState<"allow" | "block">("allow");
    const [allowlist, setAllowlist] = useState(data.allowlist);
    const [blocklist, setBlocklist] = useState(data.blocklist);
    const [newIdentifier, setNewIdentifier] = useState("");
    const [adding, setAdding] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const addToast = useToastStore((s) => s.addToast);

    const list = tab === "allow" ? allowlist : blocklist;

    const handleAdd = async () => {
        if (!newIdentifier.trim()) return;
        setAdding(true);
        try {
            if (tab === "allow") {
                const item = await clerkAddAllowlist(secretKey, newIdentifier.trim());
                setAllowlist((prev) => [...prev, item]);
            } else {
                const item = await clerkAddBlocklist(secretKey, newIdentifier.trim());
                setBlocklist((prev) => [...prev, item]);
            }
            setNewIdentifier("");
            addToast({ type: "success", message: `Added to ${tab}list` });
        } catch (err) {
            addToast({ type: "error", message: err instanceof Error ? err.message : String(err) });
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (identifierId: string) => {
        setDeletingId(identifierId);
        try {
            if (tab === "allow") {
                await clerkDeleteAllowlist(secretKey, identifierId);
                setAllowlist((prev) => prev.filter((i) => i.id !== identifierId));
            } else {
                await clerkDeleteBlocklist(secretKey, identifierId);
                setBlocklist((prev) => prev.filter((i) => i.id !== identifierId));
            }
            addToast({ type: "success", message: `Removed from ${tab}list` });
        } catch (err) {
            addToast({ type: "error", message: err instanceof Error ? err.message : String(err) });
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex rounded-lg border overflow-hidden">
                <button
                    type="button"
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${tab === "allow"
                        ? "bg-green-500/10 text-green-600 border-b-2 border-green-500"
                        : "text-muted-foreground hover:bg-accent"
                        }`}
                    onClick={() => setTab("allow")}
                >
                    <CheckCircle className="h-3.5 w-3.5 inline mr-1.5" />
                    Allowlist ({allowlist.length})
                </button>
                <button
                    type="button"
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${tab === "block"
                        ? "bg-destructive/10 text-destructive border-b-2 border-destructive"
                        : "text-muted-foreground hover:bg-accent"
                        }`}
                    onClick={() => setTab("block")}
                >
                    <Ban className="h-3.5 w-3.5 inline mr-1.5" />
                    Blocklist ({blocklist.length})
                </button>
            </div>

            {/* Add form */}
            <div className="flex gap-2">
                <Input
                    placeholder="Email or domain (e.g. user@example.com, @example.com)"
                    value={newIdentifier}
                    onChange={(e) => setNewIdentifier(e.target.value)}
                    className="text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
                <Button
                    size="sm"
                    className="shrink-0"
                    onClick={handleAdd}
                    disabled={adding || !newIdentifier.trim()}
                >
                    {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                </Button>
            </div>

            {/* List */}
            {list.length === 0 ? (
                <EmptyState
                    icon={tab === "allow" ? CheckCircle : Ban}
                    message={`No ${tab}list entries`}
                />
            ) : (
                <div className="space-y-2">
                    {list.map((item) => (
                        <div
                            key={item.id || item.identifier}
                            className="flex items-center justify-between rounded-lg border p-3"
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{item.identifier || "—"}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                    {item.identifier_type && (
                                        <Badge variant="secondary" className="text-[10px]">
                                            {item.identifier_type}
                                        </Badge>
                                    )}
                                    {item.created_at && (
                                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                disabled={deletingId === item.id}
                                onClick={() => item.id && handleDelete(item.id)}
                            >
                                {deletingId === item.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                )}
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Clerk Instance Settings ─────────────────────────────────────────────────

const ClerkInstanceView: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
    // Extract known fields from the instance response
    const id = data.id as string | undefined;
    const environmentType = data.environment_type as string | undefined;
    const allowedOrigins = data.allowed_origins as string[] | undefined;
    const homeUrl = data.home_url as string | undefined;
    const signInUrl = data.sign_in_url as string | undefined;
    const signUpUrl = data.sign_up_url as string | undefined;
    const afterSignInUrl = data.after_sign_in_url as string | undefined;
    const afterSignUpUrl = data.after_sign_up_url as string | undefined;
    const supportEmail = data.support_email as string | undefined;
    const clerkJsVersion = data.clerk_js_version as string | undefined;
    const developmentOrigin = data.development_origin as string | undefined;
    const testMode = data.test_mode as boolean | undefined;

    const urlFields = [
        { label: "Home URL", value: homeUrl },
        { label: "Sign In URL", value: signInUrl },
        { label: "Sign Up URL", value: signUpUrl },
        { label: "After Sign In", value: afterSignInUrl },
        { label: "After Sign Up", value: afterSignUpUrl },
        { label: "Development Origin", value: developmentOrigin },
    ].filter((f) => f.value);

    return (
        <div className="space-y-4">
            {/* Environment badge + ID */}
            <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-base font-semibold">Instance Settings</span>
                {environmentType && (
                    <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${environmentType === "production"
                            ? "text-green-600 bg-green-500/10 border-green-500/30"
                            : "text-blue-600 bg-blue-500/10 border-blue-500/30"
                            }`}
                    >
                        {environmentType}
                    </Badge>
                )}
                {testMode && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-600 bg-yellow-500/10 border-yellow-500/30">
                        Test Mode
                    </Badge>
                )}
            </div>

            {id && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-md font-mono">
                    <Hash className="h-3 w-3 shrink-0" />
                    <span className="truncate">{id}</span>
                    <CopyButton text={id} />
                </div>
            )}

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-2">
                {supportEmail && (
                    <MiniCard icon={Mail} label="Support Email" value={supportEmail} />
                )}
                {clerkJsVersion && (
                    <MiniCard icon={Shield} label="Clerk.js" value={clerkJsVersion} />
                )}
            </div>

            {/* URL configuration */}
            {urlFields.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">URLs</p>
                    <div className="space-y-1.5">
                        {urlFields.map((f) => (
                            <div key={f.label} className="flex items-center justify-between rounded-md border px-3 py-2">
                                <span className="text-xs text-muted-foreground">{f.label}</span>
                                <span className="text-xs font-mono truncate ml-2 max-w-[60%] text-right">{f.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Allowed origins */}
            {allowedOrigins && allowedOrigins.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Allowed Origins</p>
                    <div className="flex flex-wrap gap-1.5">
                        {allowedOrigins.map((origin) => (
                            <Badge key={origin} variant="secondary" className="text-xs font-mono">
                                {origin}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Raw JSON fallback for any additional fields */}
            <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Raw Configuration</p>
                <pre className="text-[11px] bg-muted/50 p-3 rounded-md overflow-x-auto max-h-48 overflow-y-auto">
                    {JSON.stringify(data, null, 2)}
                </pre>
            </div>
        </div>
    );
};

// ─── Clerk Email Addresses ───────────────────────────────────────────────────

const ClerkEmailsView: React.FC<{ data: ClerkUserDetail }> = ({ data }) => {
    const emails = data.email_addresses;
    const primaryId = data.primary_email_address_id;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{emails.length} email address{emails.length !== 1 ? "es" : ""}</span>
            </div>
            {emails.length === 0 ? (
                <EmptyState icon={Mail} message="No email addresses" />
            ) : (
                <div className="space-y-2">
                    {emails.map((email, idx) => {
                        const isPrimary = email.id !== null && email.id === primaryId;
                        const verificationStatus = email.verification?.status || "unknown";
                        const verificationStrategy = email.verification?.strategy;
                        const isVerified = verificationStatus === "verified";

                        return (
                            <div key={email.id || idx} className="rounded-lg border p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Mail className="h-4 w-4 text-primary shrink-0" />
                                        <span className="text-sm font-medium truncate">{email.email_address}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {isPrimary && (
                                            <Badge variant="default" className="text-[10px] px-1.5 py-0">
                                                Primary
                                            </Badge>
                                        )}
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] px-1.5 py-0 ${isVerified
                                                ? "text-green-600 bg-green-500/10 border-green-500/30"
                                                : "text-yellow-600 bg-yellow-500/10 border-yellow-500/30"
                                                }`}
                                        >
                                            {verificationStatus}
                                        </Badge>
                                    </div>
                                </div>

                                {/* Details row */}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                    {verificationStrategy && (
                                        <span>Strategy: <span className="font-mono">{verificationStrategy}</span></span>
                                    )}
                                    {email.id && (
                                        <span className="flex items-center gap-1">
                                            ID: <span className="font-mono">{email.id}</span>
                                            <CopyButton text={email.id} />
                                        </span>
                                    )}
                                </div>

                                {/* Linked identities */}
                                {email.linked_to && email.linked_to.length > 0 && (
                                    <div className="pt-1 border-t">
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Linked Identities</p>
                                        <div className="flex flex-wrap gap-1">
                                            {email.linked_to.map((link, linkIdx) => (
                                                <Badge key={link.id || linkIdx} variant="secondary" className="text-[10px] font-mono">
                                                    {link.identity_type || "unknown"}: {link.id ? link.id.slice(0, 12) + "…" : "—"}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Clerk User Orgs ─────────────────────────────────────────────────────────

const ClerkUserOrgsView: React.FC<{ data: ClerkListResult<ClerkUserOrgMembership> }> = ({ data }) => (
    <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>{data.total_count} membership{data.total_count !== 1 ? "s" : ""}</span>
        </div>
        {data.data.length === 0 ? (
            <EmptyState icon={Building2} message="No organization memberships" />
        ) : (
            <div className="space-y-2">
                {data.data.map((m) => (
                    <div key={m.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                    <Building2 className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{m.organization.name}</p>
                                    {m.organization.slug && (
                                        <p className="text-xs text-muted-foreground font-mono">{m.organization.slug}</p>
                                    )}
                                </div>
                            </div>
                            <Badge
                                variant="secondary"
                                className={`text-xs capitalize ${m.role === "admin" || m.role === "org:admin"
                                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                    : ""
                                    }`}
                            >
                                {m.role.replace("org:", "")}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-3 pl-10 text-xs text-muted-foreground">
                            {m.organization.members_count !== null && (
                                <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {m.organization.members_count} member{m.organization.members_count !== 1 ? "s" : ""}
                                </span>
                            )}
                            {m.created_at && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Joined {new Date(m.created_at).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

// ─── Clerk Organization Members ──────────────────────────────────────────────

const ClerkOrgMembersView: React.FC<{
    data: ClerkListResult<ClerkOrgMember>;
    onAction: (action: string, id: string) => void;
}> = ({ data, onAction }) => (
    <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{data.total_count} member{data.total_count !== 1 ? "s" : ""}</span>
        </div>
        {data.data.length === 0 ? (
            <EmptyState icon={Users} message="No members found" />
        ) : (
            <div className="rounded-lg border divide-y">
                {data.data.map((member) => {
                    const userData = member.public_user_data;
                    const name = userData
                        ? [userData.first_name, userData.last_name].filter(Boolean).join(" ") || "Unnamed"
                        : "Unnamed";
                    const email = userData?.identifier || "—";
                    const userId = userData?.user_id;

                    return (
                        <button
                            type="button"
                            key={member.id}
                            className="w-full p-3 space-y-1.5 text-left hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => userId && onAction("view-user", userId)}
                            disabled={!userId}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <User className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{name}</p>
                                        <p className="text-xs text-muted-foreground">{email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant="secondary"
                                        className={`text-xs capitalize ${member.role === "admin" || member.role === "org:admin"
                                            ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                            : ""
                                            }`}
                                    >
                                        {member.role.replace("org:", "")}
                                    </Badge>
                                    {userId && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 pl-10 text-xs text-muted-foreground">
                                {userId && (
                                    <span className="flex items-center gap-1">
                                        <Hash className="h-3 w-3" />
                                        {userId.length > 20 ? `${userId.slice(0, 20)}…` : userId}
                                    </span>
                                )}
                                {member.created_at && (
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Joined {new Date(member.created_at).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        )}
    </div>
);

// ─── Clerk Sessions ──────────────────────────────────────────────────────────

const ClerkSessionsView: React.FC<{
    data: ClerkListResult<ClerkSession>;
    onAction: (action: string, id: string) => void;
}> = ({ data, onAction }) => (
    <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span>{data.total_count} session{data.total_count !== 1 ? "s" : ""}</span>
        </div>
        {data.data.length === 0 ? (
            <EmptyState icon={Activity} message="No sessions found" />
        ) : (
            <div className="space-y-2">
                {data.data.map((s) => {
                    const isActive = s.status === "active";
                    return (
                        <div key={s.id} className={`rounded-lg border p-3 space-y-2 ${isActive ? "border-green-500/20" : ""}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className={`h-2 w-2 rounded-full shrink-0 ${isActive ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                                    <p className="text-xs font-mono text-muted-foreground truncate">{s.id}</p>
                                </div>
                                <Badge
                                    variant={isActive ? "default" : "secondary"}
                                    className="text-[10px] capitalize"
                                >
                                    {s.status}
                                </Badge>
                            </div>
                            <div className="flex gap-4 text-xs text-muted-foreground pl-4">
                                <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {s.user_id.length > 18 ? `${s.user_id.slice(0, 18)}…` : s.user_id}
                                </span>
                                {s.last_active_at && (
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {new Date(s.last_active_at).toLocaleString()}
                                    </span>
                                )}
                            </div>
                            {isActive && (
                                <div className="flex gap-2 pt-1 pl-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => onAction("session-create-token", s.id)}
                                    >
                                        <KeyRound className="h-3 w-3 mr-1" />
                                        Create Token
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs text-destructive hover:text-destructive"
                                        onClick={() => onAction("session-revoke", s.id)}
                                    >
                                        <Ban className="h-3 w-3 mr-1" />
                                        Revoke
                                    </Button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        )}
    </div>
);

// ─── Clerk Token (with JWT decode) ───────────────────────────────────────────

const ClerkTokenView: React.FC<{ data: ClerkSessionToken }> = ({ data }) => {
    const claims = useMemo(() => decodeJwt(data.jwt), [data.jwt]);

    return (
        <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <div className="space-y-2 min-w-0 flex-1">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Token Generated</p>
                    <div className="relative">
                        <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-24">
                            {data.jwt}
                        </pre>
                        <CopyButton text={data.jwt} />
                    </div>
                </div>
            </div>

            {/* JWT Claims */}
            {claims && (
                <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5" />
                        JWT Claims
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {claims.sub && <MiniCard icon={User} label="Subject" value={claims.sub} />}
                        {claims.iss && <MiniCard icon={Shield} label="Issuer" value={claims.iss.replace("https://", "")} />}
                        {claims.iat && <MiniCard icon={Clock} label="Issued At" value={formatTimestamp(claims.iat)} />}
                        {claims.exp && (
                            <MiniCard
                                icon={Timer}
                                label="Expires"
                                value={`${formatTimestamp(claims.exp)} (${timeUntil(claims.exp)})`}
                            />
                        )}
                    </div>
                    {/* Org claims */}
                    {(claims.org_id || claims.org_slug || claims.org_role) && (
                        <div className="rounded-lg border p-2.5 space-y-1.5">
                            <p className="text-xs font-medium flex items-center gap-1.5">
                                <Building2 className="h-3 w-3" />
                                Organization Context
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                {claims.org_id && (
                                    <div>
                                        <span className="text-muted-foreground">ID: </span>
                                        <span className="font-mono">{String(claims.org_id)}</span>
                                    </div>
                                )}
                                {claims.org_slug && (
                                    <div>
                                        <span className="text-muted-foreground">Slug: </span>
                                        <span className="font-mono">{String(claims.org_slug)}</span>
                                    </div>
                                )}
                                {claims.org_role && (
                                    <div>
                                        <span className="text-muted-foreground">Role: </span>
                                        <Badge variant="secondary" className="text-[10px] px-1 py-0 capitalize">
                                            {String(claims.org_role).replace("org:", "")}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Clerk Session Revoked ───────────────────────────────────────────────────

const ClerkSessionRevokedView: React.FC<{ data: ClerkSession }> = ({ data }) => (
    <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
            <Ban className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Session Revoked</p>
                <p className="text-xs text-muted-foreground font-mono">{data.id}</p>
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <InfoCard label="Status" value={data.status} />
            <InfoCard label="User" value={data.user_id} />
        </div>
    </div>
);

// ─── Clerk Ban/Unban Result ──────────────────────────────────────────────────

const ClerkBanResultView: React.FC<{
    data: ClerkUserDetail;
    banned: boolean;
    onAction: (action: string, id: string) => void;
}> = ({ data, banned, onAction }) => {
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || "Unnamed";

    return (
        <div className="space-y-3">
            <div
                className={`flex items-start gap-3 rounded-lg border p-4 ${banned
                    ? "border-destructive/50 bg-destructive/10"
                    : "border-green-500/50 bg-green-500/10"
                    }`}
            >
                {banned ? (
                    <UserX className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                ) : (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                )}
                <div className="space-y-1">
                    <p className={`text-sm font-medium ${banned ? "text-destructive" : "text-green-700 dark:text-green-400"}`}>
                        {banned ? "User Banned" : "User Unbanned"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {name} ({data.email_addresses[0]?.email_address || data.id})
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <InfoCard label="User ID" value={data.id} />
                <InfoCard label="Status" value={banned ? "Banned" : "Active"} />
            </div>
            <Button
                variant={banned ? "outline" : "destructive"}
                size="sm"
                className="w-full"
                onClick={() => onAction(banned ? "unban-user" : "ban-user", data.id)}
            >
                {banned ? (
                    <>
                        <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                        Unban User
                    </>
                ) : (
                    <>
                        <UserX className="h-3.5 w-3.5 mr-1.5" />
                        Ban User
                    </>
                )}
            </Button>
        </div>
    );
};

// ─── Clerk Metadata Editor ───────────────────────────────────────────────────

const ClerkMetadataEditorView: React.FC<{
    data: ClerkUserDetail;
    secretKey: string;
}> = ({ data, secretKey }) => {
    const [activeTab, setActiveTab] = useState<"public" | "private" | "unsafe">("public");
    const [publicMeta, setPublicMeta] = useState(
        JSON.stringify(data.public_metadata || {}, null, 2)
    );
    const [privateMeta, setPrivateMeta] = useState(
        JSON.stringify(data.private_metadata || {}, null, 2)
    );
    const [unsafeMeta, setUnsafeMeta] = useState(
        JSON.stringify(data.unsafe_metadata || {}, null, 2)
    );
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const addToast = useToastStore((s) => s.addToast);

    const getCurrentValue = () => {
        switch (activeTab) {
            case "public": return publicMeta;
            case "private": return privateMeta;
            case "unsafe": return unsafeMeta;
        }
    };

    const setCurrentValue = (val: string) => {
        switch (activeTab) {
            case "public": setPublicMeta(val); break;
            case "private": setPrivateMeta(val); break;
            case "unsafe": setUnsafeMeta(val); break;
        }
    };

    const isValidJson = (str: string): boolean => {
        try { JSON.parse(str); return true; } catch { return false; }
    };

    const handleSave = async () => {
        setError(null);
        setSaved(false);

        if (!isValidJson(publicMeta)) { setError("Public metadata is not valid JSON"); return; }
        if (!isValidJson(privateMeta)) { setError("Private metadata is not valid JSON"); return; }
        if (!isValidJson(unsafeMeta)) { setError("Unsafe metadata is not valid JSON"); return; }

        setSaving(true);
        try {
            await clerkUpdateUserMetadata(
                secretKey,
                data.id,
                JSON.parse(publicMeta),
                JSON.parse(privateMeta),
                JSON.parse(unsafeMeta),
            );
            setSaved(true);
            addToast({ type: "success", message: "Metadata updated successfully" });
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSaving(false);
        }
    };

    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || "Unnamed";
    const tabs = [
        { key: "public" as const, label: "Public" },
        { key: "private" as const, label: "Private" },
        { key: "unsafe" as const, label: "Unsafe" },
    ];

    return (
        <div className="space-y-3">
            {/* User header */}
            <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{name}</span>
                <span className="text-xs text-muted-foreground font-mono">{data.id}</span>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 border-b">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        className={`px-3 py-1.5 text-xs font-medium border-b-2 cursor-pointer transition-colors ${activeTab === tab.key
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* JSON editor */}
            <textarea
                className={`w-full h-40 rounded-md border bg-muted/30 p-3 font-mono text-xs resize-y focus:outline-none focus:ring-2 focus:ring-primary/50 ${!isValidJson(getCurrentValue()) ? "border-destructive" : ""
                    }`}
                value={getCurrentValue()}
                onChange={(e) => setCurrentValue(e.target.value)}
                spellCheck={false}
            />

            {!isValidJson(getCurrentValue()) && (
                <p className="text-xs text-destructive flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Invalid JSON
                </p>
            )}

            {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2.5">
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-xs text-destructive">{error}</p>
                </div>
            )}

            {saved && (
                <div className="flex items-center gap-2 rounded-md border border-green-500/50 bg-green-500/10 p-2.5">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    <p className="text-xs text-green-700 dark:text-green-400">Metadata saved successfully</p>
                </div>
            )}

            <Button
                size="sm"
                className="w-full"
                disabled={saving || !isValidJson(publicMeta) || !isValidJson(privateMeta) || !isValidJson(unsafeMeta)}
                onClick={handleSave}
            >
                {saving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                    <FileEdit className="h-3.5 w-3.5 mr-1.5" />
                )}
                {saving ? "Saving…" : "Save All Metadata"}
            </Button>
        </div>
    );
};

// ─── Cognito Validate ────────────────────────────────────────────────────────

const CognitoValidateView: React.FC<{ data: CognitoValidateResult }> = ({ data }) => (
    <div className="space-y-3">
        <div
            className={`flex items-start gap-3 rounded-lg border p-4 ${data.valid
                ? "border-green-500/50 bg-green-500/10"
                : "border-destructive/50 bg-destructive/10"
                }`}
        >
            {data.valid ? (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
            )}
            <div className="space-y-1">
                <p className="text-sm font-medium">
                    {data.valid ? "User Pool is reachable" : "Validation failed"}
                </p>
                {data.error && (
                    <p className="text-sm text-muted-foreground">{data.error}</p>
                )}
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <InfoCard label="Region" value={data.region} />
            <InfoCard label="User Pool ID" value={data.user_pool_id} />
        </div>
    </div>
);

// ─── Shared Components ───────────────────────────────────────────────────────

const EmptyState: React.FC<{ icon: React.FC<{ className?: string }>; message: string }> = ({ icon: Icon, message }) => (
    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
        <Icon className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">{message}</p>
    </div>
);

const InfoCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium mt-0.5 font-mono break-all">{value}</p>
    </div>
);

const MiniCard: React.FC<{
    icon: React.FC<{ className?: string }>;
    label: string;
    value: string;
}> = ({ icon: Icon, label, value }) => (
    <div className="rounded-md border p-2 space-y-0.5">
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Icon className="h-3 w-3" />
            {label}
        </p>
        <p className="text-xs font-medium font-mono break-all leading-tight">{value}</p>
    </div>
);

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            className="absolute top-1 right-1 p-1 rounded hover:bg-muted cursor-pointer"
            onClick={() => {
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }}
            title="Copy to clipboard"
        >
            {copied ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            )}
        </button>
    );
};
