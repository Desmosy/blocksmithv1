/**
 * Shared MCP server factory — used by stdio (npm run mcp) and remote HTTP /api/mcp.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  formatBlockForAgent,
  handleCheckGovernance,
  handleGetBlockVersions,
  handleGetComponentDocs,
  handleGetComponentHistory,
  handleGetDesignTokens,
  handleGetGovernanceRules,
  handleGetLockfile,
  handleGetSyncStatus,
  handleListComponents,
  handleLogComponentWork,
  handlePulseCodegen,
  handleScanWorkspace,
  handleValidateUiCode,
  handleCheckGovernanceDiff,
  handleImportFigmaVariables,
  handleFigmaTokenDrift,
} from "@/mcp/handlers";
import type { FigmaVariableDefs } from "@/lib/figma/types";
import type { FigmaComponentInput } from "@/lib/figma/components";
import type {
  GovernanceEventAction,
  GovernanceEventSource,
} from "@/lib/governance/types";

/**
 * Server-level instructions are delivered to every client on connect (Claude
 * connectors, Cursor MCP, etc.). This is how governance travels WITH the
 * connector — no repo files to inject. Any user who adds BlockSmith gets the
 * governed workflow automatically.
 */
const SERVER_INSTRUCTIONS = `BlockSmith is the source of truth for this project's UI design system.

Every block you read from this server is a PINNED, PROMOTED version (like package-lock.json for design): tool responses show "pinned vN (sha256:…)". Drafts and conflicted blocks are never served — if a block you expect is missing, a human has not finalized it in the wiki yet; ask them to promote it rather than inventing values. get_lockfile returns the blocksmith.lock to keep in the repo; get_sync_status tells you if your lock is stale (someone promoted newer versions mid-session — re-read before continuing).

For ANY task that adds or changes UI (components, colors, spacing, styling), follow this governed loop using the tools on this server:

1. get_component_history(component) — check whether a teammate already worked on this. Read their prompt and summary; do not redo or undo their fix.
2. check_component_governance(component) — load the authoritative spec, the allowed token palette, and the "Don't" rules. (Or get_governance_rules for the whole system.)
3. Write UI using ONLY defined tokens (e.g. var(--color-…) / var(--wiki-…)). Never hardcode a hex color that is not a defined token; match the system's spacing and radii.
4. validate_ui_code(code) — before applying generated UI, lint it. If it reports off-token colors, replace them with the correct tokens and re-validate until it returns "Governed". Do NOT apply ungoverned code.
5. check_governance_diff(code, component?, filePath?) — warn-tier prose rules (e.g. inactive links, stale dates) plus block-tier colors. Each finding includes a "→ Fix:" suggestion and a prioritized "## Next" block — apply the suggested token swaps for block-tier and re-run before writing/pushing. If warn-tier issues remain, ask the developer to fix or record an override (record: true + overrideReason) so the wiki Violations panel captures it.
6. log_component_work(component, prompt, summary) — after applying, record what changed so the team and the wiki can see it.

Treat deviations from the design system as bugs. When unsure which token to use, call check_component_governance or get_governance_rules rather than inventing a value.`;

export const BLOCKSMITH_MCP_INSTRUCTIONS = SERVER_INSTRUCTIONS;

/**
 * The tools this server advertises. Hoisted out of the ListTools handler so
 * the app can report how many there really are instead of quoting a number
 * someone typed into a marketing page and forgot to update.
 */
export const BLOCKSMITH_MCP_TOOLS = [
  {
    name: "scan_workspace",
    description:
      "Scan a vendor repo into canonical .md + wiki. Modes: github URL (server clone), fixture:vendor (demo), or workspace path (server-local fixtures/dev only). For a repo on the developer laptop, use CLI `blocksmith scan /path` instead.",
    inputSchema: {
      type: "object",
      properties: {
        github: {
          type: "string",
          description: "GitHub repo URL or org/repo — server shallow-clones and scans.",
        },
        fixture: {
          type: "string",
          description: 'Demo fixture name, e.g. "vendor".',
        },
        workspace: {
          type: "string",
          description:
            "Server-local path (fixtures/ or dev only). Defaults to BLOCKSMITH_WORKSPACE.",
        },
      },
    },
  },
  {
    name: "import_figma_variables",
    description:
      "Import a Figma library (variables from get_variable_defs + published components) into a governed design.md. Figma stays the design source of truth; this seeds the BlockSmith IR so the wiki, tokens, and Component Library render the library. If the file has NO variables (get_variable_defs returns {}), pass the get_design_context code as `designContextCode` and tokens are recovered from the design automatically. Returns the doc ref to govern with.",
    inputSchema: {
      type: "object",
      properties: {
        variables: {
          type: "object",
          description:
            "Figma variable defs: a { name: value } map (e.g. \"Color/Text/Primary\": \"#1A1A1A\") or an array of { name, value, type }. Omit/empty for files without variables and pass designContextCode instead.",
        },
        designContextCode: {
          type: "string",
          description:
            "Raw get_design_context output (React+Tailwind code). Used to recover de-facto tokens (colors/radii/type sizes) when the file has no Figma variables. Real variables win on collision.",
        },
        components: {
          type: "array",
          description:
            "Published components: array of { name, description?, key?, componentPropertyDefinitions } (Figma's raw property defs) or pre-normalized { name, variants, booleanProps, textProps, instanceProps }.",
          items: { type: "object" },
        },
        fileKey: {
          type: "string",
          description: "Figma file key (from the file URL) — used as the token source label.",
        },
        fileName: {
          type: "string",
          description: "Human library/file name — becomes the design system name.",
        },
        projectName: {
          type: "string",
          description: "Optional explicit project name override.",
        },
      },
    },
  },
  {
    name: "figma_token_drift",
    description:
      "Reconcile a Figma library against an existing code scan — the wedge payoff: tokens where 'Figma says X, shipped code says Y', plus (when `components` is passed) component drift like 'this Figma component has a size=lg variant your code doesn't'. `doc` must be a workspace-scan upload (run blocksmith scan / scan_workspace first).",
    inputSchema: {
      type: "object",
      properties: {
        variables: {
          type: "object",
          description:
            "Figma variable defs ({ name: value } map or array of { name, value, type }).",
        },
        designContextCode: {
          type: "string",
          description:
            "Raw get_design_context code — recover tokens from the design when the file has no variables.",
        },
        components: {
          type: "array",
          description:
            "Optional published components to also drift at the variant/prop level.",
          items: { type: "object" },
        },
        doc: {
          type: "string",
          description:
            "Code-side scan doc ref (upload:scan-*.md). Defaults to BLOCKSMITH_DOC.",
        },
        fileKey: {
          type: "string",
          description: "Figma file key for the source label.",
        },
      },
    },
  },
  {
    name: "get_design_tokens",
    description:
      "Colors, typography, spacing, and surface tokens from the design system. Same data as the BlockSmith wiki.",
    inputSchema: {
      type: "object",
      properties: {
        doc: {
          type: "string",
          description:
            "Document ref (e.g. apollo.md or upload:design-abc.md). Defaults to BLOCKSMITH_DOC or apollo.md.",
        },
        category: {
          type: "string",
          description: "Optional filter: color, typography, spacing, surface",
        },
      },
    },
  },
  {
    name: "get_component_docs",
    description:
      "Component specs (role, description, agent hints) for building UI. Matches wiki component pages.",
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "string", description: "Document ref" },
        names: {
          type: "array",
          items: { type: "string" },
          description:
            "Component names or id fragments (e.g. button, primary-pill). Empty = all components.",
        },
      },
    },
  },
  {
    name: "list_components",
    description: "List all components in the design system with short summaries.",
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "string", description: "Document ref" },
      },
    },
  },
  {
    name: "get_sync_status",
    description:
      "File watcher status, block store index, and content hash — use to detect stale wiki vs repo.",
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "string", description: "Document ref" },
      },
    },
  },
  {
    name: "get_component_history",
    description:
      "Shared work log for a component: who changed it, when, the prompt, and a summary. ALWAYS check this before working on a component — someone may have already fixed the same issue. Omit `component` for a doc-wide recent feed.",
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "string", description: "Document ref" },
        component: {
          type: "string",
          description: "Component name or id (e.g. primary button). Optional.",
        },
        limit: { type: "number", description: "Max entries (default 10)" },
      },
    },
  },
  {
    name: "log_component_work",
    description:
      "Record work on a component to the shared ledger so teammates (and future you) can see it. Call this AFTER changing UI tied to a component, with the prompt you used and a one-line summary.",
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "string", description: "Document ref" },
        component: {
          type: "string",
          description: "Component name or id this work relates to.",
        },
        author: {
          type: "string",
          description: "Who did the work. Defaults to BLOCKSMITH_AUTHOR env.",
        },
        action: {
          type: "string",
          description: "One of: prompt, fix, change, note.",
        },
        prompt: {
          type: "string",
          description: "The prompt/instruction that drove the change.",
        },
        summary: {
          type: "string",
          description: "One-line summary of what changed (required).",
        },
        files: {
          type: "array",
          items: { type: "string" },
          description: "Files touched, if known.",
        },
      },
      required: ["component", "summary"],
    },
  },
  {
    name: "check_component_governance",
    description:
      "Validate a planned UI change against the design system BEFORE writing code: returns the component's authoritative spec, the allowed token palette, do/don't rules, and flags any proposed colors that are off-token (deviations). Use this to stay governed by the wiki.",
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "string", description: "Document ref" },
        component: {
          type: "string",
          description: "Component name or id you intend to change.",
        },
        proposedColors: {
          type: "array",
          items: { type: "string" },
          description: "Hex colors you plan to use — checked against tokens.",
        },
      },
      required: ["component"],
    },
  },
  {
    name: "get_governance_rules",
    description:
      "Load the design system's rules in one call: allowed color token palette, do/don't guidelines, and component count. Call this at the start of any UI task to know the constraints before writing code.",
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "string", description: "Document ref" },
      },
    },
  },
  {
    name: "pulse_codegen",
    description:
      "Generate importable @blocksmith/<slug> npm package from workspace-scan markdown: tokens.css, Surface, Text, Button stubs. Run after scan_workspace. Demo at /demo/pulse.",
    inputSchema: {
      type: "object",
      properties: {
        doc: {
          type: "string",
          description:
            "Scan doc ref (e.g. upload:scan-acme-ui-kit.md). Defaults to BLOCKSMITH_DOC.",
        },
      },
    },
  },
  {
    name: "get_lockfile",
    description:
      "Get blocksmith.lock for this design system — pins every promoted block id to an exact version + contentHash, like package-lock.json for design. Write it to the repo root so CI (validate_ui) and future agent sessions resolve the same truth. Reports whether the current repo lock is stale.",
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "string", description: "Document ref" },
      },
    },
  },
  {
    name: "get_block_versions",
    description:
      "Version history for one block id: every recorded version, its status (draft/finalized/stale/conflict), contentHash, and which version is currently official. Use to audit when a token or component changed and what the lock should pin.",
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "string", description: "Document ref" },
        blockId: {
          type: "string",
          description: "Block id, e.g. component:primary-pill-button or token:color:accent.",
        },
      },
      required: ["blockId"],
    },
  },
  {
    name: "validate_ui_code",
    description:
      "Lint a block of UI code (TSX/CSS/etc.) you are ABOUT TO WRITE against the design system. Returns any off-token colors as deviations. ALWAYS check `get_lockfile` first to ensure you are building against the exact pinned block versions in `blocksmith.lock`, not a draft or drifted state. Call this on generated UI before applying it to the file — if it is not governed, replace the raw colors with defined tokens and re-validate.",
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "string", description: "Document ref" },
        code: {
          type: "string",
          description: "The UI code you intend to write.",
        },
      },
      required: ["code"],
    },
  },
  {
    name: "check_governance_diff",
    description:
      "Check UI code against promoted component governance (warn-tier prose rules + block-tier off-token colors). Use before commit/push. Set record=true with overrideReason when the developer pushes despite warnings — creates a wiki Violations entry for the design lead.",
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "string", description: "Document ref" },
        code: { type: "string", description: "TSX/CSS snippet or file contents to check" },
        component: {
          type: "string",
          description: "Component name/id (e.g. Footer). Inferred from filePath when omitted.",
        },
        filePath: {
          type: "string",
          description: "Repo path (e.g. src/components/Footer.tsx) for rule scope + findings.",
        },
        record: {
          type: "boolean",
          description: "When true and findings exist, append to wiki Governance → Violations.",
        },
        author: { type: "string", description: "Developer name for the audit trail." },
        overrideReason: {
          type: "string",
          description: "Required when recording an intentional override of warn-tier rules.",
        },
        action: {
          type: "string",
          description: "detected | overridden | bypass",
        },
        commit: { type: "string", description: "Git commit sha, if known." },
        branch: { type: "string", description: "Git branch, if known." },
      },
      required: ["code"],
    },
  },
] as const;

export const BLOCKSMITH_MCP_TOOL_NAMES: readonly string[] =
  BLOCKSMITH_MCP_TOOLS.map((t) => t.name);

export function createBlocksmithMcpServer(): Server {
  const server = new Server(
  {
    name: "blocksmith",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
    instructions: SERVER_INSTRUCTIONS,
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: BLOCKSMITH_MCP_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    if (name === "scan_workspace") {
      const result = await handleScanWorkspace({
        workspace: a.workspace as string | undefined,
        github: a.github as string | undefined,
        fixture: a.fixture as string | undefined,
      });
      const lines = [
        `# Workspace scan complete`,
        "",
        `- **Mode:** ${result.scanMode}`,
        ...(result.githubUrl ? [`- **GitHub:** ${result.githubUrl}`] : []),
        `- **Project:** ${result.projectName}`,
        `- **Workspace:** ${result.workspaceRoot}`,
        `- **Doc ref:** ${result.docRef}`,
        `- **Markdown:** ${result.markdownPath}`,
        `- **Wiki:** ${result.wikiPath}`,
        `- **Colors:** ${result.colors} · **Components:** ${result.components} · **Files:** ${result.filesScanned}`,
        `- **Curated:** ${result.curated ? `yes (${result.curatedModel ?? "cached"})` : `no${result.curateReason ? ` — ${result.curateReason}` : ""}`}`,
        "",
        `Set BLOCKSMITH_DOC=${result.docRef} in MCP env to govern this vendor.`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "import_figma_variables") {
      const result = await handleImportFigmaVariables({
        variables: a.variables as FigmaVariableDefs | undefined,
        designContextCode: a.designContextCode as string | undefined,
        components: a.components as FigmaComponentInput | undefined,
        fileKey: a.fileKey as string | undefined,
        fileName: a.fileName as string | undefined,
        projectName: a.projectName as string | undefined,
      });
      const s = result.summary;
      const lines = [
        `# Figma library imported`,
        "",
        `- **Project:** ${s.projectName}`,
        `- **Figma file:** ${s.fileKey}`,
        `- **Tokens:** ${s.cssVars} (${s.colors} colors · ${s.dimensions} dimensions)`,
        `- **Components:** ${s.components}`,
        ...(s.skipped ? [`- **Skipped:** ${s.skipped} unrecognized variable(s)`] : []),
        `- **Doc ref:** ${result.docRef}`,
        `- **Markdown:** ${result.markdownPath}`,
        `- **Wiki:** ${result.wikiPath}`,
        "",
        `Set BLOCKSMITH_DOC=${result.docRef} to govern this library, or call figma_token_drift with this doc to compare against a code scan.`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "figma_token_drift") {
      const result = await handleFigmaTokenDrift({
        variables: a.variables as FigmaVariableDefs | undefined,
        designContextCode: a.designContextCode as string | undefined,
        components: a.components as FigmaComponentInput | undefined,
        doc: a.doc as string | undefined,
        fileKey: a.fileKey as string | undefined,
      });
      if (result.error) {
        return {
          content: [{ type: "text", text: result.error }],
          isError: true,
        };
      }
      const drifted =
        !result.report.inSync || result.componentReport?.inSync === false;
      return {
        content: [{ type: "text", text: result.markdown }],
        isError: drifted,
      };
    }

    if (name === "get_design_tokens") {
      const result = handleGetDesignTokens({
        doc: a.doc as string | undefined,
        category: a.category as string | undefined,
      });
      const text = result.tokens
        .map(formatBlockForAgent)
        .join("\n\n---\n\n");
      return {
        content: [
          {
            type: "text",
            text: text || `No tokens found for ${result.docRef}.`,
          },
        ],
      };
    }

    if (name === "get_component_docs") {
      const result = handleGetComponentDocs({
        doc: a.doc as string | undefined,
        names: a.names as string[] | undefined,
      });
      const text = result.components
        .map(formatBlockForAgent)
        .join("\n\n---\n\n");
      return {
        content: [
          {
            type: "text",
            text:
              text ||
              `No components matched for ${result.docRef}. Try list_components.`,
          },
        ],
      };
    }

    if (name === "list_components") {
      const result = handleListComponents({
        doc: a.doc as string | undefined,
      });
      const lines = result.components.map(
        (c) => `- **${c.title}** (\`${c.id}\`)${c.summary ? ` — ${c.summary}` : ""}`,
      );
      return {
        content: [
          {
            type: "text",
            text: [`# Components (${result.docRef})`, "", ...lines].join("\n"),
          },
        ],
      };
    }

    if (name === "get_sync_status") {
      const status = handleGetSyncStatus({ doc: a.doc as string | undefined });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    }

    if (name === "get_component_history") {
      const result = handleGetComponentHistory({
        doc: a.doc as string | undefined,
        component: a.component as string | undefined,
        limit: a.limit as number | undefined,
      });
      if (result.error) {
        return { content: [{ type: "text", text: result.error }], isError: true };
      }
      const scope = result.component
        ? `${result.component.title} (${result.component.id})`
        : `all components in ${result.docRef}`;
      if (result.entries.length === 0) {
        return {
          content: [
            { type: "text", text: `No logged activity yet for ${scope}.` },
          ],
        };
      }
      const lines = result.entries.map((e) => {
        const when = new Date(e.ts).toISOString().slice(0, 10);
        const commit = e.commit ? ` · \`${e.commit}\`` : "";
        const parts = [
          `- **${when}** · ${e.author}${commit} · _${e.action}_ — ${e.summary}`,
        ];
        if (e.componentTitle && !result.component)
          parts.push(`    component: ${e.componentTitle}`);
        if (e.prompt) parts.push(`    prompt: ${e.prompt}`);
        if (e.files?.length) parts.push(`    files: ${e.files.join(", ")}`);
        return parts.join("\n");
      });
      return {
        content: [
          { type: "text", text: [`# Activity — ${scope}`, "", ...lines].join("\n") },
        ],
      };
    }

    if (name === "log_component_work") {
      const result = handleLogComponentWork({
        doc: a.doc as string | undefined,
        component: a.component as string,
        author: a.author as string | undefined,
        action: a.action as "prompt" | "fix" | "change" | "note" | undefined,
        prompt: a.prompt as string | undefined,
        summary: a.summary as string,
        files: a.files as string[] | undefined,
      });
      if (!result.ok || !result.entry) {
        return {
          content: [{ type: "text", text: result.error ?? "Log failed" }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Logged to ${result.entry.componentTitle} by ${result.entry.author} (${result.entry.action}). Teammates will see this in get_component_history.`,
          },
        ],
      };
    }

    if (name === "check_component_governance") {
      const result = handleCheckGovernance({
        doc: a.doc as string | undefined,
        component: a.component as string,
        proposedColors: a.proposedColors as string[] | undefined,
      });
      if (result.error) {
        return { content: [{ type: "text", text: result.error }], isError: true };
      }
      const lines = [
        `# Governance — ${result.component!.title}`,
        "",
        result.governed
          ? "✅ Governed: no deviations detected."
          : "⚠️ Deviation detected — fix before proceeding:",
        ...result.violations.map((v) => `  - ${v}`),
        "",
        "**Authoritative spec**",
        `Role: ${result.component!.role || "—"}`,
        result.component!.description ? `Spec: ${result.component!.description}` : "",
        "",
        "**Allowed color tokens**",
        ...result.palette.map((p) => `  - ${p.name}: ${p.value}`),
      ];
      if (result.donts.length) {
        lines.push("", "**Don't**", ...result.donts.map((d) => `  - ${d}`));
      }
      return {
        content: [{ type: "text", text: lines.filter((l) => l !== "").join("\n") }],
        isError: !result.governed,
      };
    }

    if (name === "get_governance_rules") {
      const r = handleGetGovernanceRules({ doc: a.doc as string | undefined });
      const lines = [
        `# Design system rules — ${r.systemName} (${r.docRef})`,
        `${r.componentCount} governed components.`,
        "",
        "## Allowed color tokens (use these, not raw hex)",
        ...r.palette.map((p) => `  - ${p.name}: ${p.value}`),
      ];
      if (r.dos.length) lines.push("", "## Do", ...r.dos.map((d) => `  - ${d}`));
      if (r.donts.length) lines.push("", "## Don't", ...r.donts.map((d) => `  - ${d}`));
      lines.push(
        "",
        "Before writing UI: check_component_governance(component). Before applying: validate_ui_code(code). After: log_component_work(...).",
      );
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "pulse_codegen") {
      const result = await handlePulseCodegen({
        doc: a.doc as string | undefined,
      });
      const lines = [
        `# Pulse codegen complete`,
        "",
        `- **Package:** ${result.packageName}`,
        `- **Output:** ${result.outDir}`,
        `- **Doc:** ${result.docRef}`,
        `- **CSS vars:** ${result.cssVarCount} · **Components:** ${result.componentCount}`,
        `- **Demo:** ${result.demoUrl}`,
        "",
        "```tsx",
        result.importExample,
        "```",
        "",
        `Run \`npm run build -w ${result.packageName}\` then open ${result.demoUrl}.`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "get_lockfile") {
      const result = handleGetLockfile({ doc: a.doc as string | undefined });
      const lines = [
        `# blocksmith.lock — ${result.docRef}`,
        "",
        `- **Graph hash:** ${result.lock.contentHash}`,
        `- **Pinned blocks:** ${Object.keys(result.lock.blocks).length}`,
        result.status.present
          ? `- **Server reference lock:** ${result.status.fresh ? "fresh ✅" : "STALE ⚠️ — versions were promoted after it was written"}`
          : "- **Server reference lock:** not written yet",
        "",
        "Write this file as `blocksmith.lock` in the repo root (next to DESIGN.md):",
        "",
        "```json",
        result.body.trimEnd(),
        "```",
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "get_block_versions") {
      const result = handleGetBlockVersions({
        doc: a.doc as string | undefined,
        blockId: a.blockId as string,
      });
      if (result.error) {
        return { content: [{ type: "text", text: result.error }], isError: true };
      }
      const lines = [
        `# Versions — ${result.blockId} (${result.docRef})`,
        "",
        result.official != null
          ? `Official (locked): **v${result.official}**`
          : "Never promoted — agents cannot use this block yet.",
        "",
        ...result.versions
          .slice()
          .reverse()
          .map((v) => {
            const tag = v.version === result.official ? " ← official" : "";
            const when = v.createdAt.slice(0, 10);
            return `- **v${v.version}** · ${v.status} · ${when} · ${v.contentHash}${v.editedBy ? ` · via ${v.editedBy}` : ""}${tag}`;
          }),
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "validate_ui_code") {
      const result = handleValidateUiCode({
        doc: a.doc as string | undefined,
        code: a.code as string,
      });
      if (result.governed) {
        return {
          content: [
            {
              type: "text",
              text: `✅ Governed — all colors are defined tokens (${result.tokenCount} in palette). Safe to apply.`,
            },
          ],
        };
      }
      const lines = [
        `⚠️ ${result.violations.length} off-token color(s) — do NOT apply as-is. Replace with defined tokens (var(--…)) and re-validate:`,
        "",
        ...result.violations.map((v) => `  line ${v.line}: ${v.hex}  →  ${v.snippet}`),
      ];
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        isError: true,
      };
    }

    if (name === "check_governance_diff") {
      const result = await handleCheckGovernanceDiff({
        doc: a.doc as string | undefined,
        code: a.code as string,
        component: a.component as string | undefined,
        filePath: a.filePath as string | undefined,
        record: a.record === true,
        author: a.author as string | undefined,
        source: a.source as GovernanceEventSource | undefined,
        action: a.action as GovernanceEventAction | undefined,
        overrideReason: a.overrideReason as string | undefined,
        commit: a.commit as string | undefined,
        branch: a.branch as string | undefined,
      });

      if (result.findings.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `✅ No governance issues — ${result.docRef}${result.component ? ` · ${result.component.title}` : ""}. Safe to push.`,
            },
          ],
        };
      }

      const blockFindings = result.findings.filter((f) => f.tier === "block");
      const warnFindings = result.findings.filter((f) => f.tier === "warn");

      const renderFinding = (f: (typeof result.findings)[number]) => {
        const loc =
          f.file && f.line ? `${f.file}:${f.line}` : f.line ? `line ${f.line}` : "";
        const parts = [
          `- **[${f.tier.toUpperCase()}] ${f.ruleId}**${loc ? ` · ${loc}` : ""}`,
          `  ${f.message}`,
        ];
        if (f.snippet) parts.push(`  \`${f.snippet}\``);
        if (f.suggestion) parts.push(`  → Fix: ${f.suggestion}`);
        if (f.ruleCitation) {
          parts.push(
            `  Rule: "${f.ruleCitation.slice(0, 120)}${f.ruleCitation.length > 120 ? "…" : ""}"`,
          );
        }
        return parts.join("\n");
      };

      // Tier-3 agent-time: tell the agent exactly what to do next, in priority
      // order, so it can self-correct without another round-trip.
      const nextActions: string[] = [];
      if (blockFindings.length > 0) {
        nextActions.push(
          "1. Block-tier: apply the suggested token swaps above, then re-run check_governance_diff. Do NOT write or push this code with off-token colors.",
        );
      }
      if (warnFindings.length > 0) {
        nextActions.push(
          `${blockFindings.length > 0 ? "2" : "1"}. Warn-tier: prefer fixing the prose (remove inactive links / stale dates). If the developer insists, re-run with record=true and overrideReason so it lands in the wiki Violations feed.`,
        );
      }

      const lines = [
        `# Governance check — ${result.docRef}`,
        result.component ? `**Component:** ${result.component.title}` : "",
        "",
        `**Block-tier:** ${result.blockCount} · **Warn-tier:** ${result.warnCount}`,
        result.governed
          ? "Colors OK — review warn-tier issues before push."
          : "❌ Block-tier color violations — do NOT write/push without fixing.",
        "",
        "## Findings",
        ...result.findings.map(renderFinding),
        "",
        "## Next",
        ...nextActions,
        result.event
          ? `\nRecorded on wiki (event ${result.event.id}). Design lead can review under Governance → Violations.`
          : "",
      ].filter(Boolean);

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        isError: !result.governed || result.warnCount > 0,
      };
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `BlockSmith error: ${message}` }],
      isError: true,
    };
  }
});

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "governed_ui_task",
      description:
        "Run a UI task under BlockSmith governance — checks history + rules, builds with tokens, validates, and logs.",
      arguments: [
        { name: "task", description: "What to build or change", required: false },
        { name: "component", description: "Component it relates to", required: false },
      ],
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const args = (request.params.arguments ?? {}) as Record<string, string>;
  const task = args.task || "the requested UI change";
  const component = args.component
    ? ` It relates to the "${args.component}" component.`
    : "";
  return {
    description: "Governed UI task",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Do this UI task under BlockSmith governance: ${task}.${component}

Follow the governed loop:
1. get_component_history${args.component ? `("${args.component}")` : "(component)"} — don't redo a teammate's fix.
2. get_governance_rules / check_component_governance — load the allowed tokens and Don't rules.
3. Build using only defined tokens (var(--…)); never a raw off-token hex.
4. validate_ui_code(code) before applying; fix any deviations and re-validate until governed.
5. log_component_work(component, prompt, summary) after applying.`,
        },
      },
    ],
  };
});

  return server;
}
