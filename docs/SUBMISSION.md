# WebMCP Challenge — submission text

Paste-ready answers to the four required points. Keep the claims here in sync
with what the code actually does; every number below is measured, not
estimated.

---

## What it is

**BlockSmith** — the design-system wiki a team already uses, which now hands the
agent looking at it that system's rules, and refuses the work that breaks them.

Open the wiki on a design system and ask your agent for a component. It reads
the rules through WebMCP tools, writes the component into your editor, and gets
back a verdict. When the verdict is `REJECTED`, it carries the rule that was
broken and the value to use instead — so the agent corrects itself in the same
turn, while you watch it happen.

---

## Why this use case is a strong fit for WebMCP

A browser agent can already read a page: its text, its DOM, its computed
styles, its rendered output. What it cannot read is **intent** —

- `radius-lg` is locked on this surface
- marketing pages allow one token deviation, product pages allow none
- `Card/Product` is deprecated; the canonical component is `Surface`
- this system does not do tooltips, and inline help is what you use instead

None of that is a property of the page. It is a set of decisions *about* the
page, and no amount of DOM inspection recovers it. A tool is not a faster route
to this information — it is the only route.

That inverts the usual WebMCP demo. Most agent-native apps give an agent more
power: search the catalogue, add to cart, book the room. This one gives it
**boundaries**, authored by the party that owns the design system rather than by
the agent's operator.

## How it creates a better user experience

**The failure it removes is silent.** An agent that guesses a hex code produces
something plausible. It compiles, it renders, and it is wrong in a way that
surfaces three days later in review — or never. Governance turns an invisible
failure into an immediate, specific one.

**The correction happens in the same turn.** The verdict is not a status code:

```
REJECTED — 11 violation(s) in Portfolio.
- Line 3: `shadow-lg` — Shadows are not allowed in this design system.
  Rule: "Do not add drop shadows to cards or buttons. Separation comes from
  the Rule (#e2e4ea) hairline and from space, not elevation."
- Line 3: `p-5` resolves to 20px, not on the spacing scale. Use `p-4` (16px).
- Line 4: `text-blue-600` is a stock Tailwind color, not a design token.
```

**The human and the agent are on the same page, literally.** The tools register
on the wiki the design team already uses, bound to the document open on screen.
The same check a reviewer runs from the Governance page is the one the agent
gets — one answer, not two.

**Nobody has to have a design system already.** Four curated presets ship with
it, and `capture_site_design` reads the colours, typefaces, radii and spacing
straight out of any public page's CSS.

## What people and agents can do together that was difficult before

**Negotiate capability instead of hallucinating it.** Ask for a tooltip and the
system answers with its own position:

```
**Tooltip** — not part of this design system. Use **Meta Label** instead.
```

The agent stops inventing components that do not exist. This is a different and
larger problem than wrong colour values.

**Work against rules that change underneath them.** WebMCP's own documented
limitation is that tools go stale — Chrome's docs note that clients must visit a
site directly to know what it offers. Here the tool surface is bound to the
design system: `check_component`'s schema carries an enum of the active system's
components, and re-registers when the reader opens a different system.
Verified: Portfolio's enum carries 11 component names, SaaS's carries 13
different ones. The agent cannot name a component the system on screen does not
have.

**Split the repair by who should make it.** `fix_violations` applies every
mechanical correction and refuses the rest. On the sample card it takes 11
violations to 6 — and the 6 it leaves are exactly the ones a human should
decide: a blue with no near token, and a gradient whose removal changes the
composition rather than a value.

## How WebMCP was implemented

Tools are registered on `document.modelContext` from a single shared registry
(`src/lib/webmcp/registry.ts`), which the remote MCP server at `/api/mcp` reads
too — so the two transports cannot drift apart.

```js
await document.modelContext.registerTool({
  name: "check_governance",
  description: "Check UI code against the active design system…",
  inputSchema: { type: "object", properties: { code: { type: "string" } },
                 required: ["code"] },
  annotations: { readOnlyHint: true },
  execute: async ({ code }) => {
    const res = await fetch("/api/webmcp/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: "check_governance", args: { code }, doc }),
    });
    const { text } = await res.json();
    return { content: [{ type: "text", text }] };
  },
}, { signal: controller.signal });
```

`useWebMcp` binds registration to an `AbortController` — unmounting, or any
change to a tool's name, description, schema or annotations, aborts and
re-registers. That is what makes the surface live rather than static.

**Twelve server tools** answer questions about the design system and dispatch over
HTTP — including `figma_token_drift` (Figma says X, code says Y, with renames and
near misses told apart from real drift) and `audit_page_styles` (what a live page
paints, judged against a system). **Three page tools** can only run in the browser:
`propose_component` and `propose_design_change`, which put work on the human's
screen for approval, and `get_current_context`, which reports the design system
and page the reader has open — the thing a remote MCP server cannot answer.
Fifteen in total. A bookmarklet or the extension registers **four tools on any
website** (`public/webmcp/blocksmith.js`), and `/.well-known/webmcp.json` is a
discovery manifest generated from the registry.

### Decisions worth calling out

- **Chrome's budgets are enforced, not assumed.** Output is capped at 1,500
  characters. Because a design system can produce far more violations than that,
  the list is capped at 8 with a stated remainder rather than letting a fix
  instruction get truncated mid-sentence. `npm run verify:webmcp` asserts every
  name, description, parameter and output stays inside the limits.
- **`untrustedContentHint` on `capture_site_design`.** It returns content
  fetched from an arbitrary third-party origin — a textbook indirect
  prompt-injection vector. The tool is also SSRF-guarded: localhost, private
  ranges and `169.254` cloud metadata are refused, with a timeout and a byte cap.
- **`readOnlyHint` on every read tool**, and the dispatch route refuses to
  execute anything that is not read-only, so state changes cannot be driven
  through it.
- **The page works without WebMCP.** No agent means a line saying so, not a
  broken page. In development, `?agent=sim` installs a spec-shaped stub so the
  registration path stays testable without the Chrome flag.

---

## Testing

```bash
npm run verify:webmcp   # budgets, per-preset governance, auto-fix safety
npm run typecheck
npm run build
```

`verify:webmcp` asserts, for each preset, that compliant code passes and the
classic AI-generated card is rejected — a linter that passes everything looks
identical to one that works. It also asserts auto-fix never increases
violations, never rewrites clean code, and is idempotent, since a
non-idempotent repair would loop an agent forever.

`evals/webmcp.evals.json` holds the tool-selection evaluation cases (10 of them) in Chrome's documented
format, for the evals CLI in `GoogleChromeLabs/webmcp-tools`.

## Honest limits

- Enforcement is mechanical: colours, spacing, type sizes, radii, Tailwind
  classes, the categorical rules a system states, and composition contracts
  (how many primaries, what may nest, what must accompany what). It does not
  judge hierarchy or whether a layout is any good.
- Enforcing a design system makes output *more* uniform, not less. This is not
  a cure for AI sameness — it is a way to choose which sameness you get.
- `capture_site_design` reads what CSS states. It cannot see why a choice was
  made, so what it returns is a starting point a human still has to shape.
