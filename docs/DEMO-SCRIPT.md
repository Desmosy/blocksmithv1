# Demo script — WebMCP Challenge

A rehearsed run for the <3-minute video.

**Every output quoted below was captured from the deployed app on 2026-08-30.**
None of it is illustrative. If a number here stops matching, `npm run
verify:webmcp` fails.

- **Narration:** 415 words · **Runtime at a normal pace:** 2:44–2:50
- **Typing on camera:** four prompts and one click of Approve. Everything else
  is already on screen.
- **Recorded against:** `https://blocksmithv1.vercel.app` (0.5s warm)

---

## The two claims this has to prove

Everything below is arranged around them. If a beat doesn't serve one, it's cut.

1. **The rules are not in the DOM.** No amount of scraping the page finds the
   palette, the spacing scale, or "this system has no tooltips — use Meta Label."
2. **The rules change, and the tools stay current.** When the design system
   changes, the agent gets the new rules — not a stale copy of the docs.

---

## Before you start (10 minutes, off camera)

**1. Warm every page.** Run it twice; the second run must show every system
under 1500ms.

```bash
BLOCKSMITH_DEMO_URL=https://blocksmithv1.vercel.app npm run demo:reset
```

**2. Sign in** on your own Chrome. Approving a design change writes through
`/api/wiki/finalize`, which returns 401 to anyone who isn't. This is the only
beat that needs a session.

**3. Chrome flag** for the extension half: `chrome://flags/#enable-webmcp-testing`
→ Enabled → Relaunch. Load the unpacked extension from `extension/`.

**4. Two screens.**
- **A — ChatGPT's desktop app**, in-app browser. This is the agent.
- **B — your Chrome**, same page. This is the human. Act 4 needs both visible.

**5. Open, in this order:**

| # | Where | URL |
|---|---|---|
| 1 | B | `/wiki/governance?doc=portfolio.md` |
| 2 | A | `/wiki?doc=portfolio.md` |
| 3 | A + B | `/wiki?doc=upload:capture-cohere-5f71a053.md` |
| 4 | B | `https://cohere.com` |
| 5 | B | `/.well-known/webmcp.json` |

**6. Copy these four prompts somewhere you can paste from.** They are in
"Prompts to paste" at the bottom.

---

## The run

### 0:00–0:20 · The failure, before any explanation

**Screen B, tab 1.** The Governance page on Portfolio. Click **Try a typical AI
component**, then **Check**.

> "This is a component an AI agent just wrote. It compiles, it renders, and it
> looks completely fine. Here is what this team's design system says about it."

Let the verdict land. Say nothing for two seconds. Then point at one line:

```
REJECTED — 10 violation(s) in Portfolio.

- Line 1 `banned-shadow` — `shadow-lg` — Shadows are not allowed in this design
  system. Rule: "Do not add drop shadows to cards or buttons. Separation comes
  from the Rule (#e2e4ea) hairline and from space, not elevation."
```

> "Ten violations. And it is not saying 'invalid colour' — it is quoting the
> rule a designer wrote."

### 0:20–0:30 · Name the problem once

> "None of that is on the page. Not the palette, not the spacing scale, not
> 'separation comes from the hairline, not elevation.' An agent scraping this
> DOM cannot find any of it. So it guesses — and it guesses plausibly, which is
> what makes it expensive."

### 0:30–1:05 · The proof: not in the DOM

**Screen A**, ChatGPT's browser, tab 2.

> "This is ChatGPT's in-app browser on that same page. BlockSmith registers
> fifteen WebMCP tools on it."

Paste **prompt 1**: `Does this design system have a tooltip?`

Expected tool: **`check_capability`** → 

```
**Tooltip** — not part of this design system. Use **Meta Label** instead.
```

> "It didn't guess. It called `check_capability`, and the system answered:
> not part of this design system, use Meta Label instead."

Now navigate **Screen A** to `?doc=saas.md` and paste **prompt 1** again.

```
**Tooltip** — available. A short label for an icon-only control or a truncated cell.
```

> "Same agent, same question, opposite answer. There is no pixel on either
> screen that could have told it that. And the tools re-registered when the page
> changed — the schema carries this system's components, not the last one's."

**This is the strongest thirty seconds in the video. Do not rush it.**

### 1:05–1:30 · It repairs, and it knows where to stop

Paste **prompt 2**: `Fix whatever you can in that component automatically.`

Expected tool: **`fix_violations`** →

```
Applied 5 fix(es):
- p-5 → p-4        - rounded-lg → rounded-md
- rounded-xl → rounded-[10px]    - text-sm → text-[13px]
- to-black → to-[var(--color-ink)]

5 need a decision from you:
- `bg-blue-500` — no token matches this colour — pick one from the palette
- `bg-gradient-to-br` — removing this changes the design, not just a value
- `shadow-lg` — removing this changes the design, not just a value
```

> "Five applied. Five refused — and look at which five. It will not swap some
> grey in for that blue, and it will not delete the gradient, because removing
> it changes the design, not a value. It repairs. It does not overrule."

### 1:30–2:10 · The loop closes: the rules change under the agent

**Both screens on tab 3** — the Cohere system. Screen B visible beside A.

> "This design system was not hand-written. BlockSmith read it off a live
> website — I'll show you that in a second. Because it is mine, I can change it."

Paste **prompt 3**:
`Build a launch banner using #7c3aed and show it to me on the page.`

Expected tools: **`propose_component`** → verdict, and the component appears on
**Screen B**.

```
Nothing in Cohere is close to this color — the nearest is **Accent** (#4c6ee6),
which is a different hue. Adding a new color is a design decision for the user,
not a substitution to make silently.
```

> "Rejected. Nothing in the system is close to it — and adding a colour is my
> decision, not its."

Paste **prompt 4**: `Then propose adding it to the system as a new token.`

Expected tool: **`propose_design_change`** → appears on **Screen B** under
*Your agent proposed 1 change*.

> "So it proposes one. It cannot apply it — it has no write access to anything.
> It lands here, on my screen, and waits."

**Click Approve on Screen B.** Then paste **prompt 2** again, or
`Check that banner again.`

Expected tool: **`check_governance`** → `PASS`.

> "Same code. I never touched it. The rules changed underneath the agent, and
> the tool handed it the new ones — no new prompt, no stale copy of the docs.
> That is the half people forget: a design system that can't change isn't a
> design system, it's a screenshot."

### 2:10–2:35 · The same tools on a site we don't own

**Screen B, tab 4** — `cohere.com`, with the extension loaded.

> "And this is not limited to our own site. Our extension registers the same
> tools on any page in the browser."

Point at the badge: **"BlockSmith · 4 agent tools live on this page."**

Run `blocksmith_capture_this_site` (or narrate over the pre-recorded capture).

> "Fourteen colours, sixteen components — a governed design system, read from a
> site we have no relationship with, in about twelve seconds. That is where the
> Cohere system on the last screen came from."

### 2:35–2:50 · Close

**Screen B, tab 5** — the manifest. Scroll once.

> "Every tool, its schema, and where it is registered is published here, and
> it's generated from the registry, so it can't advertise something that doesn't
> exist. Most WebMCP demos give an agent more power. This one gives it
> boundaries — written by the people who own the design system, and enforced by
> the page itself."

---

## Prompts to paste

```
1. Does this design system have a tooltip?
2. Fix whatever you can in that component automatically.
3. Build a launch banner using #7c3aed and show it to me on the page.
4. Then propose adding it to the system as a new token.
```

If ChatGPT answers from the page text instead of calling a tool, say once:
**"Use the tools this page provides."** Most clients need the nudge exactly once
per session.

---

## If something fails on camera

| Failure | Recovery |
|---|---|
| Agent ignores the tools | *"Use the tools this page provides."* |
| Spinner on first paint | You skipped `demo:reset`. Cut, warm, restart |
| No "15 agent tools" line | Chrome flag off, or ChatGPT's browser doesn't expose it. The panel still lists the surface and says the browser has none — you can narrate that honestly |
| **Approve returns 401** | You are not signed in on Screen B. This is the one beat that needs it |
| Proposal doesn't reach Screen B | Confirm with `curl ".../api/webmcp/proposal?doc=upload:capture-cohere-5f71a053.md"`. It is written to object storage, so it survives instances |
| Bookmarklet does nothing | That site's CSP blocked it. The extension is the CSP-proof path — use it |
| Capture is slow | It is a live browser fetch of a third-party site. **Pre-record Act 5** and cut it in |

**Record Act 5 separately.** It is the only beat that depends on a third-party
site being up and a headless browser answering. Everything else is local to
BlockSmith and deterministic.

**Catastrophic fallback:** Acts 1 and 3 need no agent, no flag and no session —
they are clicks in the Governance panel. They still carry the core claim.
Record them once as a backup file before you attempt the full run.

---

## Recording checklist

**Environment**
- [ ] `demo:reset` run twice, all systems <1500ms
- [ ] Signed in on Screen B (Approve needs it)
- [ ] `chrome://flags/#enable-webmcp-testing` enabled, browser relaunched
- [ ] Extension loaded unpacked from `extension/`
- [ ] Five tabs open in the order above
- [ ] Four prompts in a scratch file, ready to paste
- [ ] 1920×1080, browser zoom 110–125% so code is legible after compression
- [ ] Screen B beside Screen A for Act 4 — the handoff is the point

**Hygiene — check before you hit record**
- [ ] No `.env`, `.env.local`, or terminal with `NVIDIA_API_KEY` / Supabase keys visible
- [ ] Browser profile has no personal bookmarks or tabs in shot
- [ ] Dashboard shows demo projects, not anything private
- [ ] No API key visible on `/dashboard/api-keys`

**Reset between takes**
- [ ] `demo:reset`
- [ ] Reload tabs 2 and 3 (proposals are per-doc and expire in 30 minutes)
- [ ] If you approved the Signal token, remove it from the doc before re-running Act 4

---

## Where the video proves each criterion

| Criterion | Timestamp | What proves it |
|---|---|---|
| **WebMCP Leverage** | 0:30–1:05, 1:30–2:10 | Fifteen registered tools; a tool answering a question with no DOM representation; schemas re-registering on navigation; the agent staged a change it structurally cannot apply |
| **Execution** | throughout | A deployed product, not a harness: governance panel, approval inbox, capture, extension, published manifest — all on one live URL |
| **Potential Impact** | 0:00–0:30 | A real, named failure for design-system teams — plausible AI UI that violates invisible rules — and the rule quoted back verbatim |
| **Creativity & Ambition** | 2:10–2:35 | The same tools registered on a site we don't own; a design system read from a live page in twelve seconds |
| **Human–agent collaboration** | 1:30–2:10 | Agent proposes → human approves → agent's next call sees the new rule. The agent holds no write access at any point |
| **Working extension** | 2:10–2:35 | Badge on a third-party origin, main-world content script, CSP-proof |
| **Rules stay current** | 1:55–2:10 | Same code, untouched, PASSES after the human approves |
