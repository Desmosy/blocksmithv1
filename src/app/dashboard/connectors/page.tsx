/**
 * Connectors — what this server is wired to, resolved per request.
 */

import Link from "next/link";
import { ScanWorkspaceCard } from "@/components/home/ScanWorkspaceCard";
import { FigmaConnectCard } from "@/components/figma/FigmaConnectCard";
import { ConnectorDisclosure } from "@/components/dashboard/ConnectorDisclosure";
import { getSupabaseUser } from "@/lib/auth/session";
import { supabaseAnonKey, supabaseStorageEnabled, supabaseUrl } from "@/lib/supabase/env";
import { isNvidiaConfigured } from "@/lib/ai/nvidia";
import { isCaptureConfigured } from "@/lib/ingest/capture";
import { WEBMCP_TOOLS } from "@/lib/webmcp/registry";
import { BLOCKSMITH_MCP_TOOL_NAMES } from "@/lib/mcp/blocksmith-server";

export const dynamic = "force-dynamic";

type State = "ready" | "needs-setup" | "signed-out";

type Connector = {
  name: string;
  what: string;
  state: State;
  /** The observed fact behind the state — never a guess. */
  detail: string;
  href?: string;
  hrefLabel?: string;
};

const STATE_STYLE: Record<State, { label: string; dot: string }> = {
  ready: { label: "Ready", dot: "bg-emerald-500" },
  "needs-setup": { label: "Not configured", dot: "bg-[var(--dash-muted-fg)]" },
  "signed-out": { label: "Signed out", dot: "bg-amber-500" },
};

/**
 * Connectors that carry a form, and the hash the dashboard links them with.
 * Anything not listed here stays a status row, which is all it has ever been.
 */
const FORM_ANCHOR: Record<string, string> = {
  GitHub: "codebase",
  Figma: "figma",
};
const FORM_LABEL: Record<string, string> = {
  GitHub: "Scan a repository",
  Figma: "Connect a file",
};

export default async function ConnectorsPage() {
  let login: string | null = null;
  try {
    const user = await getSupabaseUser();
    login = user?.login ?? null;
  } catch {
    /* auth not configured on this server */
  }

  const authConfigured = Boolean(supabaseUrl() && supabaseAnonKey());

  const connectors: Connector[] = [
    {
      name: "MCP server",
      what: "Your IDE agent reads the design system over Model Context Protocol.",
      state: "ready",
      detail: `${BLOCKSMITH_MCP_TOOL_NAMES.length} tools served over stdio and at /api/mcp`,
      href: "/dashboard/api-keys",
      hrefLabel: "Install in Cursor",
    },
    {
      name: "In-page agent tools",
      what:
        "A browser agent on a design-system page gets the same governance tools, registered with WebMCP.",
      state: "ready",
      detail: `${WEBMCP_TOOLS.length} governance tools, plus proposal tools on the wiki`,
      href: "/protocol/registry.v1",
      hrefLabel: "Protocol",
    },
    {
      name: "Figma",
      what: "Import variables and components from a file, then track drift against code.",
      state: "ready",
      detail: "Connect per design system with a file URL and a personal access token",
    },
    {
      name: "GitHub",
      what: "Scan a repository into a governed design system and re-scan on push.",
      state: authConfigured ? (login ? "ready" : "signed-out") : "needs-setup",
      detail: authConfigured
        ? login
          ? `Signed in as ${login}`
          : "Sign in to connect a repository"
        : "Supabase auth is not configured on this server",
    },
    {
      name: "Visual capture",
      what: "Read a live page and synthesize its design system.",
      state: isCaptureConfigured() ? "ready" : "needs-setup",
      detail: isCaptureConfigured()
        ? "Vision model configured"
        : "Set a vision API key to enable screenshot enrichment",
    },
    {
      name: "AI generation",
      what: "Governed generation and layout suggestions.",
      state: isNvidiaConfigured() ? "ready" : "needs-setup",
      detail: isNvidiaConfigured()
        ? "NVIDIA endpoint configured"
        : "Set NVIDIA_API_KEY to enable",
    },
    {
      name: "Supabase storage",
      what: "Where design systems and lockfiles persist beyond this process.",
      state: supabaseStorageEnabled() ? "ready" : "needs-setup",
      detail: supabaseStorageEnabled()
        ? "Service role configured"
        : "Not configured — documents stay on local disk",
    },
  ];

  return (
    <div className="mx-auto max-w-[820px] px-8 py-10">
      <header className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--dash-foreground)]">
          Connectors
        </h1>
        <p className="mt-1 text-[15px] text-[var(--dash-muted-fg)]">
          What this server is wired to, read live.
        </p>
      </header>

      <section className="rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-surface)]">
        <ul>
          {connectors.map((c) => {
            const style = STATE_STYLE[c.state];
            return (
              <li
                key={c.name}
                id={FORM_ANCHOR[c.name]}
                className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--dash-border)] px-6 py-5 scroll-mt-24 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`size-1.5 shrink-0 rounded-full ${style.dot}`}
                    />
                    <h2 className="text-[15px] font-medium text-[var(--dash-foreground)]">
                      {c.name}
                    </h2>
                    <span className="font-gtstandardmono text-[11px] uppercase tracking-wider text-[var(--dash-muted-fg)]">
                      {style.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[14px] leading-relaxed text-[var(--dash-muted-fg)]">
                    {c.what}
                  </p>
                  <p className="mt-1.5 text-[13px] text-[var(--dash-foreground)]">{c.detail}</p>
                </div>

                {/* The doing lives in the row that describes it. */}
                {FORM_ANCHOR[c.name] ? (
                  <ConnectorDisclosure
                    anchor={FORM_ANCHOR[c.name]}
                    label={FORM_LABEL[c.name]}
                  >
                    {c.name === "GitHub" ? <ScanWorkspaceCard /> : <FigmaConnectCard />}
                  </ConnectorDisclosure>
                ) : null}

                {c.href ? (
                  <Link
                    href={c.href}
                    className="shrink-0 rounded-[var(--dash-radius)] border border-[var(--dash-border)] px-3 py-1.5 text-[13px] text-[var(--dash-foreground)] hover:bg-[var(--dash-muted)]"
                  >
                    {c.hrefLabel}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
