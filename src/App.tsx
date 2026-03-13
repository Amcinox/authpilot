import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { AppLayout } from "@/components/layout/app-layout";
import { ProjectsPage } from "@/pages/projects";
import { SettingsPage } from "@/pages/settings";
import { useProjectStore } from "@/stores/project-store";

const App: React.FC = () => {
  const hydrateSecrets = useProjectStore((s) => s.hydrateSecrets);

  useEffect(() => {
    hydrateSecrets();
  }, [hydrateSecrets]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
