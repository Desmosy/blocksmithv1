# Demo script — WebMCP Challenge

**Narration: 428 words across eight beats — 2:51 at a normal pace.**
Four prompts typed, one button clicked. Everything else is already on screen.

> **If your read lands over 2:55, cut beat 6.** It is marked in §4 and is the
> least load-bearing of the eight; without it the script is 388 words / 2:35.
> Do not cut anything else — every other beat is a move in the argument below.

> Every result quoted in this script is **real output from the deployed app**,
> captured on 2026-08-30 from `https://blocksmithv1.vercel.app`. Nothing here is
> illustrative or mocked up. If any of these numbers stop matching the product,
> `npm run verify:webmcp` fails.

---

## 1. Who is watching, and what that means for the words you use

The judges are browser and platform engineers. They are not design-system
practitioners, and the general audience on YouTube certainly isn't. So:

| Never say | Say instead |
|---|---|
| design system | **a rulebook** |
| design tokens | **the exact colours and spacing** |
| off-token colour | **a colour that isn't in the rulebook** |
| the tool surface / registered tools | *(don't mention it — show it)* |
| `check_capability`, `check_governance` | *(never spoken; they appear on screen)* |
| governance | **the rules**, or **saying no** |
| WebMCP | say it **once**, at 0:34, and never again |

**The single most important rule:** you never read a tool name out loud. When
the AI calls one, ChatGPT shows it on screen. That is what proves the technical
work to a judge scoring "WebMCP Leverage" — and it happens without you spending
a second of narration on vocabulary the audience doesn't have.

---

## 2. The argument, in five moves

The video is not a tour of features. It is an argument, and each beat is a move
in it. If you have to cut something, cut whatever is not one of these.

1. **The web is filling up with sites that all look the same.** Everyone
   watching has noticed this.
2. **It is not that AI has bad taste — nobody ever gave it a standard**, and the
   standard is not in the page it is looking at. So it does the average thing.
3. **If you have no standard, take one.** Any website becomes a rulebook in
   about twelve seconds.
4. **Now the page hands that rulebook to the AI**, and the AI gets told no —
   with the actual sentence a designer wrote, so it learns the rule rather than
   just deleting a line.
5. **You stay in charge.** It can propose, it cannot decide. And the moment you
   change your mind, it is working from the new rule.

---

## 3. Before you record (about 20 minutes, off camera)

### 3.1 Warm the app

```bash
BLOCKSMITH_DEMO_URL=https://blocksmithv1.vercel.app npm run demo:reset
```

Run it **twice**. The second run must report every system under 1500ms. A cold
page takes about three seconds; a spinner in the first ten seconds of a demo
video is the single most damaging thing that can happen to you.

### 3.2 Sign in

Sign in on your own Chrome (the right-hand screen). The **Approve** click at
2:20 writes a real change, and the server returns 401 to anyone who isn't signed
in. This is the only beat in the whole video that needs a session.

### 3.3 Turn on the agent surface

- `chrome://flags/#enable-webmcp-testing` -> **Enabled** -> **Relaunch**
- `chrome://extensions` -> Developer mode -> **Load unpacked** -> `extension/`
- Sanity check: open any page, DevTools console, type `document.modelContext`.
  It must print an object, not `undefined`.

### 3.4 Set up two screens

This is not optional — one beat is *only* legible with both visible.

- **LEFT = ChatGPT's desktop app**, using its in-app browser. This is "the AI."
- **RIGHT = your Chrome.** This is "you."

At 1:52 the AI, on the left, puts something on your screen, on the right. If the
viewer cannot see both at once, the entire point of that beat is lost.

### 3.5 Pre-record the capture

Beat 3 (0:40–1:05) fetches a live third-party website through a headless
browser. It normally takes about twelve seconds, but it is the one thing in this
video that depends on somebody else's server. **Record it separately, before the
main take, and cut it in.** Do not attempt it live.

### 3.6 Open these tabs, in this order

| # | Screen | URL | Used at |
|---|---|---|---|
| 1 | RIGHT | `https://cohere.com` (extension loaded) | 0:40 |
| 2 | RIGHT | `/wiki/guidelines?doc=portfolio.md` | 0:22 |
| 3 | RIGHT | `/wiki/governance?doc=portfolio.md` | 1:05, 1:52 |
| 4 | LEFT | `/wiki?doc=portfolio.md` | 1:30 |
| 5 | LEFT | `/wiki?doc=saas.md` | 1:42 |
| 6 | BOTH | `/wiki?doc=upload:capture-cohere-5f71a053.md` | 2:10 |

---

# 4. The run

---

## Beat 1 · 0:00 – 0:22 · The problem everyone has already noticed

**On screen:** a plain browser. Nothing of ours yet. Scroll slowly through two
or three recent AI-built landing pages — or honestly, your own last quick
project.

**Say:**

> "Anyone can build a website now. You describe it, an AI writes it, it's live
> the same afternoon. And you've probably noticed what that's doing to the web.
> The same gradient. The same drop shadow. The same rounded card, everywhere.
> Fast, competent, completely interchangeable."

**Pause for one beat before continuing.**

**What the viewer should now believe:** *this is a real problem, and I've seen
it myself.* You have not mentioned your project yet, and that is deliberate —
you are earning the right to.

---

## Beat 2 · 0:22 – 0:40 · Why it happens, and it is not taste

**On screen:** switch to **tab 2**, the Do's and Don'ts page. Scroll it slowly
so the viewer sees these are sentences a person wrote, not settings.

**Say:**

> "It's not that the AI has bad taste. Nobody ever gave it a standard. Serious
> teams have one — the exact colours, the exact spacing, the things you never
> do. But it lives in a document like this, or a Figma file, or someone's head."

**On screen:** cut to any ordinary webpage.

> "And the AI is looking at a web page. None of that is *in* the page. So it
> does the average thing — and the average of the entire internet is exactly
> what you've been looking at."

**What the viewer should now believe:** *the rules exist, but they're invisible
to the machine doing the work.* This is the sentence the whole demo rests on. If
they only remember one thing from the first minute, this is it.

---

## Beat 3 · 0:40 – 1:05 · If you don't have a rulebook, take one

**On screen:** **tab 1**, `cohere.com`, with the extension running. Point at the
badge in the corner: *"BlockSmith · 4 agent tools live on this page."*

**Say:**

> "So — first half of the fix. If you don't have a rulebook, borrow one. Here's
> our extension, running on somebody else's site. One click."

**On screen:** the pre-recorded capture. Result:

```
Captured Cohere — 14 colours · 2 typefaces · 16 components
```

> "Twelve seconds, and their real design decisions — measured off the live page
> — become a rulebook I can hold my own work to. Not a copy of their site: the
> colours, the spacing, the type, written down as something checkable."

**Emphasise "not a copy."** It is the honest claim and it is also the more
impressive one.

**What the viewer should now believe:** *even someone with no design background
can get a real standard in seconds.*

---

## Beat 4 · 1:05 – 1:30 · Now the page can say no

**On screen:** **tab 3**, the checking page on a different rulebook. A component
is already sitting there. Click **Check**.

**Say:**

> "Second half, and this is the part that matters. Here's a component an AI just
> wrote me. Honestly? Looks fine."

**Let the verdict land. Say nothing for two full seconds.** Then point at the
one line that matters:

```
REJECTED — 10 violation(s) in Portfolio.

- Line 1 `banned-shadow` — `shadow-lg` — Shadows are not allowed in this design
  system. Rule: "Do not add drop shadows to cards or buttons. Separation comes
  from the Rule (#e2e4ea) hairline and from space, not elevation."
```

> "Ten problems. And look what it says back — not 'wrong colour'. It reads out
> the sentence the designer wrote. So the AI doesn't just delete a line. It
> learns the rule."

**What the viewer should now believe:** *the page is enforcing a human's
intention, not running a linter.*

---

## Beat 5 · 1:30 – 1:52 · The question no screen could ever answer

This is the strongest twenty seconds in the video. **Slow down.**

**On screen:** switch to **LEFT**, **tab 4** — ChatGPT's in-app browser, sitting
on that same page.

**Say:**

> "Here's what convinced me this belongs in the page. Watch me ask something
> that's nowhere on it."

**Type prompt 1:** `Does this design system have a tooltip?`

*ChatGPT shows the tool call. Do not read its name. Just let the viewer see that
something was called.*

```
**Tooltip** — not part of this design system. Use **Meta Label** instead.
```

> "No. And use this other thing instead."

**On screen:** switch to **tab 5** — a different product's rulebook. **Type the
exact same prompt.**

```
**Tooltip** — available. A short label for an icon-only control or a truncated cell.
```

> "Same AI. Same question. Opposite answer. No pixel on either screen could have
> told it that — a person decided it, and the page handed the decision over."

**What the viewer should now believe:** *this genuinely cannot be done by
scraping or screenshotting a page.* This is the beat a judge scoring "WebMCP
Leverage" is waiting for.

---

## Beat 6 · 1:52 – 2:10 · It repairs its own work, and knows where to stop

**On screen:** stay on the left. **Type prompt 2:**
`Fix whatever you can in that component automatically.`

```
Applied 5 fix(es):
- p-5 -> p-4      - rounded-lg -> rounded-md      - text-sm -> text-[13px]

5 need a decision from you:
- `bg-blue-500` — no token matches this colour — pick one from the palette
- `shadow-lg` — removing this changes the design, not just a value
```

**Say:**

> "It fixes five itself. Then it stops. The other five it hands back — those
> aren't typos, they're decisions. It won't quietly pick a colour for me."

**What the viewer should now believe:** *this thing has judgement about the
limits of its own authority.* Most AI tools are graded on how much they do; this
one is showing restraint, on purpose.

> **If you are running long, this is the first beat to cut.** It is the least
> load-bearing of the eight. Cutting it saves 18 seconds.

---

## Beat 7 · 2:10 – 2:42 · You stay in charge — and the rules can change mid-conversation

**On screen:** **both** screens on **tab 6**. The right-hand screen must be
clearly visible in frame. This beat is about the handoff between them.

**Type prompt 3:**
`Build a launch banner using #7c3aed and show it to me on the page.`

*The component appears on the RIGHT-hand screen. Point at it — the AI is on the
left, and it just put something on your screen on the right.*

```
Nothing in Cohere is close to this color — the nearest is **Accent** (#4c6ee6),
which is a different hue. Adding a new color is a design decision for the user,
not a substitution to make silently.
```

**Say:**

> "Purple isn't in this rulebook. And it can't just add it — it has no power to
> change anything. So it asks."

**Type prompt 4:** `Then propose adding it to the system as a new token.`

*A card appears on the RIGHT screen: **"Your agent proposed 1 change."***

> "That's its request, on my screen, waiting for a person."

**Click Approve** on the right-hand screen. Then, on the left,
**type:** `Check that banner again.`

```
PASS
```

> "Same code. I never touched it. I changed the rules halfway through the
> conversation and it just knew. A style guide pasted into a prompt can never
> do that."

**What the viewer should now believe:** *the human is the decision-maker, and
the AI is always working from the current rules — not a copy that went stale the
moment it was pasted.*

---

## Beat 8 · 2:42 – 2:52 · Close

**On screen:** back to the rulebook page, or a slow scroll of the captured
system. Something calm.

**Say:**

> "Agents are going to build most of the web from here. They don't have to make
> all of it look the same. They just need somebody's rules — and a page that can
> hand them over."

---

# 5. The four prompts, ready to paste

```
1. Does this design system have a tooltip?
2. Fix whatever you can in that component automatically.
3. Build a launch banner using #7c3aed and show it to me on the page.
4. Then propose adding it to the system as a new token.
```

Plus one follow-up you type at the end of beat 7: `Check that banner again.`

**If ChatGPT answers from the page's text instead of calling a tool**, say once:
*"Use the tools this page provides."* Most clients need that nudge exactly once
per session, and after that they reach for tools on their own.

---

# 6. If something goes wrong while recording

| Problem | What to do |
|---|---|
| **Capture is slow, or the site is down** | Expected — it fetches somebody else's live website. **Pre-record beat 3** and cut it in. Never attempt it live |
| The AI answers without calling a tool | *"Use the tools this page provides."* Once is enough |
| Spinner on the first page | You skipped `demo:reset`. Cut, warm it, start again |
| **Approve returns an error** | You are not signed in on the right-hand screen. This is the only beat that needs it |
| The proposal never reaches the right screen | Check with `curl ".../api/webmcp/proposal?doc=upload:capture-cohere-5f71a053.md"`. It is stored durably now, so this should hold |
| No badge on cohere.com | Reload the page. The Chrome flag must be on and the extension loaded unpacked |
| Running long | Cut beat 6 (18s). Then trim the pause in beat 1 |

**Record a safety file first.** Beats 4 and 6 need no AI, no browser flag and no
login — they are clicks on a page. Record those two once, on their own, before
you attempt the full run. If the live take falls apart, you still have the core
claim on tape.

---

# 7. Final checklist before you hit record

**The app**
- [ ] `demo:reset` run twice, every system under 1500ms
- [ ] Beat 3 (the capture) already recorded and edited
- [ ] Signed in on the right-hand screen

**The browser**
- [ ] `chrome://flags/#enable-webmcp-testing` enabled and relaunched
- [ ] Extension loaded unpacked from `extension/`
- [ ] `document.modelContext` prints an object in the console
- [ ] Six tabs open in the order in §3.6

**The recording**
- [ ] 1920x1080, browser zoom 110–125% so text survives YouTube compression
- [ ] Both screens in frame for beat 7
- [ ] Prompts in a scratch file you can paste from without fumbling

**Do not leak anything**
- [ ] No `.env` or `.env.local` open anywhere
- [ ] No terminal showing `NVIDIA_API_KEY`, Supabase keys, or a `bs_live_` key
- [ ] `/dashboard/api-keys` not open in any tab
- [ ] No personal bookmarks, tabs, or notifications in shot

**Between takes**
- [ ] `demo:reset`
- [ ] Reload tabs 4 and 6 — proposals are per-document and expire after 30 min
- [ ] If you approved the purple token, remove it before running beat 7 again

---

# 8. Where each judging criterion is proved

| Criterion | Timestamp | What the judge actually sees |
|---|---|---|
| **Potential Impact** | 0:00–0:40 | A problem anyone who uses the web has noticed, plus a specific diagnosis of *why* it happens |
| **Creativity & Ambition** | 0:40–1:05 | Our tools running on a site we have no relationship with; a rulebook produced from a live page in twelve seconds |
| **Execution** | 1:05–1:30, throughout | One live URL, a finished product — rulebook pages, a checker, an approval inbox, a working extension |
| **WebMCP Leverage** | 1:30–1:52 | A tool answering a question that has no representation in the DOM; opposite answers on two pages; tool calls visible on screen throughout |
| **WebMCP Leverage (2)** | 2:10–2:42 | The AI staging a change it structurally cannot apply, and picking up the new rule on its next call |
| **Human–agent collaboration** | 2:10–2:42 | It proposes -> a person approves -> the next answer changes. The AI never holds write access at any point |
| **Complete product experience** | 1:52–2:10 | It repairs what it can and refuses what it shouldn't decide — restraint, not just capability |
