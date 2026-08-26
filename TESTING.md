# How to test this

Three paths, easiest first. **Path 1 needs nothing** — no API keys, no browser
flags, no sign-in. Paths 2 and 3 add the agent.

```bash
npm install
npm run dev
```

Open <http://localhost:3000/wiki?doc=portfolio.md>. That is the whole setup.

---

## Path 1 — no agent (2 minutes)

This is the product with a human driving. Everything here works in any browser.

**1. Browse the design system.** Colour, Typography, Spacing, Components — this
is the wiki, the surface a design team actually uses. Swap systems with the
`?doc=` parameter: `portfolio.md`, `saas.md`, `docs.md`, `apollo.md`.

**2. Go to Governance** in the left sidebar. Under the fidelity score there is
**Check code against this system**. Click *"Paste a typical AI component"* — it
loads a pricing card of the kind an AI produces, with a purple gradient,
`shadow-lg`, `p-5`, `text-blue-600`.

It should say **REJECTED**, each violation with a line, a rule id, and the fix.
The gradient one is the point. It doesn't say "gradient not allowed" — it quotes
the design system's own sentence back:

> `banned-gradient` — Gradients are not allowed in this design system.
> Rule: *"Do not use gradients anywhere, including on buttons and backgrounds."*

**3. Change the `?doc=` to `saas.md`** and paste the same code. Different rules,
different violations, different quoted sentences. The code never moved; the
system judging it did.

**4. Open Component Playground** under Explore. Pick a component and move the
controls. The governance panel underneath re-checks the exported CSS and HTML as
you edit — the same check, on what you are actually building.

---

## Path 2 — see the agent tools, no browser flag (3 minutes)

If your Chrome already has WebMCP (see Path 3), skip the query string — the
tools register on their own. Otherwise this repo ships a spec-shaped stub:
append `?agent=sim`. **Development only; it never installs in production**, and
it steps aside if a real implementation is present.

Open <http://localhost:3000/wiki?doc=portfolio.md>. A line appears under the
page header: **11 agent tools live on this page**.

Open DevTools → Console and paste:

```js
const mc = document.modelContext;
const tools = await mc.getTools();
const byName = (n) => tools.find(t => t.name === n);

// Chrome passes arguments as a JSON string and returns a string — the spec
// declares Promise<DOMString>, not a structured result. Parse it yourself.
const run = async (n, a = {}) =>
  JSON.parse(await mc.executeTool(byName(n), JSON.stringify(a))).content[0].text;

tools.map(t => t.name);
```

Then try the interesting ones:

```js
// Can I use a tooltip? — the system answers with its own position
await run("check_capability", { pattern: "Tooltip" });
// → "**Tooltip** — not part of this design system. Use **Meta Label** instead."

// Composition, not just values — two primaries where one is allowed
await run("check_governance", { code:
  '<div><PrimaryActionButton>Hire</PrimaryActionButton><PrimaryActionButton>CV</PrimaryActionButton></div>' });
// → contract-max: 2 used, 1 allowed.

// What the reader has open — a remote MCP server cannot answer this
await run("get_current_context");
```

**The one that only works because it is a web page.** The tool schemas are bound
to the design system on screen. Load `?doc=saas.md` instead and re-run:

```js
(await mc.getTools()).find(t => t.name === "check_component")
  .inputSchema.properties.component.enum;
```

Portfolio gives 11 component names, SaaS gives 13 different ones. The agent
cannot name a component the system it is looking at does not have.

### Point it at a real website

```js
await run("capture_site_design", { url: "https://stripe.com" });
```

It reads the colours, typefaces, spacing and radii out of that page's CSS,
saves them as a design system, and returns the doc ref. Then govern against it:

```js
await run("check_governance", { code: '<div style={{ padding: 37 }}/>' });
```

### Get the rules out as a file

```js
await run("export_skill");
```

Returns a URL. Open it, or:

```bash
curl -s 'http://localhost:3000/api/webmcp/skill?doc=portfolio.md' > portfolio-skill.md
```

That's ~130 lines an agent loads in an editor where these tools aren't reachable.

---

## Path 3 — a real agent (the actual thing)

**Easiest:** open the deployed URL in **ChatGPT's in-app browser**, which
supports WebMCP natively. Then just ask it: *"Build me a pricing card that fits
this design system."* It will read the rules off the page, write the component,
get rejected, and fix itself.

**In Chrome:** visit `chrome://flags/#enable-webmcp-testing`, enable it, relaunch,
then open the page. Verify registration in DevTools → **Application → WebMCP**,
which lists every tool and lets you invoke them by hand.

Without the flag the wiki still works — it simply does not show the agent line.

---

## Verify the engine without the UI

```bash
npm run verify:webmcp
```

28 checks: Chrome's character budgets, per-preset governance (compliant code
must pass, the classic AI card must fail), auto-fix safety, capability matching,
and component contracts.

```bash
npm run typecheck && npm run build
```

---

## What needs a key, and what doesn't

Everything above runs with no configuration. Two things are gated because they
call a model: the **Screenshot** import on the dashboard, and the
governed-vs-ungoverned generation demo. They are hidden rather than broken when
no key is present. The wiki needs nothing.
