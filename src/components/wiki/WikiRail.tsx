"use client";

/**
 * The primary destinations, as a rail down the left edge.
 *
 * These used to sit in a top bar beside the logo and the search field, which
 * put product navigation, document context and page actions on two stacked
 * rows and left the content starting halfway down the screen. A rail gives the
 * navigation a fixed home, returns that vertical space to the document, and
 * matches how the rest of the app is laid out.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryState } from "nuqs";
import { LogoIcon } from "@/components/logo";
import { AuthChrome } from "@/components/auth/AuthChrome";
import { DOC_QUERY_KEY, hrefWithDoc } from "@/lib/wiki/doc-param";
import {
  IconBrightness,
  IconCog,
  IconColorPalette,
  IconDarkMode,
  IconDownload,
  IconHome,
  IconUpload,
} from "@/components/icons";

type RailItem = {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  /** Dashboard lives outside the wiki, so it never carries the doc param. */
  keepsDoc?: boolean;
};

const ITEMS: RailItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: <IconHome size={18} /> },
  { id: "design", label: "Design", path: "/wiki", icon: <IconColorPalette size={18} />, keepsDoc: true },
  { id: "releases", label: "Releases", path: "/wiki/pipeline", icon: <IconUpload size={18} />, keepsDoc: true },
  { id: "setup", label: "Setup", path: "/wiki/sync", icon: <IconCog size={18} />, keepsDoc: true },
];

function isActive(pathname: string, id: string): boolean {
  if (id === "dashboard") return pathname.startsWith("/dashboard");
  if (id === "design") {
    return (
      pathname.startsWith("/wiki") &&
      !pathname.startsWith("/wiki/pipeline") &&
      !pathname.startsWith("/wiki/releases") &&
      !pathname.startsWith("/wiki/sync") &&
      !pathname.startsWith("/wiki/governance")
    );
  }
  if (id === "releases") {
    return (
      pathname.startsWith("/wiki/pipeline") ||
      pathname.startsWith("/wiki/releases") ||
      pathname.startsWith("/wiki/governance")
    );
  }
  return pathname.startsWith("/wiki/sync");
}

export function WikiRail({
  currentFileName,
  isDark,
  onToggleTheme,
  canToggleTheme,
}: {
  currentFileName: string;
  isDark: boolean;
  onToggleTheme: () => void;
  /**
   * The wiki's dark palette is scoped to `.design-wiki-applied`, so the toggle
   * does nothing until a style has been visualised. Showing a control that
   * cannot change anything is worse than not showing it.
   */
  canToggleTheme: boolean;
}) {
  const pathname = usePathname();
  const [docParam] = useQueryState(DOC_QUERY_KEY);
  const doc = docParam ?? currentFileName;

  return (
    <nav
      aria-label="Main"
      className="flex w-[76px] shrink-0 flex-col items-center border-r py-3"
      style={{
        borderColor: "var(--wiki-border)",
        backgroundColor: "var(--wiki-sidebar)",
      }}
    >
      <Link
        href="/"
        aria-label="BlockSmith home"
        className="mb-4 flex size-9 items-center justify-center rounded-lg transition hover:opacity-70"
        style={{ color: "var(--wiki-text)" }}
      >
        <LogoIcon className="size-5" />
      </Link>

      <ul className="flex w-full flex-col items-center gap-1">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.id);
          const href = item.keepsDoc ? hrefWithDoc(item.path, doc) : item.path;
          return (
            <li key={item.id} className="w-full px-2">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition"
                style={{
                  color: active ? "var(--wiki-text)" : "var(--wiki-muted)",
                  backgroundColor: active ? "var(--wiki-active)" : "transparent",
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col items-center gap-1 pt-3">
        <a
          href={`/api/wiki/export?doc=${encodeURIComponent(doc)}`}
          download
          className="flex size-9 items-center justify-center rounded-lg transition hover:opacity-70"
          style={{ color: "var(--wiki-muted)" }}
          aria-label="Export wiki as markdown"
          title="Export markdown"
        >
          <IconDownload size={18} />
        </a>
        {canToggleTheme ? (
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex size-9 items-center justify-center rounded-lg transition hover:opacity-70"
            style={{ color: "var(--wiki-muted)" }}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <IconBrightness size={18} /> : <IconDarkMode size={18} />}
          </button>
        ) : null}
        <AuthChrome variant="wiki" />
      </div>
    </nav>
  );
}
