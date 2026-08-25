"use client";

import {
  buildCursorMcpDeeplink,
  buildMcpJsonConfig,
} from "@/lib/cursor/mcp-deeplink";
import { CopyButton } from "./visual/CopyButton";

/** Shown once after API key creation — one-click Cursor MCP install. */
export function CursorMcpInstall({ apiKey }: { apiKey: string }) {
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";
  if (!baseUrl) return null;

  const deeplink = buildCursorMcpDeeplink("blocksmith", baseUrl, apiKey);
  const mcpJson = JSON.stringify(buildMcpJsonConfig(baseUrl, apiKey), null, 2);

  return (
    <div className="mt-4 space-y-3 border-t border-emerald-500/20 pt-4">
      <p className="font-semibold text-[var(--wiki-text)]">Connect Cursor</p>
      <p className="text-[var(--wiki-muted)]">
        Add BlockSmith MCP to Cursor.
      </p>

      <a
        href={deeplink}
        className="inline-block rounded-lg ring-offset-2 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--wiki-accent)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://cursor.com/deeplink/mcp-install-dark.svg"
          alt="Add BlockSmith to Cursor"
          height={32}
          className="hidden h-8 dark:block"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://cursor.com/deeplink/mcp-install-light.svg"
          alt="Add BlockSmith to Cursor"
          height={32}
          className="block h-8 dark:hidden"
        />
      </a>

      <p className="text-[var(--wiki-muted)]">
        Or copy <code className="font-mono text-[10px]">.cursor/mcp.json</code> manually:
      </p>
      <CopyButton value={mcpJson} label="Copy MCP config" />

      <p className="text-[var(--wiki-muted)]">
        CLI:{" "}
        <code className="font-mono text-[10px]">
          blocksmith login --key … --url {baseUrl}
        </code>
        {" · "}
        <code className="font-mono text-[10px]">blocksmith setup cursor</code>
      </p>
    </div>
  );
}
