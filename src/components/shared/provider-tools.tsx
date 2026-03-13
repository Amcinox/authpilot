import React, { useState, useMemo } from "react";
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
    ArrowRight,
    Clock,
    Shield,
    Mail,
    Hash,
    Calendar,
    Timer,
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
                case "view-user-orgs": {
                    pushNav();
                    const data = await clerkGetUserOrgs(sk, id);
                    setResult({ type: "clerk-user-orgs", data });
                    setResultTitle("User Organizations");
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
}> = ({ result, onAction }) => {
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
            return <ClerkOrgsView data={result.data} />;

        case "clerk-users":
            return <ClerkUsersView data={result.data} onAction={onAction} />;

        case "clerk-user-detail":
            return <ClerkUserDetailView data={result.data} onAction={onAction} />;

        case "clerk-user-orgs":
            return <ClerkUserOrgsView data={result.data} />;

        case "clerk-sessions":
            return <ClerkSessionsView data={result.data} onAction={onAction} />;

        case "clerk-token":
            return <ClerkTokenView data={result.data} />;

        case "clerk-session-revoked":
            return <ClerkSessionRevokedView data={result.data} />;

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

// ─── Clerk Organizations ─────────────────────────────────────────────────────

const ClerkOrgsView: React.FC<{ data: ClerkListResult<ClerkOrg> }> = ({ data }) => (
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
                    <div key={org.id} className="p-3 space-y-1.5">
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
                            {org.members_count !== null && (
                                <Badge variant="secondary" className="text-xs">
                                    {org.members_count} member{org.members_count !== 1 ? "s" : ""}
                                </Badge>
                            )}
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
                    </div>
                ))}
            </div>
        )}
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
            <div className="grid grid-cols-3 gap-2 pt-1">
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
            </div>
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
