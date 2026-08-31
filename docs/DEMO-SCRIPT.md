# Demo script — WebMCP Challenge

A rehearsed run for the <3-minute video and for a live judge walkthrough.
Every line of output quoted here was captured from a real run on
2026-08-26; none of it is illustrative. If a number here stops matching,
`npm run verify:webmcp` fails.

**Typing during the demo: two URL edits and one sentence.** Everything else is
a click or is already on screen.

---

## Record against production, not localhost

`https://blocksmithv1.vercel.app` is the URL a judge can open themselves, and
it is now as fast as local: **0.5s warm, 3s cold**. Localhost is the fallback
if your network is unreliable on the day.

## Before you start (5 minutes, off camera)

**1. Warm every page you will visit.** The first render of a design system
parses and compiles server-side; a cold one costs three seconds and a judge
watches a spinner.

```bash
BLOCKSMITH_DEMO_URL=https://blocksmithv1.vercel.app npm run demo:reset
```

Run it **twice**. The second run must report every system under 1500ms — if
one is still cold, something is compiling and you are not ready.

**2. Enable WebMCP in Chrome.** `chrome://flags/#enable-webmcp-testing` →
Enabled → Relaunch. Confirm in any tab's console that `document.modelContext`
prints an object rather than `undefined`.

`?agent=sim` installs a shim **in development only** — it is never installed on
the production build, so it is not a fallback for a recorded run.

**3. Open these tabs in order**, so you never type a URL under pressure:

1. `https://blocksmithv1.vercel.app/wiki?doc=portfolio.md`
2. `https://blocksmithv1.vercel.app/wiki?doc=saas.md`
3. `https://cohere.com` — for the any-site beat
4. `https://blocksmithv1.vercel.app/.well-known/webmcp.json`

Confirm tab 1 shows **15 agent tools live on this page**. Click it once to
check the panel opens, then close it again — you will open it on camera.

---

## The run

### 0:00–0:20 · The problem, stated once

> "An AI agent writing UI produces something plausible. It compiles, it renders,
> and it is wrong in a way only your design system knows about — so nobody
> catches it until review, or ever."

On screen: the Portfolio wiki, scrolled slowly through Colour and Typography.

> "This is a design system wiki. Real decisions, made by a team. None of them
> are visible to an agent looking at a rendered page."

### 0:20–0:50 · The refusal that teaches

Click **Governance** in the sidebar → **Try a typical AI component**.

Say nothing for three seconds. Let the verdict land.

> "Eleven violations. Not 'invalid colour' — it quotes the rule the team wrote."

Point at this line:

```
Line 1 `banned-shadow` — `shadow-lg` — Shadows are not allowed in this design
system. Rule: "Do not add drop shadows to cards or buttons. Separation comes
from the Rule (#e2e4ea) hairline and from space, not elevation."
```

> "That sentence was authored by a designer. The tool is handing it back."

### 0:50–1:20 · The same code, judged differently

Switch to tab 2 (`?doc=saas.md`). Paste the same component.

> "Same code. Different team. Different verdict."

The SaaS shadow rule is the one to read aloud, because it is not a blanket ban:

```
"Do not add drop shadows to cards, tables, buttons, inputs, or nav. Only the
three floating overlays may carry one: the Select Menu panel, the Tooltip, and
a modal."
```

> "The code never moved. The system judging it did."

### 1:20–1:50 · Intent, not interface — the strongest 30 seconds

Ask the agent, or invoke by hand:

```js
await run("check_capability", { pattern: "Tooltip" });
```

**Portfolio:**
```
**Tooltip** — not part of this design system. Use **Meta Label** instead.
```

**SaaS:**
```
**Tooltip** — available. A short label for an icon-only control or a
truncated cell.
```

> "Nothing on either screen says whether this system has tooltips. There is no
> pixel to read. That answer exists only because a team decided it — and the
> page just handed it to the agent."

This is the moment that separates the project from every "agent clicks buttons
faster" submission. Do not rush it.

### 1:50–2:30 · The repair, split by who should make it

Click **Fix violations**.

> "It applied five. It refused six — and look at *which* six."

```
Applied 5 fix(es):
- p-5 → p-4          - rounded-xl → rounded-[10px]
- to-black → to-[var(--color-ink)]
- text-sm → text-[13px]   - rounded-lg → rounded-md

6 need a decision from you:
- `from-slate-900` — no token matches this colour — pick one from the palette
- `text-blue-600`  — no token matches this colour — pick one from the palette
- `bg-blue-500`    — no token matches this colour — pick one from the palette
- `bg-gradient-to-br` — removing this changes the design, not just a value
- `shadow-lg`         — removing this changes the design, not just a value
```

> "Three colours with no near token, and three rules whose fix changes the
> composition rather than a value. A tool that silently swapped a grey in for
> that blue would be worse than one that stops."

### 2:30–2:50 · Why it stays true

> "The tool surface is bound to the system on screen. `check_component`'s schema
> carries an enum of that system's components — eleven for Portfolio, thirteen
> for SaaS. Switch systems and the tools re-register. The agent cannot name a
> component the system it is looking at does not have."

### The two beats to add if you have the seconds

Both were added after the first cut of this script. Neither is essential to the
core claim; each is the strongest thing in the submission on a different axis.

**Tools on a site we do not own (~25s).** Tab 3, `https://cohere.com`. Click the
**⚒ BlockSmith on this page** bookmarklet (drag it from `/protocol/webmcp`
beforehand). A badge appears: *"BlockSmith · 4 agent tools live on this page."*
Then in the console:

```js
const t = await document.modelContext.getTools();
await document.modelContext.executeTool(
  t.find(x => x.name === "blocksmith_audit_this_page"),
  JSON.stringify({ doc: "saas.md" }));
```

> "This is not our page. The tools are ours. An agent browsing anyone's site can
> now ask whether what it is looking at is on-system — and get the token to use
> instead of the colour that is there."

**The surface is generated, not claimed (~10s).** Tab 4,
`/.well-known/webmcp.json`.

> "Every tool, its schema, and where it is registered — built from the registry
> at request time. It cannot advertise a tool that does not exist, and
> `npm run verify:webmcp` fails if any number in the README disagrees with it."

### 2:50–3:00 · Close

> "Most WebMCP demos give an agent more power. This one gives it boundaries,
> authored by the people who own the design system — and the refusal explains
> itself well enough that the agent fixes it in the same turn."

---

## If something fails on camera

| Failure | Recovery |
|---|---|
| Agent ignores page tools | *"Use the tools this page provides."* Most clients need the nudge |
| Page slow on first paint | You skipped the warm-up. Cut, warm, re-record |
| No "15 agent tools" line | Browser has no WebMCP — enable the Chrome flag and relaunch. The panel still lists the surface, and says the browser has none |
| Bookmarklet does nothing | The site's CSP blocked it (github.com, x.com do). Use the extension, or pick a site you rehearsed |
| Badge says "could not register" | Another BlockSmith script already ran on that tab. Reload the page first |
| `capture_site_design` fails | Network. Skip it — it is not on the critical path |
| Governance panel empty | Click **Try a typical AI component** again; state is per-tab |

**Catastrophic fallback:** the Path 1 walkthrough in `TESTING.md` needs no agent,
no key and no flag. It still shows the refusal quoting the team's own rule,
which is the core claim. Record that once and keep it as a backup file.

---

## Reset between run-throughs

The demo is stateless except for a proposed component held per tab. To return to
a known state:

```bash
npm run demo:reset
```

That clears staged proposals and re-warms all four systems. Re-run it before
every take.
