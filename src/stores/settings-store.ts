import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light" | "system";

interface SettingsStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
    }),
    {
      name: "authpilot-settings",
      onRehydrateStorage: () => {
        return (state) => {
          if (state) applyTheme(state.theme);
        };
      },
    }
  )
);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", isDark);
  } else {
    root.classList.toggle("dark", theme === "dark");
  }
}

// Apply theme on load
const savedTheme = (() => {
  try {
    const stored = localStorage.getItem("authpilot-settings");
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.theme || "dark";
    }
  } catch { }
  return "dark";
})();
applyTheme(savedTheme);
