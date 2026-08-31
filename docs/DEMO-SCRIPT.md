# Demo script — WebMCP Challenge

**Runtime: 2:42.** 368 words of narration. Four prompts typed, one button clicked.

---

## Rules this script follows

1. **Nobody watching knows what a design system is.** It gets explained once, in
   one sentence, in plain words, and never again.
2. **No tool names in the narration.** They are *visible on screen* when the AI
   calls them — that is what proves the WebMCP work — but you never say
   "check_capability" out loud. The camera does that job.
3. **One person, one problem, one arc.** Not a tour of features.
4. **Every quoted output below is real**, captured from the deployed app on
   2026-08-30. Nothing here is illustrative.

---

## The story in one line

*I asked an AI to build something. It looked right and was wrong. So I made the
website itself tell the AI the rules — and then I changed the rules while it was
working.*

---

## Before you record (10 min, off camera)

```bash
BLOCKSMITH_DEMO_URL=https://blocksmithv1.vercel.app npm run demo:reset
```

Run it twice. The second run must show every system under 1500ms.

- **Sign in** on your Chrome. The Approve click at 2:00 needs it (401 otherwise).
- **Chrome flag:** `chrome://flags/#enable-webmcp-testing` -> Enabled -> Relaunch.
  Load the unpacked extension from `extension/`.
- **Two screens side by side.** Left = ChatGPT's in-app browser (the AI).
  Right = your Chrome (you). The 1:38 beat only works if both are visible.

**Tabs, in order:**

| # | Screen | URL |
|---|---|---|
| 1 | Right | `/wiki/governance?doc=portfolio.md` |
| 2 | Right | `/wiki/guidelines?doc=portfolio.md` |
| 3 | Left | `/wiki?doc=portfolio.md` |
| 4 | Left | `/wiki?doc=saas.md` |
| 5 | Both | `/wiki?doc=upload:capture-cohere-5f71a053.md` |
| 6 | Right | `https://cohere.com` |

---

# The run

## 0:00 - 0:16 · Something that looks right and is wrong

**Screen: tab 1.** The generated component is already on screen. Don't click yet.

> "I asked an AI to build a pricing card for my product. This is what it gave
> me. It looks fine. It would get rejected the moment a designer saw it — and if
> you're not a designer, you probably can't tell me why."

*Beat. Let them look at it and fail to spot anything.*

## 0:16 - 0:34 · The rulebook nobody gave the AI

**Switch to tab 2** — the Do's and Don'ts page. Scroll slowly through the rules.

> "Because every company has rules about how its product looks. Exact colours.
> Exact spacing. No drop shadows, ever. Real teams write this down — it lives in
> a document like this one."

**Switch back to tab 1.**

> "The AI never saw this. And here's the thing — it couldn't have. Nothing on
> the screen it was looking at says any of it."

## 0:34 - 0:56 · Hand the page the rulebook

Click **Check**.

> "So we gave the page a voice. Now, when an AI works here, the page hands it
> the rules."

```
REJECTED — 10 violation(s) in Portfolio.

- Line 1 `banned-shadow` — `shadow-lg` — Shadows are not allowed in this design
  system. Rule: "Do not add drop shadows to cards or buttons. Separation comes
  from the Rule (#e2e4ea) hairline and from space, not elevation."
```

> "Ten problems. And look at what it says — not 'wrong colour'. It reads back
> the actual sentence a designer wrote: separation comes from the hairline and
> from space, not elevation."

## 0:56 - 1:18 · The question no screen can answer

**Switch to Screen Left, tab 3.** ChatGPT's browser, on that same page.

> "Now watch me ask it something that isn't on the screen at all."

**Type:** `Does this design system have a tooltip?`

*The tool call is visible in ChatGPT. Don't read its name — just let it show.*

```
**Tooltip** — not part of this design system. Use **Meta Label** instead.
```

> "No. And use this other thing instead."

**Switch to tab 4** (a different product's rules). **Type the same question.**

```
**Tooltip** — available. A short label for an icon-only control or a truncated cell.
```

> "Same AI. Same question. Opposite answer. There was never a pixel on either
> screen that could have told it that — somebody decided it, and the page passed
> the decision along."

**This is the most important 20 seconds in the video. Slow down.**

## 1:18 - 1:38 · It fixes its own work, and knows when to stop

**Type:** `Fix whatever you can in that component automatically.`

```
Applied 5 fix(es):
- p-5 -> p-4     - rounded-lg -> rounded-md     - text-sm -> text-[13px]

5 need a decision from you:
- `bg-blue-500` — no token matches this colour — pick one from the palette
- `shadow-lg` — removing this changes the design, not just a value
```

> "It fixes five things itself. And then it stops. The other five it hands back
> — because those aren't typos, they're decisions. It won't quietly pick a
> colour for me."

## 1:38 - 2:18 · I change the rules while it's working

**Both screens on tab 5.** Make sure the right-hand screen is clearly visible.

> "Which brings me to the part I actually care about."

**Type:** `Build a launch banner using #7c3aed and show it to me on the page.`

*The component appears on the RIGHT-hand screen — point at it.*

```
Nothing in Cohere is close to this color — the nearest is **Accent** (#4c6ee6),
which is a different hue. Adding a new color is a design decision for the user,
not a substitution to make silently.
```

> "Purple isn't in this rulebook. It can't just add it — it has no power to
> change anything here."

**Type:** `Then propose adding it to the system as a new token.`

*A card appears on the RIGHT screen: "Your agent proposed 1 change."*

> "So it asks me. That's its request, sitting on my screen, waiting for a human."

**Click Approve.** Then type: `Check that banner again.`

```
PASS
```

> "Same code. I didn't touch a line of it. I changed the rules in the middle of
> the conversation — and it just knew. That's the part a copy-pasted style guide
> can never do."

## 2:18 - 2:36 · On websites we don't own

**Screen right, tab 6** — `cohere.com`, extension loaded. Point at the badge.

> "One last thing. This isn't only our site. With our browser extension, any
> website will do — one click, and a company's design becomes a rulebook you can
> hold your AI to."

## 2:36 - 2:42 · Close

> "Agents are going to build most of the interfaces we use. The question was
> never whether they can. It's whose rules they follow — and now the web itself
> can answer that."

---

## Prompts to paste

```
1. Does this design system have a tooltip?
2. Fix whatever you can in that component automatically.
3. Build a launch banner using #7c3aed and show it to me on the page.
4. Then propose adding it to the system as a new token.
```

If ChatGPT answers from the page text instead of calling a tool, say once:
**"Use the tools this page provides."**

---

## If something fails while recording

| Problem | What to do |
|---|---|
| AI answers without calling a tool | *"Use the tools this page provides."* Once is usually enough |
| Spinner on first paint | You skipped `demo:reset`. Cut and restart |
| **Approve gives an error** | You're not signed in on the right-hand screen. Only this beat needs it |
| Proposal doesn't cross to the right screen | `curl ".../api/webmcp/proposal?doc=upload:capture-cohere-5f71a053.md"` to confirm. It is stored durably, so this should hold |
| Extension badge missing | Reload the page; the flag must be on and the extension loaded unpacked |
| Capture is slow on camera | It's a live fetch of someone else's site — **pre-record 2:18-2:36** and cut it in |

**Record 2:18-2:36 separately.** It is the only beat depending on a third-party
site. Everything else is deterministic.

**Backup:** 0:00-0:56 needs no AI, no flag, no login — just clicks. Record it
once as a safety file before attempting the full run.

---

## Before you hit record

- [ ] `demo:reset` twice, all under 1500ms
- [ ] Signed in on the right-hand screen
- [ ] Chrome flag on, extension loaded
- [ ] Six tabs open in order
- [ ] Four prompts in a file you can paste from
- [ ] 1920x1080, zoom 110-125% so text survives compression
- [ ] **No `.env`, no terminal with API keys, no personal tabs or bookmarks in shot**
- [ ] `/dashboard/api-keys` not open anywhere

Between takes: `demo:reset`, reload tabs 3 and 5, and if you approved the purple
token, remove it before running 1:38 again.

---

## Where each judging criterion is proved

| Criterion | Time | What the judge sees |
|---|---|---|
| **WebMCP Leverage** | 0:56-1:18, 1:38-2:18 | Tool calls visible on screen answering questions with no DOM representation; the AI staging a change it structurally cannot apply |
| **Execution** | throughout | One live URL, a real product — rules page, checker, approval inbox, extension |
| **Potential Impact** | 0:00-0:34 | A failure anyone recognises, and the rule quoted back word for word |
| **Creativity & Ambition** | 2:18-2:36 | The same tools running on a site we have no relationship with |
| **Human-agent collaboration** | 1:38-2:18 | Asks -> human approves -> next answer changes. The AI never holds write access |
| **Rules stay current** | 2:05-2:18 | Same code, untouched, passes after approval |
