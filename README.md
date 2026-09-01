# BlockSmith

**Turn any website's design into a skill your coding agent can use — with governance tools that reject the components which violate it.**

Built for the **WebMCP Challenge**. BlockSmith exposes its design-system governance engine as [WebMCP](https://github.com/webmachinelearning/webmcp) tools, so an agent working alongside you in the browser can read your design system, propose changes, and *get told no* when a change breaks it.

**Live:** **<https://blocksmithv1.vercel.app/wiki?doc=saas.md>** — open it in ChatGPT's in-app browser, or in Chrome with `chrome://flags/#enable-webmcp-testing` enabled, and the page hands your agent sixteen tools. No sign-in needed to read, check code, or capture a site.

**Every tool, its schema and where it is registered:** [`/.well-known/webmcp.json`](https://blocksmithv1.vercel.app/.well-known/webmcp.json) · **How it works:** [`/protocol/webmcp`](https://blocksmithv1.vercel.app/protocol/webmcp) · **License:** [MIT](./LICENSE)

---

## Why this is a WebMCP use case

Most agent-native apps give an agent *more power* — search the catalog, add to cart, book the room. BlockSmith gives it **boundaries**.

An AI agent editing UI in a browser has no way to know your team's locked design tokens, your deviation budget, or which components are frozen. It guesses, produces plausible-looking code, and someone catches it in review three days later — or doesn't.

With WebMCP, the page hands the agent those constraints as executable tools. `check_governance` doesn't just validate — it returns **the violated rule and the compliant alternative**, so the agent self-corrects in the same turn, while the human watches the page update.

That is the thing that was difficult before: the human and the agent operating on the *same live design system state*, with the site itself as the referee.

## What people and agents do together here

| The human | The agent |
|---|---|
| Opens their design system in the wiki | Reads the screen with `get_current_context` |
| Asks for a component | Calls `get_governance_rules` before writing a line |
| Pastes it into Governance, or edits in the Playground | `check_governance` returns the verdict inline |
| Sees `REJECTED` with the rule quoted | Calls `fix_violations` and self-corrects |
| Switches design system | Its tool schemas re-register — `toolchange` fires |
| Names a site they like | Calls `capture_site_design`, which saves it as a system they can build against |
| Leaves for their editor | Calls `export_skill` so the same rules follow them there |

Every tool call the agent makes is listed on the page. An agent working in a
sidebar the human cannot see is indistinguishable from one making things up.

## How WebMCP is implemented

Tools are registered against `document.modelContext` from a single shared registry, so the in-page WebMCP tools and the remote MCP server (`/api/mcp`, Streamable HTTP) can never drift apart.

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

Registration is lifecycle-bound: `useWebMcp()` registers on mount and aborts the `AbortController` on unmount, so tools appear and disappear with the page state they belong to.

### Design decisions worth calling out

- **Tool output stays under 1,500 characters.** Chrome enforces this. A `design.md` is 10–50× that, so tools return a summary plus a link — never the document itself.
- **`untrustedContentHint` on `capture_site_design`.** That tool returns content fetched from an arbitrary third-party URL, which is a textbook indirect prompt-injection vector. The annotation tells the agent to treat the result as data, not instructions.
- **`readOnlyHint` split.** Every `get_*` and `check_*` tool is marked read-only so the agent knows which actions need confirmation.
- **Composition is checked, not just values.** `check_governance` catches two primary actions in one view, a card nested inside itself, and a card missing its required label — rules about arrangement that no value-level linter can see.
- **Every violation is citable.** Each carries a stable rule id (`off-token-color`, `banned-gradient`, `contract-max`).
- **The in-page surface is scoped to what a page can answer.** Sixteen tools are registered on a design system's page: its rules, its components, what it has ruled out, and checks against it. The remote MCP server carries a different sixteen — scanning a repository, generating a package, reading the lockfile — because those are questions about a codebase, not about the page in front of you. Each tool costs an agent context and completion time, so neither surface carries the other's.
- **Auditing a site needs nothing installed.** `audit_site` judges any public address against a system from the server. The extension's version of the same question answers it for the page you are standing on, which is the only part that genuinely requires code running in that page.
- **Discovery is generated, not written.** `/.well-known/webmcp.json` lists every tool, its schema, where it is registered and how it is invoked, built from the registry at request time.
- **The tool surface is live.** `check_component`'s schema carries an enum of the active system's components. Switching design systems re-registers the tools and fires `toolchange`, so the agent's options change with the rules — it cannot name a component the current system doesn't have.
- **Auto-fix stops where judgement starts.** `fix_violations` applies every mechanical repair and returns what it refused to touch: colours with no close token, and rules like "no gradients" whose fix changes the composition rather than a value.

---

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

To exercise the WebMCP tools, enable the API in Chrome:

1. Visit `chrome://flags/#enable-webmcp-testing`, enable it, relaunch.
2. Open <http://localhost:3000/wiki?doc=portfolio.md>, then DevTools → **Application** → **WebMCP** to see registered tools and invoke them manually.

Without the flag the wiki still works — it simply does not show the agent line.

Or open the deployed URL in **ChatGPT's in-app browser**, which supports WebMCP natively.

### Capturing a site on a deployed host

Capture reads the *rendered* page, which needs a Chromium. Locally it uses one
already on your machine. Serverless hosts have neither a browser nor room to
bundle one, so point it at a remote browser instead — any provider that speaks
CDP works:

```bash
BLOCKSMITH_BROWSER_WS=wss://your-browser-host/?token=…
```

Without it, capture still works and falls back to reading CSS text — thinner,
and no components. The tool says which pass it used, so a thin result never
looks like a broken one.

### Environment

Copy `.env.example` to `.env.local` and fill in what you need. The public demo route runs without credentials; Supabase and model keys are only required for authenticated projects and live capture.

---

## Project structure

```
src/
├── app/wiki/            # the design system UI — and where the tools register
├── components/wiki/     # shell, Governance check panel, Component Playground
├── lib/webmcp/          # shared tool registry — one source of truth
│   └── dev-polyfill.ts  # spec-shaped stub for testing without the flag
├── hooks/useWebMcp.ts   # registration lifecycle, AbortSignal-bound
├── app/api/webmcp/      # server dispatch
├── lib/governance/      # colour, scale, Tailwind, rule and capability checks
│   └── autofix.ts       # applies what is mechanical, refuses what is not
├── lib/ingest/          # capture a public site's tokens
├── lib/mcp/             # remote MCP server (Streamable HTTP)
└── mcp/handlers.ts      # implementations, transport-agnostic
docs/designs.md/         # the design systems themselves, as markdown
evals/                   # tool-selection evals
packages/                # @blocksmith CLI, SDK, protocol
```

## Verify

```bash
npm run verify:webmcp   # budgets, per-preset governance, auto-fix safety
npm run typecheck
npm run build
```

## Other surfaces

- **IDE → Web:** save `docs/designs.md/*.md`, the wiki refreshes over SSE
- **Web → IDE:** edit in the wiki, **Finalize** writes back to the `.md`
- **Remote MCP:** `npm run mcp` for Cursor and other MCP clients

```bash
npm run verify:workable      # full local product check
npm run build:packages
```

## License

MIT — see [LICENSE](./LICENSE).
