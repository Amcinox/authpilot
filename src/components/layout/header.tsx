import React from "react";

export const Header: React.FC<{ title: string; actions?: React.ReactNode }> = ({ title, actions }) => {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
};
