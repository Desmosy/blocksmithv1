# BlockSmith

**Turn any website's design into rules your coding agent must follow. When the agent breaks a rule, BlockSmith tells it no, and tells it how to fix it.**

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/VERSION-0.1.0-3fb950?style=flat-square&labelColor=24292f">
  <img alt="WebMCP tools" src="https://img.shields.io/badge/WEBMCP_TOOLS-16-3fb950?style=flat-square&labelColor=24292f">
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/Desmosy/blocksmithv1?style=flat-square&label=STARS&color=e8963a&labelColor=24292f">
  <a href="https://github.com/Desmosy/blocksmithv1/actions/workflows/protocol-conformance.yml"><img alt="Protocol conformance" src="https://img.shields.io/github/actions/workflow/status/Desmosy/blocksmithv1/protocol-conformance.yml?style=flat-square&logo=github&label=protocol%20conformance&labelColor=24292f"></a>
  <img alt="License" src="https://img.shields.io/badge/LICENSE-AGPL--3.0-8957e5?style=flat-square&labelColor=24292f">
</p>

<p align="center">
  <img alt="ChatGPT WebMCP" src="https://img.shields.io/badge/ChatGPT-WebMCP-10a37f?style=flat-square&logo=openai&logoColor=white&labelColor=24292f">
  <img alt="Claude Code skill" src="https://img.shields.io/badge/Claude_Code-Skill-e07a5f?style=flat-square&logo=claude&logoColor=white&labelColor=24292f">
  <img alt="Agent SKILL.md" src="https://img.shields.io/badge/Agent-SKILL.md-3b5bd9?style=flat-square&labelColor=24292f">
</p>

Built for the **WebMCP Challenge**. BlockSmith puts its design-system governance engine on the page as [WebMCP](https://github.com/webmachinelearning/webmcp) tools. An agent working in your browser can read your design system, build against it, and get corrected the moment it drifts.

**Live app:** <https://blocksmithv1.vercel.app>

**All tools and schemas:** [`/.well-known/webmcp.json`](https://blocksmithv1.vercel.app/.well-known/webmcp.json) · **How it works:** [`/protocol/webmcp`](https://blocksmithv1.vercel.app/protocol/webmcp) · **License:** [AGPL-3.0](./LICENSE)

---

## How to use BlockSmith

### 1. With ChatGPT (easiest, nothing to install)

The ChatGPT desktop app has a built-in browser that supports WebMCP out of the box.

1. Open the ChatGPT desktop app.
2. Ask it to open `https://blocksmithv1.vercel.app/dashboard` in its browser.
3. Talk to it in plain words. Some things to try, in order:

```
Capture the design system from stripe.com
```
ChatGPT calls BlockSmith's capture tool. BlockSmith reads the live site, pulls out its colors, type, spacing and components, and saves it as a design system with its own wiki.

```
Open the wiki for the system you just captured
```
You get a full design-system site: tokens, components, do's and don'ts, and a guide written for agents.

```
Build me a landing page for a coffee brand using this design system
```
ChatGPT writes the page, runs it through `check_governance`, fixes what gets rejected, and shows you the result rendered in the system's own tokens. You can open it full page, view the code, or download the HTML.

```
Change the primary button to bright red
```
If red is not in the system, the agent gets told no, with the rule quoted and the closest allowed color suggested. That is the whole point.

### 2. With Chrome

1. Go to `chrome://flags/#enable-webmcp-testing`, enable it, restart Chrome. You need Chrome 149 or later.
2. Open <https://blocksmithv1.vercel.app/wiki?doc=saas.md>.
3. The page registers its tools automatically. Open DevTools, then **Application**, then **WebMCP** to see them and call them by hand, or let your agent use them.

No sign-in is needed to read a system, check code, or capture a site.

### 3. Run it on your machine

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Everything works without credentials. Supabase and model keys are only needed for accounts and live capture. Copy `.env.example` to `.env.local` if you want those.

One note on capture: reading a rendered page needs a Chromium. On your machine BlockSmith finds one automatically. On a serverless host, point it at any remote browser that speaks CDP:

```bash
BLOCKSMITH_BROWSER_WS=wss://your-browser-host/?token=...
```

Without it, capture falls back to reading the site's CSS. You get a thinner result, and the tool tells you which kind you got.

### 4. In your editor

The rules can follow you out of the browser:

- **Export a skill.** Ask the agent to `export_skill`, or download it from the wiki. Your coding agent in Cursor or Claude Code then writes compliant code from the start.
- **Remote MCP.** Run `npm run mcp`, or point an MCP client at `/api/mcp`. Same tools, same registry.
- **Two-way sync.** Save a file in `docs/designs.md/` and the wiki refreshes. Edit in the wiki and hit **Finalize**, and it writes back to the markdown.

---

## Why this is a WebMCP use case

Most agent apps give the agent more power: search this, buy that. BlockSmith gives it **boundaries**.

An agent editing UI has no way to know your locked tokens, your frozen components, or your team's rules. So it guesses. The guess looks fine, ships, and someone catches it in review three days later. Or nobody does.

With WebMCP, the page itself hands the agent the rules as tools it can call. `check_governance` does not just say invalid. It returns the exact rule broken and the compliant value to use instead, so the agent fixes its own work in the same turn while you watch the page update.

That is the new thing here: the human and the agent working on the same live design system, with the site as the referee.

## What people and agents do together

| You | The agent |
|---|---|
| Open your design system in the wiki | Reads the screen with `get_current_context` |
| Ask for a component | Calls `get_governance_rules` before writing a line |
| Paste code into Governance | `check_governance` returns the verdict inline |
| See `REJECTED` with the rule quoted | Calls `fix_violations` and corrects itself |
| Switch design systems | Its tool schemas re-register and `toolchange` fires |
| Name a site you like | Calls `capture_site_design` and saves it as a system |
| Leave for your editor | Calls `export_skill` so the rules follow you |

Every tool call the agent makes is listed on the page, so you always see what it did.

## How WebMCP is implemented

Tools register against `document.modelContext` from one shared registry, so the in-page tools and the remote MCP server (`/api/mcp`, Streamable HTTP) can never drift apart.

```js
document.modelContext.registerTool({
  name: "check_governance",
  description:
    "Check UI code against the active design system. Returns each violation with the rule it breaks and the compliant token to use instead.",
  inputSchema: {
    type: "object",
    properties: {
      code: { type: "string", description: "The component source to check" },
      component: { type: "string", description: 'Component name, e.g. "Button"' },
    },
    required: ["code"],
  },
  annotations: { readOnlyHint: true },
  execute: async ({ code, component }) => {
    const res = await fetch("/api/webmcp/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: "check_governance", args: { code, component } }),
    });
    const { text } = await res.json();
    return { content: [{ type: "text", text }] };
  },
}, { signal: controller.signal });
```

Registration is tied to the page lifecycle: `useWebMcp()` registers on mount and aborts on unmount, so tools appear and disappear with the page they belong to.

### Design decisions worth knowing

- **Tool output stays under 1,500 characters.** Chrome enforces this. A `design.md` is far bigger, so tools return a summary plus a link, never the whole document.
- **`untrustedContentHint` on `capture_site_design`.** That tool returns content from an arbitrary third-party URL, a classic prompt-injection vector. The annotation tells the agent to treat it as data, not instructions.
- **`readOnlyHint` split.** Every `get_*` and `check_*` tool is marked read-only, so the agent knows which actions need confirmation.
- **Composition is checked, not just values.** Two primary buttons in one view, a card nested in itself, a missing required label. Rules about arrangement that a value linter cannot see.
- **Every violation carries a stable rule id** like `off-token-color` or `banned-gradient`, so it can be cited and tracked.
- **The tool surface is live.** `check_component` carries an enum of the active system's components. Switch systems and the tools re-register with new schemas, so the agent cannot name a component the current system does not have.
- **Auto-fix stops where judgement starts.** `fix_violations` applies every mechanical repair and returns what it refused to touch, like a color with no close token, because picking one is a design decision.
- **Discovery is generated, not written.** `/.well-known/webmcp.json` is built from the registry at request time.

---

## Project structure

```
src/
├── app/wiki/            # the design system UI, where the tools register
├── components/wiki/     # shell, governance panel, component playground
├── lib/webmcp/          # shared tool registry, one source of truth
│   └── dev-polyfill.ts  # spec-shaped stub for testing without the flag
├── hooks/useWebMcp.ts   # registration lifecycle
├── app/api/webmcp/      # server dispatch
├── lib/governance/      # color, scale, Tailwind, rule and capability checks
│   └── autofix.ts       # applies what is mechanical, refuses what is not
├── lib/ingest/          # capture a public site's design
├── lib/mcp/             # remote MCP server (Streamable HTTP)
└── mcp/handlers.ts      # implementations, transport-agnostic
docs/designs.md/         # bundled design systems, as markdown
evals/                   # tool-selection evals
packages/                # @blocksmith CLI, SDK, protocol
```

## Verify

```bash
npm run verify:webmcp   # budgets, per-preset governance, auto-fix safety
npm run typecheck
npm run build
```

## License

[AGPL-3.0-only](./LICENSE). Use it, self-host it, build on it. If you modify it and offer it to others, including as a hosted service, you must share your modified source under the same license. See [LICENSING.md](./LICENSING.md).

The BlockSmith name and logo are not part of the license grant.
