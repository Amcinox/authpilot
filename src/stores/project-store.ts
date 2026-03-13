import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateId } from "@/lib/utils";
import { type ProviderType, getDefaultSecrets, PROVIDER_SECRET_FIELDS } from "@/lib/providers";
import { storeSecret, getSecret, deleteSecret } from "@/lib/tauri";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Environment {
  id: string;
  name: string;
  slug: string;
  secrets: Record<string, string>;
}

export interface App {
  id: string;
  name: string;
  description: string;
  provider: ProviderType;
  environments: Environment[];
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  apps: App[];
  createdAt: string;
}

// ─── Keychain Helpers ────────────────────────────────────────────────────────

const keychainKey = (appId: string, envId: string, field: string) =>
  `authpilot::${appId}::${envId}::${field}`;

async function safeKeychainStore(key: string, value: string): Promise<void> {
  try {
    await storeSecret(key, value);
  } catch {
    // Not in Tauri environment or keychain unavailable
  }
}

async function safeKeychainGet(key: string): Promise<string | null> {
  try {
    return await getSecret(key);
  } catch {
    return null;
  }
}

async function safeKeychainDelete(key: string): Promise<void> {
  try {
    await deleteSecret(key);
  } catch {
    // Not in Tauri environment or keychain unavailable
  }
}

function getSensitiveFields(provider: ProviderType) {
  return PROVIDER_SECRET_FIELDS[provider].filter((f) => f.sensitive);
}

// ─── Store Interface ─────────────────────────────────────────────────────────

interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;
  activeAppId: string | null;
  secretsLoaded: boolean;

  // Keychain hydration
  hydrateSecrets: () => Promise<void>;

  // Projects
  addProject: (name: string, description: string) => void;
  updateProject: (id: string, updates: Partial<Pick<Project, "name" | "description">>) => void;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;

  // Apps
  addApp: (projectId: string, app: { name: string; description: string; provider: ProviderType }) => void;
  updateApp: (projectId: string, appId: string, updates: Partial<Pick<App, "name" | "description">>) => void;
  deleteApp: (projectId: string, appId: string) => void;
  setActiveApp: (id: string | null) => void;

  // Environments (nested under apps)
  addEnvironment: (projectId: string, appId: string, env: { name: string; slug: string }) => void;
  updateEnvironmentSecret: (projectId: string, appId: string, envId: string, key: string, value: string) => void;
  deleteEnvironment: (projectId: string, appId: string, envId: string) => void;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function createDefaultEnvironments(provider: ProviderType): Environment[] {
  return [
    { id: generateId(), name: "Development", slug: "development", secrets: getDefaultSecrets(provider) },
    { id: generateId(), name: "Staging", slug: "staging", secrets: getDefaultSecrets(provider) },
    { id: generateId(), name: "Production", slug: "production", secrets: getDefaultSecrets(provider) },
  ];
}

// ─── Zustand Store ───────────────────────────────────────────────────────────

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      activeAppId: null,
      secretsLoaded: false,

      // ── Keychain Hydration ────────────────────────────────────────

      hydrateSecrets: async () => {
        const { projects } = get();
        const updates: Array<{
          projectId: string;
          appId: string;
          envId: string;
          key: string;
          value: string;
        }> = [];

        for (const project of projects) {
          for (const app of project.apps) {
            const sensitive = getSensitiveFields(app.provider);
            for (const env of app.environments) {
              for (const field of sensitive) {
                const value = await safeKeychainGet(
                  keychainKey(app.id, env.id, field.key)
                );
                if (value) {
                  updates.push({
                    projectId: project.id,
                    appId: app.id,
                    envId: env.id,
                    key: field.key,
                    value,
                  });
                }
              }
            }
          }
        }

        if (updates.length > 0) {
          set((state) => {
            const newProjects = state.projects.map((p) => ({
              ...p,
              apps: p.apps.map((a) => ({
                ...a,
                environments: a.environments.map((e) => {
                  const envUpdates = updates.filter(
                    (u) => u.appId === a.id && u.envId === e.id
                  );
                  if (envUpdates.length === 0) return e;
                  const newSecrets = { ...e.secrets };
                  for (const u of envUpdates) {
                    newSecrets[u.key] = u.value;
                  }
                  return { ...e, secrets: newSecrets };
                }),
              })),
            }));
            return { projects: newProjects, secretsLoaded: true };
          });
        } else {
          set({ secretsLoaded: true });
        }
      },

      // ── Projects ──────────────────────────────────────────────────

      addProject: (name, description) =>
        set((state) => ({
          projects: [
            ...state.projects,
            {
              id: generateId(),
              name,
              description,
              apps: [],
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),

      deleteProject: (id) => {
        // Clean up keychain entries for all apps/envs in this project
        const project = get().projects.find((p) => p.id === id);
        if (project) {
          for (const app of project.apps) {
            const sensitive = getSensitiveFields(app.provider);
            for (const env of app.environments) {
              for (const field of sensitive) {
                safeKeychainDelete(keychainKey(app.id, env.id, field.key));
              }
            }
          }
        }

        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
          activeAppId:
            state.projects.find((p) => p.id === id)?.apps.some((a) => a.id === state.activeAppId)
              ? null
              : state.activeAppId,
        }));
      },

      setActiveProject: (id) => set({ activeProjectId: id }),

      // ── Apps ──────────────────────────────────────────────────────

      addApp: (projectId, { name, description, provider }) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                ...p,
                apps: [
                  ...p.apps,
                  {
                    id: generateId(),
                    name,
                    description,
                    provider,
                    environments: createDefaultEnvironments(provider),
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
              : p
          ),
        })),

      updateApp: (projectId, appId, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, apps: p.apps.map((a) => (a.id === appId ? { ...a, ...updates } : a)) }
              : p
          ),
        })),

      deleteApp: (projectId, appId) => {
        // Clean up keychain entries for all envs in this app
        const app = get()
          .projects.find((p) => p.id === projectId)
          ?.apps.find((a) => a.id === appId);
        if (app) {
          const sensitive = getSensitiveFields(app.provider);
          for (const env of app.environments) {
            for (const field of sensitive) {
              safeKeychainDelete(keychainKey(appId, env.id, field.key));
            }
          }
        }

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, apps: p.apps.filter((a) => a.id !== appId) } : p
          ),
          activeAppId: state.activeAppId === appId ? null : state.activeAppId,
        }));
      },

      setActiveApp: (id) => set({ activeAppId: id }),

      // ── Environments ──────────────────────────────────────────────

      addEnvironment: (projectId, appId, { name, slug }) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                ...p,
                apps: p.apps.map((a) =>
                  a.id === appId
                    ? {
                      ...a,
                      environments: [
                        ...a.environments,
                        { id: generateId(), name, slug, secrets: getDefaultSecrets(a.provider) },
                      ],
                    }
                    : a
                ),
              }
              : p
          ),
        })),

      updateEnvironmentSecret: (projectId, appId, envId, key, value) => {
        // Update store immediately for responsive UI
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                ...p,
                apps: p.apps.map((a) =>
                  a.id === appId
                    ? {
                      ...a,
                      environments: a.environments.map((e) =>
                        e.id === envId ? { ...e, secrets: { ...e.secrets, [key]: value } } : e
                      ),
                    }
                    : a
                ),
              }
              : p
          ),
        }));

        // Store sensitive values in OS keychain (fire-and-forget)
        const app = get()
          .projects.find((p) => p.id === projectId)
          ?.apps.find((a) => a.id === appId);
        if (app) {
          const field = PROVIDER_SECRET_FIELDS[app.provider].find((f) => f.key === key);
          if (field?.sensitive) {
            if (value) {
              safeKeychainStore(keychainKey(appId, envId, key), value);
            } else {
              safeKeychainDelete(keychainKey(appId, envId, key));
            }
          }
        }
      },

      deleteEnvironment: (projectId, appId, envId) => {
        // Clean up keychain entries
        const app = get()
          .projects.find((p) => p.id === projectId)
          ?.apps.find((a) => a.id === appId);
        if (app) {
          const sensitive = getSensitiveFields(app.provider);
          for (const field of sensitive) {
            safeKeychainDelete(keychainKey(appId, envId, field.key));
          }
        }

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                ...p,
                apps: p.apps.map((a) =>
                  a.id === appId
                    ? { ...a, environments: a.environments.filter((e) => e.id !== envId) }
                    : a
                ),
              }
              : p
          ),
        }));
      },
    }),
    {
      name: "authpilot-projects",
      partialize: (state) => ({
        projects: state.projects.map((p) => ({
          ...p,
          apps: p.apps.map((a) => ({
            ...a,
            environments: a.environments.map((env) => ({
              ...env,
              // Strip sensitive values from localStorage — they live in keychain
              secrets: Object.fromEntries(
                Object.entries(env.secrets).map(([k, v]) => {
                  const field = PROVIDER_SECRET_FIELDS[a.provider].find((f) => f.key === k);
                  return [k, field?.sensitive ? "" : v];
                })
              ),
            })),
          })),
        })),
        activeProjectId: state.activeProjectId,
        activeAppId: state.activeAppId,
      }) as unknown as ProjectStore,
    }
  )
);
