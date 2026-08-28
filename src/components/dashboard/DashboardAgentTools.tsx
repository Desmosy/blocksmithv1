"use client";

/**
 * DashboardAgentTools — the read-only WebMCP tools, on the signed-in home.
 *
 * Before a design system page is open there is still work an agent can do:
 * read the default system's rules, check a snippet, capture a site. The
 * dashboard registers the read-only half of the registry so that work can
 * start here, and shows the same panel the wiki does so the human can see it.
 */

import { useEffect, useMemo, useState } from "react";
import { useWebMcp, type WebMcpToolSpec } from "@/hooks/useWebMcp";
import { serverToolSpecs, type ToolDescriptor } from "@/lib/webmcp/client";
import { AgentToolPanel, type PanelTool } from "@/components/webmcp/AgentToolPanel";

export function DashboardAgentTools() {
  const [tools, setTools] = useState<ToolDescriptor[]>([]);

  // Fetched in every browser, not only ones with an agent surface: the panel
  // lists the tools either way, so a reader without the flag still sees them.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/webmcp/invoke", { signal: controller.signal })
      .then((r) => r.json())
      .then((d: { tools?: ToolDescriptor[] }) =>
        setTools((d.tools ?? []).filter((t) => t.annotations?.readOnlyHint)),
      )
      .catch(() => {
        /* the dashboard works without the list */
      });
    return () => controller.abort();
  }, []);

  const specs = useMemo<WebMcpToolSpec[]>(
    () => serverToolSpecs(tools, undefined, () => {}),
    [tools],
  );
  const { supported, registered, error } = useWebMcp(specs);

  if (!tools.length) return null;

  const panel: PanelTool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    readOnly: t.annotations?.readOnlyHint === true,
    kind: "server",
  }));

  return (
    <AgentToolPanel
      tools={panel}
      registered={registered}
      supported={supported}
      error={error}
      scope="the default design system"
      tone="dashboard"
    />
  );
}
