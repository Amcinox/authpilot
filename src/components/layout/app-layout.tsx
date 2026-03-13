import React from "react";
import { Outlet } from "react-router";
import { Sidebar } from "./sidebar";
import { ToastContainer } from "@/components/shared/toast";

export const AppLayout: React.FC = () => {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
};
