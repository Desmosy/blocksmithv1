# BlockSmith

**Turn any website's design into a skill your coding agent can use — with governance tools that reject the components which violate it.**

Built for the **WebMCP Challenge**. BlockSmith exposes its design-system governance engine as [WebMCP](https://github.com/webmachinelearning/webmcp) tools, so an agent working alongside you in the browser can read your design system, propose changes, and *get told no* when a change breaks it.

**Live demo:** _TBD_ · **License:** [MIT](./LICENSE)

---

## Why this is a WebMCP use case

Most agent-native apps give an agent *more power* — search the catalog, add to cart, book the room. BlockSmith gives it **boundaries**.

An AI agent editing UI in a browser has no way to know your team's locked design tokens, your deviation budget, or which components are frozen. It guesses, produces plausible-looking code, and someone catches it in review three days later — or doesn't.

With WebMCP, the page hands the agent those constraints as executable tools. `check_governance` doesn't just validate — it returns **the violated rule and the compliant alternative**, so the agent self-corrects in the same turn, while the human watches the page update.

That is the thing that was difficult before: the human and the agent operating on the *same live design system state*, with the site itself as the referee.

## What people and agents do together here

| The human | The agent |
|---|---|
| Opens a component page | Reads it with `get_current_context` |
| Asks for a variant | Calls `check_governance` before writing a line |
| Watches the token change land on screen | Calls `apply_token_change` behind the confirm gate |
| Points at another site | Calls `capture_site_design` to extract its system |
| Keeps working in their editor | Loads `export_skill` output so its next component is already correct |

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
- **Six tools, not fifteen.** The remote MCP server exposes fifteen. Each tool costs context window and completion time, so the in-page surface is deliberately narrow.

---

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

To exercise the WebMCP tools, enable the API in Chrome:

1. Visit `chrome://flags/#enable-webmcp-testing`, enable it, relaunch.
2. Open the app, then DevTools → **Application** → **WebMCP** to see registered tools and invoke them manually.

Or open the deployed URL in **ChatGPT's in-app browser**, which supports WebMCP natively.

### Environment

Copy `.env.example` to `.env.local` and fill in what you need. The public demo route runs without credentials; Supabase and model keys are only required for authenticated projects and live capture.

---

## Project structure

```
src/
├── lib/webmcp/        # shared tool registry — one source of truth
├── hooks/useWebMcp.ts # registration lifecycle
├── app/api/webmcp/    # server dispatch
├── lib/mcp/           # remote MCP server (Streamable HTTP)
├── mcp/handlers.ts    # tool implementations, transport-agnostic
├── lib/governance/    # the rules engine that says no
└── app/wiki/          # the design system UI humans use
packages/              # @blocksmith CLI, SDK, protocol
```

## Other surfaces

- **IDE → Web:** save `docs/designs.md/*.md`, the wiki refreshes over SSE
- **Web → IDE:** edit in the wiki, **Finalize** writes back to the `.md`
- **Remote MCP:** `npm run mcp` for Cursor and other MCP clients — see [`docs/MCP.md`](docs/MCP.md)

```bash
npm run verify:workable      # full local product check
npm run build:packages
```

## Docs

- [`docs/MCP.md`](docs/MCP.md) — the handshake, tools, and auth
- [`docs/BLOCKS-V1-SPEC.md`](docs/BLOCKS-V1-SPEC.md) — the design interchange format
- [`docs/DESIGN-CICD.md`](docs/DESIGN-CICD.md) — governance, staging, promotion
- [`HACKATHON.md`](./HACKATHON.md) — submission checklist

## License

MIT — see [LICENSE](./LICENSE).
