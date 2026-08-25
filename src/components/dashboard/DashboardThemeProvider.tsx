"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type DashboardTheme = "light" | "dark";

const STORAGE_KEY = "bs-dashboard-theme";

const DashboardThemeContext = createContext<{
  theme: DashboardTheme;
  toggle: () => void;
} | null>(null);

export function useDashboardTheme() {
  const ctx = useContext(DashboardThemeContext);
  if (!ctx) throw new Error("useDashboardTheme must be used within DashboardThemeProvider");
  return ctx;
}

function applyTheme(theme: DashboardTheme) {
  document.documentElement.setAttribute("data-dash-theme", theme);
}

export function DashboardThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<DashboardTheme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial: DashboardTheme = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: DashboardTheme = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <DashboardThemeContext.Provider value={{ theme, toggle }}>
      <div className="dashboard-shell flex min-h-screen">{children}</div>
    </DashboardThemeContext.Provider>
  );
}
