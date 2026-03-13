import React, { useState } from "react";
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
  Search,
  Activity,
  Ban,
  Copy,
  User,
  ExternalLink,
  ArrowRight,
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

  // Input prompt state for tools that require user input
  const [inputPrompt, setInputPrompt] = useState<InputPromptConfig | null>(null);
  const [inputValue, setInputValue] = useState("");

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
          const data = await clerkGetUser(sk, id);
          setResult({ type: "clerk-user-detail", data });
          setResultTitle("User Detail");
          break;
        }
        case "view-user-orgs": {
          const data = await clerkGetUserOrgs(sk, id);
          setResult({ type: "clerk-user-orgs", data });
          setResultTitle("User Organizations");
          break;
        }
        case "view-user-sessions": {
          const data = await clerkListSessions(sk, id);
          setResult({ type: "clerk-sessions", data });
          setResultTitle("User Sessions");
          break;
        }
        case "session-create-token": {
          const data = await clerkCreateSessionToken(sk, id);
          setResult({ type: "clerk-token", data });
          setResultTitle("Session Token");
          break;
        }
        case "session-revoke": {
          const data = await clerkRevokeSession(sk, id);
          setResult({ type: "clerk-session-revoked", data });
          setResultTitle("Session Revoked");
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
                  className="min-w-[140px] justify-between"
                >
                  <span className="text-xs">
                    {selectedEnv?.name || "Select env"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 ml-2 opacity-50" />
                </Button>
                {showEnvPicker && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md">
                    {environments.map((env) => (
                      <button
                        key={env.id}
                        type="button"
                        className={`w-full rounded-sm px-3 py-1.5 text-left text-xs hover:bg-accent cursor-pointer ${
                          env.id === selectedEnvId ? "bg-accent font-medium" : ""
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
      <Dialog open={result !== null} onOpenChange={() => setResult(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{resultTitle}</DialogTitle>
            <DialogDescription>
              Results from {selectedEnv?.name || "environment"}
            </DialogDescription>
          </DialogHeader>
          {result && <ToolResultView result={result} onAction={handleResultAction} />}
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
      return (
        <div className="space-y-3">
          <div
            className={`flex items-start gap-3 rounded-lg border p-4 ${
              result.data.valid
                ? "border-green-500/50 bg-green-500/10"
                : "border-destructive/50 bg-destructive/10"
            }`}
          >
            {result.data.valid ? (
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {result.data.valid ? "Key is valid" : "Key is invalid"}
              </p>
              {result.data.error && (
                <p className="text-sm text-muted-foreground">{result.data.error}</p>
              )}
            </div>
          </div>
          {result.data.valid && (
            <div className="grid grid-cols-2 gap-3">
              <InfoCard
                label="Instance Type"
                value={result.data.instance_type || "—"}
              />
              <InfoCard
                label="Total Users"
                value={
                  result.data.user_count !== null
                    ? result.data.user_count.toString()
                    : "—"
                }
              />
            </div>
          )}
        </div>
      );

    case "clerk-orgs":
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>
              {result.data.total_count} organization
              {result.data.total_count !== 1 ? "s" : ""}
            </span>
          </div>
          {result.data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No organizations found
            </p>
          ) : (
            <div className="rounded-lg border divide-y">
              {result.data.data.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{org.name}</p>
                    {org.slug && (
                      <p className="text-xs text-muted-foreground font-mono">
                        {org.slug}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {org.members_count !== null && (
                      <Badge variant="secondary" className="text-xs">
                        {org.members_count} member
                        {org.members_count !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case "clerk-users":
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {result.data.total_count} user
              {result.data.total_count !== 1 ? "s" : ""}
            </span>
          </div>
          {result.data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No users found
            </p>
          ) : (
            <div className="rounded-lg border divide-y">
              {result.data.data.map((user) => {
                const email = user.email_addresses[0]?.email_address;
                const name = [user.first_name, user.last_name]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button
                    key={user.id}
                    type="button"
                    className="flex items-center justify-between p-3 w-full text-left hover:bg-accent transition-colors cursor-pointer group"
                    onClick={() => onAction("view-user", user.id)}
                  >
                    <div>
                      <p className="text-sm font-medium">{name || "—"}</p>
                      {email && (
                        <p className="text-xs text-muted-foreground">
                          {email}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {user.last_sign_in_at
                          ? `Last seen ${new Date(user.last_sign_in_at).toLocaleDateString()}`
                          : "Never signed in"}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );

    case "cognito-validate":
      return (
        <div className="space-y-3">
          <div
            className={`flex items-start gap-3 rounded-lg border p-4 ${
              result.data.valid
                ? "border-green-500/50 bg-green-500/10"
                : "border-destructive/50 bg-destructive/10"
            }`}
          >
            {result.data.valid ? (
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {result.data.valid
                  ? "User Pool is reachable"
                  : "Validation failed"}
              </p>
              {result.data.error && (
                <p className="text-sm text-muted-foreground">
                  {result.data.error}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="Region" value={result.data.region} />
            <InfoCard label="User Pool ID" value={result.data.user_pool_id} />
          </div>
        </div>
      );

    case "clerk-user-detail":
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {[result.data.first_name, result.data.last_name].filter(Boolean).join(" ") || "—"}
              </p>
              {result.data.email_addresses[0] && (
                <p className="text-xs text-muted-foreground">{result.data.email_addresses[0].email_address}</p>
              )}
              {result.data.username && (
                <p className="text-xs text-muted-foreground">@{result.data.username}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="User ID" value={result.data.id} />
            <InfoCard label="Status" value={result.data.banned ? "Banned" : result.data.locked ? "Locked" : "Active"} />
            <InfoCard label="Created" value={result.data.created_at ? new Date(result.data.created_at).toLocaleDateString() : "—"} />
            <InfoCard label="Last Active" value={result.data.last_active_at ? new Date(result.data.last_active_at).toLocaleDateString() : "—"} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onAction("view-user-orgs", result.data.id)}
            >
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              Organizations
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onAction("view-user-sessions", result.data.id)}
            >
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Sessions
            </Button>
          </div>
        </div>
      );

    case "clerk-user-orgs":
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>
              {result.data.total_count} membership{result.data.total_count !== 1 ? "s" : ""}
            </span>
          </div>
          {result.data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No organization memberships</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {result.data.data.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium">{m.organization.name}</p>
                    {m.organization.slug && (
                      <p className="text-xs text-muted-foreground font-mono">{m.organization.slug}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs capitalize">{m.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case "clerk-sessions":
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span>
              {result.data.total_count} session{result.data.total_count !== 1 ? "s" : ""}
            </span>
          </div>
          {result.data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No sessions found</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {result.data.data.map((s) => (
                <div key={s.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-mono text-muted-foreground">{s.id}</p>
                    <Badge
                      variant={s.status === "active" ? "default" : "secondary"}
                      className="text-xs capitalize"
                    >
                      {s.status}
                    </Badge>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>User: {s.user_id}</span>
                    {s.last_active_at && (
                      <span>Active: {new Date(s.last_active_at).toLocaleString()}</span>
                    )}
                  </div>
                  {s.status === "active" && (
                    <div className="flex gap-2 pt-1">
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
              ))}
            </div>
          )}
        </div>
      );

    case "clerk-token":
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-green-500/50 bg-green-500/10 p-4">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            <div className="space-y-1 min-w-0 flex-1">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">Token Generated</p>
              <div className="relative">
                <pre className="text-xs font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-32">
                  {result.data.jwt}
                </pre>
                <CopyButton text={result.data.jwt} />
              </div>
            </div>
          </div>
        </div>
      );

    case "clerk-session-revoked":
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
            <Ban className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Session Revoked</p>
              <p className="text-xs text-muted-foreground font-mono">{result.data.id}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="Status" value={result.data.status} />
            <InfoCard label="User" value={result.data.user_id} />
          </div>
        </div>
      );
  }
};

const InfoCard: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="rounded-lg border p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-medium mt-0.5 font-mono break-all">{value}</p>
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
