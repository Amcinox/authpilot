import React, { useRef } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/stores/settings-store";
import { useProjectStore, type Project } from "@/stores/project-store";
import { useToastStore } from "@/stores/toast-store";
import { Moon, Sun, Monitor, Trash2, Database, Info, Download, Upload } from "lucide-react";

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useSettingsStore();
  const projects = useProjectStore((s) => s.projects);
  const addToast = useToastStore((s) => s.addToast);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalApps = projects.reduce((s, p) => s + p.apps.length, 0);
  const totalEnvs = projects.reduce(
    (s, p) => s + p.apps.reduce((sa, a) => sa + a.environments.length, 0),
    0
  );

  const handleClearData = () => {
    if (confirm("Are you sure? This will clear all local data including projects and settings.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleExport = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      projects,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `authpilot-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: "success", message: `Exported ${projects.length} project(s)` });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const raw = JSON.parse(evt.target?.result as string);

        // Validate structure
        if (!raw.projects || !Array.isArray(raw.projects)) {
          addToast({ type: "error", message: "Invalid export file — missing projects array" });
          return;
        }

        // Basic validation on each project
        const imported: Project[] = raw.projects;
        for (const p of imported) {
          if (!p.id || !p.name || !Array.isArray(p.apps)) {
            addToast({ type: "error", message: "Invalid project structure in file" });
            return;
          }
        }

        // Merge: add imported projects, skip duplicates by id
        const existingIds = new Set(projects.map((p) => p.id));
        const newProjects = imported.filter((p) => !existingIds.has(p.id));
        const duplicates = imported.length - newProjects.length;

        if (newProjects.length === 0) {
          addToast({ type: "info", message: "All projects already exist — nothing imported" });
          return;
        }

        // Use zustand setState directly to merge
        useProjectStore.setState((state) => ({
          projects: [...state.projects, ...newProjects],
        }));

        addToast({
          type: "success",
          message: `Imported ${newProjects.length} project(s)${duplicates > 0 ? ` (${duplicates} duplicate(s) skipped)` : ""}`,
        });
      } catch {
        addToast({ type: "error", message: "Failed to parse import file" });
      }

      // Reset input so same file can be re-imported
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const themeOptions = [
    { value: "dark", label: "Dark", icon: Moon },
    { value: "light", label: "Light", icon: Sun },
    { value: "system", label: "System", icon: Monitor },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      <Header title="Settings" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl">
        {/* Theme */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose your preferred theme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-1 flex-col items-center gap-2 rounded-lg border p-4 transition-colors cursor-pointer ${
                    theme === value
                      ? "border-primary bg-primary/5 text-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Management
            </CardTitle>
            <CardDescription>Manage your local data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Export projects</p>
                <p className="text-xs text-muted-foreground">
                  Download all projects as a JSON file (secrets excluded)
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={projects.length === 0}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Import projects</p>
                <p className="text-xs text-muted-foreground">
                  Merge projects from a previously exported file
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" />
                Import
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Clear all data</p>
                <p className="text-xs text-muted-foreground">
                  Remove all projects, apps, environments, and settings
                </p>
              </div>
              <Button variant="destructive" size="sm" onClick={handleClearData}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear Data
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              About
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono">0.1.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform</span>
                <span>Tauri v2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Projects</span>
                <span>{projects.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Apps</span>
                <span>{totalApps}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Environments</span>
                <span>{totalEnvs}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
