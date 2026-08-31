# Demo script — WebMCP Challenge

**Runtime: 2:44.** 390 words of narration. Four prompts typed, one button clicked.

---

## The argument

Not "here is our tool." An argument, in five moves:

1. The web is filling up with sites that all look the same.
2. It is not that AI has bad taste — **nobody ever gave it a standard**, and the
   page it is looking at does not contain one.
3. So: if you have no standard, take one. Any site becomes a rulebook in seconds.
4. Now the page hands that rulebook to the AI, and the AI gets told no — with
   the reason a designer actually wrote.
5. And you stay in charge: it asks, you decide, and it follows the new rule
   immediately.

## Rules this script follows

- **Nobody watching knows what a design system is.** The words "design system"
  are never spoken. It is called a **rulebook**, explained once, in one sentence.
- **No tool names in the narration.** They appear on screen when the AI calls
  them — that is what proves the WebMCP work. The camera does that job, not you.
- **Every quoted output is real**, captured from the deployed app on 2026-08-30.

---

## Before you record (10 min, off camera)

```bash
BLOCKSMITH_DEMO_URL=https://blocksmithv1.vercel.app npm run demo:reset
```

Run it twice. The second run must show every system under 1500ms.

- **Sign in** on your Chrome. The Approve click at 2:10 needs it (401 otherwise).
- **Chrome flag:** `chrome://flags/#enable-webmcp-testing` -> Enabled -> Relaunch.
  Load the unpacked extension from `extension/`.
- **Two screens side by side.** Left = ChatGPT's in-app browser (the AI).
  Right = your Chrome (you). The 1:52 beat only works if both are visible.
- **Pre-record the capture at 0:40.** See "If something fails" — it is the one
  beat that depends on someone else's website being up.

**Tabs, in order:**

| # | Screen | URL |
|---|---|---|
| 1 | Right | `https://cohere.com` (extension loaded) |
| 2 | Right | `/wiki/governance?doc=portfolio.md` |
| 3 | Right | `/wiki/guidelines?doc=portfolio.md` |
| 4 | Left | `/wiki?doc=portfolio.md` |
| 5 | Left | `/wiki?doc=saas.md` |
| 6 | Both | `/wiki?doc=upload:capture-cohere-5f71a053.md` |

---

# The run

## 0:00 - 0:20 · The problem you have already noticed

**Screen: a browser window. Nothing of ours yet.** Scroll through two or three
recent AI-built landing pages — or your own last quick project.

> "Anyone can build a website now. You describe it, an AI writes it, it's live
> the same afternoon. And you've probably noticed what that's doing to the web.
> The same gradient. The same drop shadow. The same rounded card, everywhere.
> Fast, competent, and completely interchangeable."

*Beat.*

## 0:20 - 0:40 · Why it happens — and it is not taste

> "It's not that the AI has bad taste. It's that nobody ever gave it a standard.
> Real design teams have one — exact colours, exact spacing, things you never
> do. But it lives in a document, or a Figma file, or somebody's head."

**Cut to a plain webpage.**

> "The AI is looking at a web page. None of that is *in* the page. So it does
> the average thing — and the average of the whole internet is what you've been
> looking at."

## 0:40 - 1:04 · If you have no standard, take one

**Screen right, tab 1** — `cohere.com`, extension loaded. Point at the badge:
*"BlockSmith · 4 agent tools live on this page."*

> "So, first half. If you don't have a rulebook, borrow one. This is our
> extension, running on a site whose design I rate. One click —"

**Run the capture.** *(Pre-recorded; see below.)*

```
Captured Cohere — 14 colours · 2 typefaces · 16 components
```

> "— and its actual decisions, measured straight off the page, become rules I
> can hold my own work to. Not a copy of their site. The palette, the spacing
> rhythm, the type scale, written down as a standard."

## 1:04 - 1:28 · Now the page can say no

**Screen right, tab 2.** The generated component is on screen. Click **Check**.

> "Second half, and this is the part that matters. Here's a component an AI just
> wrote me. Looks fine to me."

```
REJECTED — 10 violation(s) in Portfolio.

- Line 1 `banned-shadow` — `shadow-lg` — Shadows are not allowed in this design
  system. Rule: "Do not add drop shadows to cards or buttons. Separation comes
  from the Rule (#e2e4ea) hairline and from space, not elevation."
```

> "Ten problems. And look at what it says back — not 'wrong colour'. It's
> reading out the sentence a designer actually wrote."

## 1:28 - 1:52 · The question no screen can answer

**Screen left, tab 4.** ChatGPT's in-app browser, on that same page.

> "Here's what convinced me this had to be built into the page itself. Watch me
> ask something that is nowhere on the screen."

**Type:** `Does this design system have a tooltip?`

*The tool call is visible in ChatGPT. Do not read its name aloud.*

```
**Tooltip** — not part of this design system. Use **Meta Label** instead.
```

> "No — and use this instead."

**Switch to tab 5** (a different product's rulebook). **Same question.**

```
**Tooltip** — available. A short label for an icon-only control or a truncated cell.
```

> "Same AI, same question, opposite answer. No pixel on either screen could have
> told it that. Somebody decided it, and the page passed the decision along."

**Slow down here. This is the most important 20 seconds in the video.**

## 1:52 - 2:28 · You stay in charge, and the rules can move

**Both screens on tab 6.** The right-hand screen must be clearly visible.

**Type:** `Build a launch banner using #7c3aed and show it to me on the page.`

*The component appears on the RIGHT-hand screen. Point at it.*

```
Nothing in Cohere is close to this color — the nearest is **Accent** (#4c6ee6),
which is a different hue. Adding a new color is a design decision for the user,
not a substitution to make silently.
```

> "Purple isn't in this rulebook. And it can't just add it — it has no power to
> change anything here. So it asks."

**Type:** `Then propose adding it to the system as a new token.`

*A card appears on the RIGHT screen: "Your agent proposed 1 change."*

> "That's its request, sitting on my screen, waiting for a person."

**Click Approve.** Then type: `Check that banner again.`

```
PASS
```

> "Same code. I didn't touch a line of it. I changed the rules in the middle of
> the conversation, and it just knew. A style guide you paste into a prompt can
> never do that."

## 2:28 - 2:44 · Close

> "Agents are going to build most of the web from here. They don't have to make
> all of it look the same. They just need somebody's rules — and a page that can
> hand them over."

---

## Prompts to paste

```
1. Does this design system have a tooltip?
2. Build a launch banner using #7c3aed and show it to me on the page.
3. Then propose adding it to the system as a new token.
4. Check that banner again.
```

If ChatGPT answers from the page text instead of calling a tool, say once:
**"Use the tools this page provides."**

---

## If something fails while recording

| Problem | What to do |
|---|---|
| **Capture is slow or the site is down** | Expected — it is a live fetch of someone else's website. **Pre-record 0:40-1:04** and cut it in. Do not attempt it live |
| AI answers without calling a tool | *"Use the tools this page provides."* Once is usually enough |
| Spinner on first paint | You skipped `demo:reset`. Cut and restart |
| **Approve gives an error** | You are not signed in on the right-hand screen. Only this beat needs it |
| Proposal doesn't cross to the right screen | `curl ".../api/webmcp/proposal?doc=upload:capture-cohere-5f71a053.md"` to confirm. It is stored durably, so this should hold |
| Extension badge missing | Reload the page; the flag must be on and the extension loaded unpacked |

**Backup:** 1:04-1:28 needs no AI, no flag and no login — it is one click. Record
it once as a safety file before attempting the full run.

---

## Before you hit record

- [ ] `demo:reset` twice, all under 1500ms
- [ ] Capture segment (0:40-1:04) already recorded
- [ ] Signed in on the right-hand screen
- [ ] Chrome flag on, extension loaded
- [ ] Six tabs open in order
- [ ] Prompts in a file you can paste from
- [ ] 1920x1080, zoom 110-125% so text survives compression
- [ ] **No `.env`, no terminal with API keys, no personal tabs or bookmarks in shot**
- [ ] `/dashboard/api-keys` not open anywhere

Between takes: `demo:reset`, reload tabs 4 and 6, and if you approved the purple
token, remove it before running 1:52 again.

---

## Where each judging criterion is proved

| Criterion | Time | What the judge sees |
|---|---|---|
| **Potential Impact** | 0:00-0:40 | A problem anybody who uses the web has noticed, and a specific diagnosis of why it happens |
| **Creativity & Ambition** | 0:40-1:04 | Tools running on a site we have no relationship with; a rulebook produced from a live page in seconds |
| **WebMCP Leverage** | 1:28-2:28 | Tool calls answering a question with no DOM representation; the AI staging a change it structurally cannot apply |
| **Execution** | throughout | One live URL, a real product — rulebook pages, checker, approval inbox, extension |
| **Human-agent collaboration** | 1:52-2:28 | It asks -> a person approves -> the next answer changes. The AI never holds write access |
| **Rules stay current** | 2:15-2:28 | Same code, untouched, passes after approval |
