"use client";

import { Moon, Sun } from "lucide-react";
import { useDashboardTheme } from "@/components/dashboard/DashboardThemeProvider";
import { cn } from "@/lib/utils";

export function DashboardThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useDashboardTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "grid size-7 place-items-center rounded-md text-[var(--dash-subtle-fg)] transition hover:bg-[var(--dash-muted)] hover:text-[var(--dash-foreground)]",
        className,
      )}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
