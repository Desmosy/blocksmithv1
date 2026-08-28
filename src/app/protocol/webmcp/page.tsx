import { Callout, Code, H1, H2, P, Pre } from "../ui";
import { BookmarkletLink } from "./BookmarkletLink";
import { WEBMCP_TOOLS, WEBMCP_REGISTERED_TOOL_COUNT } from "@/lib/webmcp/registry";
import { PAGE_TOOLS } from "@/lib/webmcp/page-tools";
import { ANYWHERE_SCRIPT_PATH, ANYWHERE_TOOLS } from "@/lib/webmcp/anywhere-tools";
import { BLOCKSMITH_MCP_TOOL_NAMES } from "@/lib/mcp/blocksmith-server";
import { WEBMCP_MANIFEST_PATH } from "@/lib/webmcp/manifest";

export const metadata = {
  title: "WebMCP — BlockSmith's agent surface",
  description:
    "Every tool an agent can call on BlockSmith: on a design system page, on the dashboard, on any website via bookmarklet or extension, and over remote MCP.",
};

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "https://blocksmithv1.vercel.app";

const BOOKMARKLET = `javascript:(function(){var s=document.createElement('script');s.src='${ORIGIN}${ANYWHERE_SCRIPT_PATH}?'+Date.now();document.documentElement.appendChild(s)})()`;

function ToolRows({ rows }: { rows: { name: string; description: string; read: boolean }[] }) {
  return (
    <ul className="my-4 divide-y divide-white/10 rounded-lg border border-white/10">
      {rows.map((t) => (
        <li key={t.name} className="flex gap-4 px-4 py-3">
          <div className="w-52 shrink-0">
            <code className="text-[12px] text-[#f0b59e]">{t.name}</code>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-[#8a8a92]">{t.read ? "read-only" : "acts on the page"}</div>
          </div>
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-[#b9b9c0]">{t.description}</p>
        </li>
      ))}
    </ul>
  );
}

export default function WebMcpPage() {
  const server = WEBMCP_TOOLS.map((t) => ({ name: t.name, description: t.description, read: t.annotations.readOnlyHint === true }));
  const page = PAGE_TOOLS.map((t) => ({ name: t.name, description: t.description, read: t.annotations.readOnlyHint === true }));
  const anywhere = ANYWHERE_TOOLS.map((t) => ({ name: t.name, description: t.description, read: t.readOnly }));

  return (
    <article>
      <H1 kicker="Agent surface">The design system, as tools on the page</H1>
      <P>
        WebMCP lets a page register tools with the browser (
        <Code>document.modelContext.registerTool</Code>), so an agent working in
        that browser can call them. BlockSmith registers its governance engine
        that way: on a design system&apos;s page the agent gets the rules of
        the system the human is looking at, bound to that document — not a copy
        in a prompt, not a guess.
      </P>
      <Callout>
        <strong>Discovery:</strong> the whole surface is published at{" "}
        <a className="underline underline-offset-2" href={WEBMCP_MANIFEST_PATH} target="_blank" rel="noreferrer">
          {WEBMCP_MANIFEST_PATH}
        </a>{" "}
        — every tool, its schema, where it is registered, and how to invoke it —
        generated from the registry, so it cannot list a tool that does not exist.
      </Callout>

      <H2>1 · On a design system page</H2>
      <P>
        {WEBMCP_REGISTERED_TOOL_COUNT} tools on every <Code>/wiki</Code> page.
        Switching design systems re-registers them and fires{" "}
        <Code>toolchange</Code>: <Code>check_component</Code>&apos;s schema carries an
        enum of the open system&apos;s components, so the agent cannot name one the
        system does not have. Open the panel at the top of any wiki page to see
        the live list.
      </P>
      <P>
        <strong>Only in the page</strong> — these need the reader&apos;s screen, which
        no remote server has:
      </P>
      <ToolRows rows={page} />
      <P>
        <strong>Dispatched to the server</strong> — registered in the page, answered by{" "}
        <Code>POST /api/webmcp/invoke</Code>:
      </P>
      <ToolRows rows={server} />

      <H2>2 · On the dashboard</H2>
      <P>
        The signed-in home registers the read-only tools against the default
        system, so an agent can read rules, check a snippet or capture a site
        before any page is chosen.
      </P>

      <H2>3 · On any website</H2>
      <P>
        The same tools, on a page BlockSmith did not build. Drag the button to
        your bookmarks bar, open any site, click it: the script registers{" "}
        {ANYWHERE_TOOLS.length} tools with that page&apos;s{" "}
        <Code>document.modelContext</Code>. An agent browsing the site can then
        capture its design system, or audit what the page paints against a
        system you govern — &ldquo;the page says <Code>#4c70e8</Code>, the system
        says <Code>#4c6ee6</Code>&rdquo;.
      </P>
      <div className="my-4 flex flex-wrap items-center gap-3">
        <BookmarkletLink code={BOOKMARKLET} label="⚒ BlockSmith on this page" />
        <span className="text-[12px] text-[#8a8a92]">← drag to your bookmarks bar</span>
      </div>
      <ToolRows rows={anywhere} />
      <P>
        Sites with a strict Content-Security-Policy block bookmarklet scripts.
        The extension in <Code>extension/</Code> injects the same script as a
        content script in the page&apos;s main world, which CSP does not govern:{" "}
        <Code>chrome://extensions</Code> → Developer mode → Load unpacked →
        the <Code>extension</Code> folder. Both need Chrome with{" "}
        <Code>chrome://flags/#enable-webmcp-testing</Code>.
      </P>
      <Pre>{`// what the script registers, in outline
document.modelContext.registerTool({
  name: "blocksmith_audit_this_page",
  inputSchema: { type: "object", properties: { doc: { type: "string" } } },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  execute: async ({ doc }) => {
    const styles = collect();               // colours, fonts, radii the page paints
    const res = await fetch("${ORIGIN}/api/webmcp/invoke", {
      method: "POST",
      body: JSON.stringify({ tool: "audit_page_styles", args: { styles }, doc }),
    });
    return { content: [{ type: "text", text: (await res.json()).text }] };
  },
});`}</Pre>

      <H2>4 · Figma says X, code says Y</H2>
      <P>
        <Code>figma_token_drift</Code> takes what an agent&apos;s Figma MCP returns
        from <Code>get_variable_defs</Code> and compares it with the open design
        system: tokens that agree, tokens that differ in value, tokens that were
        renamed (same value, different name), near misses (a colour a few levels
        off), and tokens that exist on one side only. Renames and near misses are
        told apart from real drift, because an agent told &ldquo;these differ&rdquo;
        will change one of them.
      </P>
      <Pre>{`// in a wiki page, from any WebMCP-capable agent
figma_token_drift({
  variables: { "Color/Brand": "#4c70e8", "Radius/Medium": "8" },
  fileKey: "AbC123"
})
// → # Figma vs Cohere
//   3 agree · 1 differ · 0 renamed · 1 near misses · 0 Figma only · 12 code only
//   ## Near misses
//   - \`--color-brand\`: Figma #4c70e8, nearest in code #4c6ee6 (Accent) — a near miss, likely drift`}</Pre>

      <H2>5 · Outside a browser</H2>
      <P>
        The same engine is a remote MCP server at <Code>/api/mcp</Code>{" "}
        (Streamable HTTP, Bearer API key) with {BLOCKSMITH_MCP_TOOL_NAMES.length}{" "}
        tools for Cursor, Claude Code and CI. The in-page surface is deliberately
        narrower: each tool costs the agent context and completion time, and a
        page has one job.
      </P>

      <H2>What is enforced, not assumed</H2>
      <P>
        Chrome&apos;s budgets — 30 characters per tool name, 500 per description,
        1,500 per result — are asserted by <Code>npm run verify:webmcp</Code>,
        which also checks that every count in the README and submission matches
        the registry, that the page tools declared here match the ones the wiki
        registers, and that the tools this script advertises are the ones it
        registers.
      </P>
    </article>
  );
}
