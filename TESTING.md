# How to test this

Three paths, easiest first. **Path 1 needs nothing** — no API keys, no browser
flags, no sign-in. Paths 2 and 3 add the agent.

```bash
npm install
npm run dev
```

Open <http://localhost:3000/lab>. That is the whole setup.

---

## Path 1 — no agent (2 minutes)

This is the product with a human driving. Everything here works in any browser.

**1. Look at the top-left pane.** That is the design system rendered in its own
typefaces — every colour, size and space comes from the parsed markdown, nothing
is hand-styled. Click between **Portfolio**, **SaaS**, **Docs** and **Apollo**
and watch it change completely. That is four different design systems, not four
themes.

**2. Look at the right pane.** The editor is pre-loaded with a pricing card of
the kind an AI typically produces — purple gradient, `shadow-lg`, `p-5`,
`text-blue-600`. It should say **REJECTED — 11 violations**, each with a line
number, a rule id, and the specific fix.

The gradient one is the point. It doesn't say "gradient not allowed" — it quotes
the design system's own sentence back:

> `bg-gradient-to-br` — Gradients are not allowed in this design system.
> Rule: *"Do not use gradients anywhere, including on buttons and backgrounds."*

**3. Click "Fix what can be fixed."** The code rewrites in place and a summary
appears: **5 applied · 6 need you**. Read the second list — it refused to touch
the gradient and the off-system blue, because removing a gradient changes the
composition and picking a replacement colour is a design decision. That refusal
is deliberate, not a gap.

**4. Switch to SaaS while the broken code is still there.** The verdict changes
— different rules, different violations, different quoted sentences. The code
never moved; the system judging it did.

**5. Edit the code yourself.** Type a colour that isn't a token. It re-checks as
you type.

---

## Path 2 — see the agent tools, no browser flag (3 minutes)

WebMCP is behind a Chrome flag, so this repo ships a spec-shaped stub for
testing. **Development only — it never installs in production**, even if you add
the query string.

Open <http://localhost:3000/lab?agent=sim>. The header should now say
**14 agent tools live on this page** in green.

Open DevTools → Console and paste:

```js
const mc = document.modelContext;
const run = async (n, a = {}) => (await mc.executeTool(n, a)).content[0].text;

// What the agent can see
(await mc.getTools()).map(t => t.name);
```

Then try the interesting ones:

```js
// Can I use a tooltip? — the system answers with its own position
await run("check_capability", { pattern: "Tooltip" });
// → "**Tooltip** — not part of this design system. Use **Meta Label** instead."

// The agent writes a component into the human's editor and gets judged
await run("propose_component", { code:
  '<div><PrimaryActionButton>Hire</PrimaryActionButton><PrimaryActionButton>CV</PrimaryActionButton></div>' });
// → contract-max: 2 used, 1 allowed. Watch the editor change as this runs.

// Change a token — the page re-renders and the rules change with it
await run("apply_token_change", { token: "Oxblood", value: "#1d4ed8" });
// The primary button turns blue. Now:
await run("check_governance", { code: '<a style={{ color: "#1d4ed8" }}/>' });  // PASS
await run("check_governance", { code: '<a style={{ color: "#8e2436" }}/>' });  // REJECTED
```

**The one to actually watch.** Switch design system from the agent and the tool
surface reshapes itself:

```js
let fired = 0;
mc.addEventListener("toolchange", () => fired++);
const before = (await mc.getTools()).find(t => t.name === "check_component")
  .inputSchema.properties.component.enum;

await run("use_preset", { preset: "saas.md" });
await new Promise(r => setTimeout(r, 800));

const after = (await mc.getTools()).find(t => t.name === "check_component")
  .inputSchema.properties.component.enum;
({ fired, before: before.length, after: after.length, sample: after.slice(0, 3) });
```

`toolchange` fires and the enum goes from Portfolio's 11 component names to
SaaS's 13 different ones. The agent can no longer name a component the current
system doesn't have.

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
supports WebMCP natively. Then just ask it: *"Build me a pricing card."* It will
read the rules, write the component, get rejected, and fix itself — with every
tool call listed on the page beside the editor.

**In Chrome:** visit `chrome://flags/#enable-webmcp-testing`, enable it, relaunch,
then open the page. Verify registration in DevTools → **Application → WebMCP**,
which lists every tool and lets you invoke them by hand.

Without the flag the page still works — it just says no agent is connected.

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
no key is present. `/lab` needs nothing.
