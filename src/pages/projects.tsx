import React, { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SecretField } from "@/components/shared/secret-field";
import { useProjectStore, type Project } from "@/stores/project-store";
import { useToastStore } from "@/stores/toast-store";
import {
  PROVIDER_TYPES,
  PROVIDER_INFO,
  PROVIDER_SECRET_FIELDS,
  type ProviderType,
} from "@/lib/providers";
import { ProviderToolsPanel } from "@/components/shared/provider-tools";
import {
  Plus,
  FolderKanban,
  Trash2,
  Edit3,
  ChevronRight,
  ArrowLeft,
  Globe,
  Shield,
  Cloud,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

// ─── Provider icon helper ────────────────────────────────────────────────────

const providerIcons: Record<ProviderType, React.FC<{ className?: string }>> = {
  clerk: Shield,
  cognito: Cloud,
  auth0: Shield,
};

// ─── Projects Page ───────────────────────────────────────────────────────────

export const ProjectsPage: React.FC = () => {
  const {
    projects,
    activeProjectId,
    addProject,
    updateProject,
    deleteProject,
    setActiveProject,
    addApp,
    deleteApp,
    addEnvironment,
    updateEnvironmentSecret,
    deleteEnvironment,
  } = useProjectStore();
  const addToast = useToastStore((s) => s.addToast);

  // Navigation state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  // Dialog state
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewApp, setShowNewApp] = useState(false);
  const [showNewEnv, setShowNewEnv] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form state
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newAppName, setNewAppName] = useState("");
  const [newAppDesc, setNewAppDesc] = useState("");
  const [newAppProvider, setNewAppProvider] = useState<ProviderType>("clerk");
  const [newEnvName, setNewEnvName] = useState("");
  const [newEnvSlug, setNewEnvSlug] = useState("");

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const selectedApp = selectedProject?.apps.find((a) => a.id === selectedAppId);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    addProject(newProjectName.trim(), newProjectDesc.trim());
    setNewProjectName("");
    setNewProjectDesc("");
    setShowNewProject(false);
    addToast({ type: "success", message: "Project created!" });
  };

  const handleUpdateProject = () => {
    if (!editingProject || !newProjectName.trim()) return;
    updateProject(editingProject.id, {
      name: newProjectName.trim(),
      description: newProjectDesc.trim(),
    });
    setEditingProject(null);
    setNewProjectName("");
    setNewProjectDesc("");
    addToast({ type: "success", message: "Project updated!" });
  };

  const handleDeleteProject = (id: string) => {
    deleteProject(id);
    if (selectedProjectId === id) {
      setSelectedProjectId(null);
      setSelectedAppId(null);
    }
    addToast({ type: "info", message: "Project deleted" });
  };

  const handleCreateApp = () => {
    if (!selectedProjectId || !newAppName.trim()) return;
    addApp(selectedProjectId, {
      name: newAppName.trim(),
      description: newAppDesc.trim(),
      provider: newAppProvider,
    });
    setNewAppName("");
    setNewAppDesc("");
    setNewAppProvider("clerk");
    setShowNewApp(false);
    addToast({ type: "success", message: "App created with default environments!" });
  };

  const handleCreateEnv = () => {
    if (!selectedProjectId || !selectedAppId || !newEnvName.trim()) return;
    addEnvironment(selectedProjectId, selectedAppId, {
      name: newEnvName.trim(),
      slug: newEnvSlug.trim() || newEnvName.trim().toLowerCase().replace(/\s+/g, "-"),
    });
    setNewEnvName("");
    setNewEnvSlug("");
    setShowNewEnv(false);
    addToast({ type: "success", message: "Environment created!" });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: App Detail (environments + provider tools)
  // ═══════════════════════════════════════════════════════════════════════════

  if (selectedProject && selectedApp) {
    const ProviderIcon = providerIcons[selectedApp.provider];
    const providerInfo = PROVIDER_INFO[selectedApp.provider];
    const secretFields = PROVIDER_SECRET_FIELDS[selectedApp.provider];

    return (
      <div className="flex flex-col h-full">
        <Header
          title={selectedApp.name}
          actions={
            <Badge className={providerInfo.color} variant="outline">
              <ProviderIcon className="h-3.5 w-3.5 mr-1" />
              {providerInfo.name}
            </Badge>
          }
        />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Back nav */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedAppId(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {selectedProject.name}
            </Button>
          </div>

          {/* Provider Tools */}
          <ProviderToolsPanel
            provider={selectedApp.provider}
            environments={selectedApp.environments}
          />

          {/* Environments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Environments
                </CardTitle>
                <CardDescription>
                  Configure {providerInfo.name} secrets per environment
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowNewEnv(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Environment
              </Button>
            </CardHeader>
            <CardContent>
              {selectedApp.environments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No environments yet. Add one to start configuring secrets.
                </p>
              ) : (
                <div className="space-y-4">
                  {selectedApp.environments.map((env) => {
                    const filledCount = Object.values(env.secrets).filter((v) => v.length > 0).length;
                    const totalCount = secretFields.length;

                    return (
                      <div key={env.id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{env.name}</Badge>
                            <span className="text-xs text-muted-foreground font-mono">{env.slug}</span>
                            <Badge
                              variant={filledCount === totalCount ? "success" : filledCount > 0 ? "secondary" : "outline"}
                              className="text-xs"
                            >
                              {filledCount}/{totalCount}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              deleteEnvironment(selectedProject.id, selectedApp.id, env.id)
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {secretFields.map((field) => (
                            <div key={field.key}>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                {field.label}
                              </label>
                              <SecretField
                                value={env.secrets[field.key] || ""}
                                label={field.label}
                                editable
                                initiallyHidden={field.sensitive}
                                onChange={(v) =>
                                  updateEnvironmentSecret(
                                    selectedProject.id,
                                    selectedApp.id,
                                    env.id,
                                    field.key,
                                    v
                                  )
                                }
                                placeholder={field.placeholder}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Add Environment Dialog */}
        <Dialog open={showNewEnv} onOpenChange={setShowNewEnv}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Environment</DialogTitle>
              <DialogDescription>
                Add a new environment to {selectedApp.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Environment name (e.g., QA)"
                value={newEnvName}
                onChange={(e) => setNewEnvName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateEnv()}
              />
              <Input
                placeholder="Slug (auto-generated if empty)"
                value={newEnvSlug}
                onChange={(e) => setNewEnvSlug(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateEnv()}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewEnv(false)}>Cancel</Button>
              <Button onClick={handleCreateEnv} disabled={!newEnvName.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: Project Detail (apps list)
  // ═══════════════════════════════════════════════════════════════════════════

  if (selectedProject) {
    return (
      <div className="flex flex-col h-full">
        <Header title={selectedProject.name} />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedProjectId(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              All Projects
            </Button>
            <div className="flex-1" />
            <Button
              variant={activeProjectId === selectedProject.id ? "secondary" : "outline"}
              size="sm"
              onClick={() =>
                setActiveProject(
                  activeProjectId === selectedProject.id ? null : selectedProject.id
                )
              }
            >
              {activeProjectId === selectedProject.id ? "Active Project" : "Set as Active"}
            </Button>
          </div>

          {selectedProject.description && (
            <p className="text-sm text-muted-foreground">{selectedProject.description}</p>
          )}

          {/* Apps */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Apps</CardTitle>
                <CardDescription>
                  Each app has its own auth provider and environments
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowNewApp(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add App
              </Button>
            </CardHeader>
            <CardContent>
              {selectedProject.apps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-sm text-muted-foreground mb-3">No apps yet</p>
                  <Button variant="outline" size="sm" onClick={() => setShowNewApp(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create your first app
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedProject.apps.map((app) => {
                    const info = PROVIDER_INFO[app.provider];
                    const Icon = providerIcons[app.provider];
                    const envCount = app.environments.length;
                    const secretFieldCount = PROVIDER_SECRET_FIELDS[app.provider].length;

                    // Per-environment fill check
                    const envsWithSecrets = app.environments.filter((env) =>
                      Object.values(env.secrets).some((v) => v.length > 0)
                    ).length;

                    return (
                      <div
                        key={app.id}
                        className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:border-primary/30 transition-colors"
                        onClick={() => setSelectedAppId(app.id)}
                      >
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ${info.color}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{app.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {info.name}
                            </Badge>
                          </div>
                          {app.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {app.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{envCount} env{envCount !== 1 ? "s" : ""}</span>
                            <span>{secretFieldCount} secret fields</span>
                            <span>
                              {envsWithSecrets === 0
                                ? "No secrets configured"
                                : `${envsWithSecrets}/${envCount} env${envCount !== 1 ? "s" : ""} configured`}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteApp(selectedProject.id, app.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Add App Dialog */}
        <Dialog open={showNewApp} onOpenChange={setShowNewApp}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add App</DialogTitle>
              <DialogDescription>
                Choose an auth provider. Default environments (Development, Staging, Production)
                will be created automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="App name"
                value={newAppName}
                onChange={(e) => setNewAppName(e.target.value)}
              />
              <Input
                placeholder="Description (optional)"
                value={newAppDesc}
                onChange={(e) => setNewAppDesc(e.target.value)}
              />
              {/* Provider selector */}
              <div>
                <label className="text-sm font-medium mb-2 block">Auth Provider</label>
                <div className="grid grid-cols-2 gap-3">
                  {PROVIDER_TYPES.map((type) => {
                    const info = PROVIDER_INFO[type];
                    const Icon = providerIcons[type];
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewAppProvider(type)}
                        className={`flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer ${newAppProvider === type
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent"
                          }`}
                      >
                        <Icon className={`h-5 w-5 ${info.color}`} />
                        <div className="text-left">
                          <p className="text-sm font-medium">{info.name}</p>
                          <p className="text-xs text-muted-foreground">{info.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewApp(false)}>Cancel</Button>
              <Button onClick={handleCreateApp} disabled={!newAppName.trim()}>Create App</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: Project List
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full">
      <Header title="Projects" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">All Projects</h2>
            <p className="text-sm text-muted-foreground">
              Manage your projects, apps, and auth provider environments
            </p>
          </div>
          <Button onClick={() => setShowNewProject(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Project
          </Button>
        </div>

        {projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <FolderKanban className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first project to get started.
              </p>
              <Button onClick={() => setShowNewProject(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => {
              const totalApps = project.apps.length;
              const totalEnvs = project.apps.reduce((s, a) => s + a.environments.length, 0);
              const providers = [...new Set(project.apps.map((a) => a.provider))];

              return (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle>{project.name}</CardTitle>
                        {activeProjectId === project.id && (
                          <Badge variant="success">Active</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingProject(project);
                            setNewProjectName(project.name);
                            setNewProjectDesc(project.description);
                          }}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteProject(project.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {project.description && (
                      <CardDescription>{project.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{totalApps} apps</span>
                      <span>{totalEnvs} envs</span>
                      {providers.length > 0 && (
                        <div className="flex items-center gap-1">
                          {providers.map((p) => {
                            const Icon = providerIcons[p];
                            const info = PROVIDER_INFO[p];
                            return (
                              <span key={p} title={info.name}>
                                <Icon className={`h-3.5 w-3.5 ${info.color}`} />
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <span className="ml-auto text-xs">{formatDate(project.createdAt)}</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* New Project Dialog */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Create a new project, then add apps with different auth providers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
            />
            <Input
              placeholder="Description (optional)"
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProject(false)}>Cancel</Button>
            <Button onClick={handleCreateProject} disabled={!newProjectName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={!!editingProject} onOpenChange={() => setEditingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <Input
              placeholder="Description"
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProject(null)}>Cancel</Button>
            <Button onClick={handleUpdateProject}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
