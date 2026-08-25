"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryState } from "nuqs";
import { Logo } from "./Logo";
import { AuthChrome } from "@/components/auth/AuthChrome";
import { DOC_QUERY_KEY, hrefWithDoc } from "@/lib/wiki/doc-param";
import {
  IconBrightness,
  IconDarkMode,
  IconDownload,
  IconModule,
  IconSearch,
} from "@/components/icons/streamline";

const TABS = [
  { id: "design", label: "Design", path: "/wiki" },
  { id: "releases", label: "Releases", path: "/wiki/pipeline" },
  { id: "setup", label: "Setup", path: "/wiki/sync" },
] as const;

function tabActive(pathname: string, tabId: (typeof TABS)[number]["id"]): boolean {
  if (tabId === "design") {
    return (
      pathname.startsWith("/wiki") &&
      !pathname.startsWith("/wiki/pipeline") &&
      !pathname.startsWith("/wiki/releases") &&
      !pathname.startsWith("/wiki/sync") &&
      !pathname.startsWith("/wiki/governance")
    );
  }
  if (tabId === "releases") {
    return (
      pathname.startsWith("/wiki/pipeline") ||
      pathname.startsWith("/wiki/releases") ||
      pathname.startsWith("/wiki/governance")
    );
  }
  return pathname.startsWith("/wiki/sync");
}

interface TopNavProps {
  onToggleTheme: () => void;
  isDark: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  currentFileName: string;
}

export function TopNav({
  onToggleTheme,
  isDark,
  searchQuery,
  onSearchChange,
  currentFileName,
}: TopNavProps) {
  const pathname = usePathname();
  const [docParam] = useQueryState(DOC_QUERY_KEY);
  const doc = docParam ?? currentFileName;

  return (
    <header
      className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-4 border-b px-5"
      style={{
        borderColor: "var(--chrome-nav-border)",
        backgroundColor: "var(--chrome-nav-bg)",
        color: "var(--chrome-nav-text)",
      }}
    >
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2"
        aria-label="BlockSmith home"
      >
        <Logo />
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">
          BlockSmith
        </span>
      </Link>

      <nav
        className="flex items-center gap-6 text-sm font-medium"
        aria-label="Main"
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 transition hover:opacity-70"
          style={{ color: "var(--chrome-nav-muted)" }}
          title="Back to your projects"
        >
          <IconModule size={16} />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>
        {TABS.map((tab) => {
          const href = hrefWithDoc(tab.path, doc);
          const active = tabActive(pathname, tab.id);
          return (
            <Link
              key={tab.id}
              href={href}
              className="transition"
              style={{
                color: active
                  ? "var(--chrome-nav-text)"
                  : "var(--chrome-nav-muted)",
                textDecoration: active ? "underline" : "none",
                textUnderlineOffset: "4px",
              }}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-auto w-full max-w-xs min-w-0 flex-1">
        <label className="relative block">
          <span className="sr-only">Search design system</span>
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--chrome-nav-muted)" }}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search…"
            className="h-9 w-full rounded-full border pl-9 pr-4 text-sm outline-none transition focus:ring-1"
            style={{
              borderColor: "var(--chrome-nav-border)",
              backgroundColor: "var(--chrome-nav-input-bg)",
              color: "var(--chrome-nav-text)",
            }}
          />
        </label>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <a
          href={`/api/wiki/export?doc=${encodeURIComponent(doc)}`}
          download
          className="flex h-9 w-9 items-center justify-center rounded-full transition hover:opacity-70"
          style={{ color: "var(--chrome-nav-muted)" }}
          aria-label="Export wiki as markdown"
          title="Export markdown"
        >
          <IconDownload size={18} />
        </a>
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-full transition hover:opacity-70"
          style={{ color: "var(--chrome-nav-muted)" }}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <IconBrightness size={18} /> : <IconDarkMode size={18} />}
        </button>
        <AuthChrome variant="wiki" />
      </div>
    </header>
  );
}
