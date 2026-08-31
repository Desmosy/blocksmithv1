# Demo script — WebMCP Challenge

A rehearsed run for the <3-minute video and for a live judge walkthrough.
Every line of output quoted here was captured from a real run on
2026-08-26; none of it is illustrative. If a number here stops matching,
`npm run verify:webmcp` fails.

**Typing during the demo: two URL edits and one sentence.** Everything else is
a click or is already on screen.

---

## Before you start (5 minutes, off camera)

```bash
npm install
npm run dev
```

Then **warm every page you will visit** — the first render of a design system
compiles and parses server-side, and a cold one takes several seconds:

```bash
for d in portfolio.md saas.md docs.md apollo.md; do
  curl -s -o /dev/null "http://localhost:3000/wiki?doc=$d"
done
```

Measured cold vs warm: **7.7s → 0.15s**. Do not skip this. A spinner in the
first ten seconds is the single most damaging thing that can happen on camera.

Open these tabs in order, so you never type a URL under pressure:

1. `http://localhost:3000/wiki?doc=portfolio.md`
2. `http://localhost:3000/wiki?doc=saas.md`

Confirm the page header shows **13 agent tools live on this page**. If it does
not, your browser has no WebMCP surface — append `?agent=sim` in development, or
enable `chrome://flags/#enable-webmcp-testing` and relaunch.

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
| No "13 agent tools" line | Browser has no WebMCP. `?agent=sim` in dev, or the Chrome flag |
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
