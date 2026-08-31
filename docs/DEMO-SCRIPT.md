# Demo script — WebMCP Challenge

## How to use this document

This is **one scene** — a person builds a pricing section for their startup,
has no designer, and finishes it with an AI that knows their rules. The camera
never leaves that task. Every capability appears *because the person needs it*,
never because it exists.

**Eleven beats, ordered so the sharpest proofs land earliest.** If a judge stops
watching at three minutes they will already have seen the whole argument; beats
9–11 deepen it.

- **Runtime:** 617 words of narration — **4:07 spoken**, ~4:20 with the pauses
  and clicks the script calls for. **The submission rule is under 3:00 and judges
  are not required to watch past it.** §12 has an exact cut list that lands at
  2:50 without losing a single load-bearing claim. Decide which you are shooting
  *before* you record, not in the edit.
- **Every output quoted here is real**, captured from
  `https://blocksmithv1.vercel.app` on 2026-08-30. Nothing is mocked. If a number
  drifts, `npm run verify:webmcp` fails.

---

## The scene, in one paragraph

*I'm building a pricing section for my startup tonight. I have no designer. I
ask an AI and get the same generic card that's on ten thousand other websites —
because nobody ever told it what my product looks like. So I point BlockSmith at
a site I admire and say "fetch me that," and twelve seconds later I have a
rulebook. Now the AI asks the page what it's allowed to use before it writes a
line. It gets told no, in the designer's own words. It knows things about my
system that no page could ever show it. It asks permission for a colour I
wanted, I say yes, and it carries on from the rule I just made — and then the
same rulebook follows me into my editor and my commits.*

---

## Language rules — read before you narrate

Nobody watching knows what a design system is. Never say these words:

| Never say | Say |
|---|---|
| design system | **a rulebook** / **my rules** |
| design tokens | **the exact colours and spacing** |
| governance, validation, linting | **the page says no** |
| component library | **the pieces I'm allowed to build with** |
| `check_governance`, `get_governance_rules`, any tool name | *never spoken — they appear on screen when called* |
| WebMCP | say it **twice**: beat 10 and the close |

**You never read a tool name out loud.** ChatGPT displays every call on screen
by itself. That is what proves the engineering to a judge scoring *WebMCP
Leverage*, and it costs you zero seconds of narration.

---

## Setup (25 minutes, off camera)

### Warm the app

```bash
BLOCKSMITH_DEMO_URL=https://blocksmithv1.vercel.app npm run demo:reset
```

Twice. The second run must report everything under 1500ms.

### Sign in

Sign in on your Chrome — the right-hand screen. **Approve** in beat 8 writes a
real change and returns 401 to anyone who isn't signed in. It is the only beat
that needs a session.

### Turn the agent surface on

- `chrome://flags/#enable-webmcp-testing` → **Enabled** → **Relaunch**
- `chrome://extensions` → Developer mode → **Load unpacked** → `extension/`
- Check: any page, console, `document.modelContext` must print an object.

### Two screens

- **LEFT — ChatGPT desktop app**, using its in-app browser. This is *the AI*.
- **RIGHT — your Chrome.** This is *you*.

From beat 4 on, both sit on the same page and the AI puts things on your screen.
If the viewer can't see both at once, those beats are dead.

### Tabs

| Tab | Screen | URL | Used in |
|---|---|---|---|
| 1 | RIGHT | `https://cohere.com` — extension loaded | 3 |
| 2 | **RIGHT** | **`/wiki/governance?doc=upload:capture-cohere-5f71a053.md`** | 4–8 |
| 3 | **LEFT** | `/wiki?doc=upload:capture-cohere-5f71a053.md` | 4–8 |
| 4 | RIGHT | `/wiki/guidelines?doc=portfolio.md` | 6 |
| 5 | RIGHT | `/api/webmcp/skill?doc=upload%3Acapture-cohere-5f71a053.md` | 9 |
| 6 | RIGHT | `/.well-known/webmcp.json` | 10 |

### Where things appear — read this, it is the thing people get wrong

The AI is on the **left**, in ChatGPT's browser. Your screen is on the **right**.
When the AI builds something, **two** things happen, and the demo depends on the
viewer seeing both:

| What | Where it shows | Why |
|---|---|---|
| The **component**, rendered live in your system's own colours | **RIGHT** — the Governance page | `propose_component` publishes it; your page polls and renders it |
| The **verdict** ("REJECTED — 10 violations…") | **BOTH** | The tool *returns* the verdict to the AI as its result — that is how it can fix itself in the same turn — and your page renders the same verdict beside the component |

**The right-hand screen must be on `/wiki/governance?…`, not `/wiki?…`.** The
panel that catches an agent's work only exists on that page. Before you start,
it reads *"Nothing to check yet. Ask your agent to build something, and it will
appear here rendered."* — which is a gift: leave it on screen in beat 3 so the
viewer sees the empty box *before* something lands in it.

### Pre-record beat 3

The capture fetches a live third-party website through a headless browser —
twelve seconds normally, but it depends on someone else's server. **Record it
separately and cut it in.** Never live.

---

# The run

---

## Beat 1 · 0:00 – 0:24 · The situation, and what everybody actually gets

**On screen:** a plain chat window or editor. Nothing of ours.

> "I'm building a pricing section for my startup tonight. I don't have a
> designer. So I do what everyone does now — I ask an AI."

**On screen:** the generated card. Hold two seconds.

> "And this is what everybody gets. It's fine. It's also the same card that's on
> ten thousand other sites. Because the AI has no idea what *my* product looks
> like. Nobody told it."

**What the viewer should feel:** *I have been here.* You have not mentioned your
product yet. Don't.

---

## Beat 2 · 0:24 – 0:44 · Why it happens — and it isn't taste

**On screen:** any ordinary website.

> "It's not that the AI has bad taste. Nobody gave it a standard. Real companies
> have one — exact colours, exact spacing, things you never do. But it lives in
> a Figma file, or somebody's head. And the AI is looking at a web page. None of
> that is *in* a web page — so it gives you the average of the internet."

**The sentence the whole video rests on.** If they remember one thing from the
first minute, it is this.

---

## Beat 3 · 0:44 – 1:12 · The turn — I take a rulebook

**This is where BlockSmith arrives.** Say the name here and nowhere earlier.

**On screen:** tab 1, `cohere.com`, extension running. The badge is visible:
*"BlockSmith · 4 agent tools live on this page."* Point at it.

> "So what if you didn't need to know any of this? That's BlockSmith. Two ways
> in. Bring the rules your team already has — or point at a site you admire and
> say: fetch me that one."

**On screen:** on "fetch me that one", the capture runs (pre-recorded).

```
Captured Cohere — 14 colours · 2 typefaces · 16 components
```

> "Twelve seconds. Their colours, their spacing, their type, read off the live
> page. I'm not copying their website — I'm borrowing their discipline. And now
> it's mine."

**Emphasise "I'm not copying their website."** Anyone can screenshot a site;
almost nobody can extract the decisions underneath it.

**Worth noticing on screen, without narrating it:** those four tools are
registered on a page *we do not own*. That is the ambition beat, and it costs
you no words.

---

## Beat 4 · 1:12 – 1:44 · The same request, standing on my rulebook

**On screen:** LEFT = ChatGPT on tab 3. RIGHT = the Governance page, tab 2,
showing its empty state: *"Nothing to check yet. Ask your agent to build
something, and it will appear here rendered."* Let the viewer read that box.

> "Now the same request — except this time the AI is standing on my rulebook."

**Type into ChatGPT:**
`Build me a pricing card for the Pro plan at $29 a month and show it to me on the page.`

*Two calls appear in ChatGPT: it reads the rules, then builds. Don't name them.*

*Now the empty box on the **RIGHT** fills in — the component renders there, in
your system's own colours. **Point at it, and say the next line while looking at
the right-hand screen.***

> "It didn't guess. Before it wrote a line, it asked the page what it was
> allowed to use. And there it is — not in the chat, on *my* page, in my
> colours. I never pasted a style guide into that conversation."

**This is the core WebMCP moment**: the calls are visible, in order, reading
before writing — and the result lands on a different screen from the one the AI
is talking on.

---

## Beat 5 · 1:44 – 2:02 · Told no, in the designer's own words

**On screen:** the **Verdict** panel, directly beneath the component you just
pointed at on the RIGHT screen. Then glance at the LEFT — the same verdict came
back to the AI as the result of its own call.

> "And it doesn't just show me the thing — it checks it. This verdict is on my
> screen, and the same words went straight back to the AI. Look at what it says."

```
REJECTED — 10 violation(s).

- Line 1 `banned-shadow` — `shadow-lg` — Shadows are not allowed in this design
  system. Rule: "Do not add drop shadows to cards or buttons. Separation comes
  from the Rule (#e2e4ea) hairline and from space, not elevation."
```

> "Not 'wrong colour'. It reads back the sentence a designer actually wrote. So
> the AI doesn't just delete a line — it learns the rule. And because that came
> back as the answer to its own question, it can fix it without me saying a word."

---

## Beat 6 · 2:02 – 2:34 · The two things no scraper could ever find

**This is the sharpest proof in the video. Slow right down.**

**On screen:** the Don't list on the right. Highlight this line:

```
Do not use #ff7759 Red for UI chrome or interactive elements — it is decorative only
```

> "Here's what I couldn't have got any other way. That red is right there on
> their website — you can see it. Anything that scrapes a page grabs it and
> sticks it on a button. But somebody decided that red is decorative. It never
> touches a control."

**On screen:** switch to tab 3 and scroll to the "Ruled out" list.

```
Ruled out — do not build these:
- Tooltip → use Meta Label
- Carousel
- Modal
- Accordion → use Section Heading
- Hero Banner → use Bio Block
```

> "And this. This is a list of things that *aren't* on the page. No tooltips, no
> carousels, no modals — a team decided that, and it's the single most useful
> thing you can tell an AI. You cannot scrape an absence. There is no screenshot
> of a decision. It only exists because the page can say it out loud."

**What the viewer should now understand:** *this genuinely cannot be done by
looking at a page.* This is the twenty seconds a judge scoring the technology is
waiting for — and it is said entirely in plain English.

---

## Beat 7 · 2:34 – 2:52 · It repairs what it can, and stops where it should

**On screen:** back to tab 2. **Type:** `fix what you can`

```
Applied 5 fix(es):
- p-5 -> p-4      - rounded-lg -> rounded-md      - text-sm -> text-[13px]

5 need a decision from you:
- `bg-blue-500` — no token matches this colour — pick one from the palette
- `shadow-lg` — removing this changes the design, not just a value
```

> "It fixes five itself, then stops. The other five it hands back — those aren't
> typos, they're decisions, and it won't quietly make them for me."

**Why this matters:** most AI tools are judged on how much they do. This one is
showing restraint, deliberately.

---

## Beat 8 · 2:52 – 3:26 · I change my mind, and it asks permission

**On screen:** both screens on tab 2, both clearly in frame.

> "One more thing. I want a launch banner, and I want it purple."

**Type:** `Build a launch banner using #7c3aed and show it to me on the page.`

```
Nothing in Cohere is close to this color — the nearest is Accent (#4c6ee6),
which is a different hue. Adding a new color is a design decision for the user,
not a substitution to make silently.
```

> "Purple isn't in my rulebook. And it can't just add it — it has no power to
> change anything. So it asks."

**Type:** `Then propose adding it to the system as a new token.`

*A card appears on the **RIGHT** screen: **"Your agent proposed 1 change."***

> "That's its request, on my screen, waiting for a person."

**Click Approve** on the right. Then on the left, **type:** `Check that banner again.`

```
PASS
```

> "Same code — I never touched it. I changed my own rules halfway through the
> conversation, and it just knew."

**What the viewer should now understand:** *the person is still in charge, and
the AI is never working from a stale copy.* This is the human-and-agent
collaboration the challenge is actually asking about.

---

## Beat 9 · 3:26 – 3:44 · The rulebook follows me out of the browser

**On screen:** tab 4 — the skill file, scrolling.

> "And these rules don't only live in this browser. The same rulebook loads into
> my editor, and the same check runs before every commit — one place that
> governs, instead of a style guide copy-pasted into forty repos, going stale in
> all of them."

**What is real behind that line** (do not say it aloud):

- `export_skill` writes the whole system as a skill file an editor's agent loads
- `/api/mcp` serves the same engine over MCP to Cursor and Claude Code
- `blocksmith setup hooks` installs a pre-commit check that **exits non-zero**

**Why it earns its seconds:** everything before this can be read as a clever
browser trick. This is the line that says *a team could run on it.*

---

## Beat 10 · 3:44 – 4:00 · The whole surface, published

**On screen:** tab 5 — `/.well-known/webmcp.json`. Scroll once.

> "Every tool, every schema, and where each one is registered — published, and
> generated from the code, so it can't advertise something that doesn't exist.
> Fifteen tools on a design system's own page. Four on anybody else's. Sixteen
> more for agents outside a browser. That's what WebMCP made possible."

**Worth having on screen:** the `counts` block reading
`{server: 12, page: 3, anywhere: 4, remoteMcp: 16}`.

---

## Beat 11 · 4:00 – 4:14 · Close

**On screen:** the finished pricing section and purple banner together.

> "A pricing section and a launch banner, built by an AI in one sitting — and
> every colour in them is mine. Agents are going to build most of the web from
> here. It doesn't all have to look the same. They just need somebody's rules,
> and a page that hands them over."

---

# 12. The 3:00 cut

Judges are not required to watch past three minutes. If you shoot the short
version, drop these four and nothing load-bearing is lost:

| Cut | Saves | What you give up |
|---|---|---|
| Beat 7 (repairs / refuses) | 18s | Restraint. The nicest *character* moment, but not a claim |
| Beat 9 (out of the browser) | 18s | The "real teams could adopt this" argument |
| Beat 10 (the manifest) | 16s | Explicit tool counts — still visible on screen in beat 3 |
| Half of beat 6 (keep the ruled-out list, drop the red) | 14s | One of two proofs; the ruled-out list is the stronger |

That lands at **2:50**. Beats 1–6 and 8 alone carry every judging criterion.

**If you shoot the long version**, put beats 9 and 10 *after* the close in the
edit as an epilogue, so the argument completes before the three-minute mark
whether or not anyone keeps watching.

---

# 13. Dry run — do this once, silently, before you record

Confirm each prompt reaches the tool it should. If the model answers from the
page's text instead of calling something, the beat is dead and you will not
notice until the edit.

| What you type | Tool that must fire | How you know |
|---|---|---|
| `Build me a pricing card for the Pro plan at $29 a month and show it to me on the page.` | `get_governance_rules`, **then** `propose_component` | **Two** calls, in that order — it reads before it writes. Card appears on the RIGHT screen |
| `fix what you can` | `fix_violations` | Some applied, the rest handed back with reasons |
| `Build a launch banner using #7c3aed and show it to me on the page.` | `propose_component` | Verdict says nothing is close to that colour |
| `Then propose adding it to the system as a new token.` | `propose_design_change` | "Your agent proposed 1 change" on the RIGHT screen |
| `Check that banner again.` | `check_governance` | `PASS` |

If a call doesn't fire, say **"Use the tools this page provides"** once. Once a
session has done it, it keeps doing it.

**Also confirm:**

- [ ] The RIGHT screen is on `/wiki/governance?doc=…` — on the plain `/wiki?doc=…`
      page nothing will ever appear, and this is the single easiest way to ruin a take
- [ ] Skill file is live: `curl -sI ".../api/webmcp/skill?doc=upload%3Acapture-cohere-5f71a053.md"` → **200**, not 404
- [ ] Badge appears on `cohere.com` with the extension loaded
- [ ] Approve works while signed in — do it once, then undo it
- [ ] `/.well-known/webmcp.json` loads and shows the counts block

---

# 14. Everything you type, in order

```
1. Build me a pricing card for the Pro plan at $29 a month and show it to me on the page.
2. fix what you can
3. Build a launch banner using #7c3aed and show it to me on the page.
4. Then propose adding it to the system as a new token.
5. Check that banner again.
```

---

# 15. If something goes wrong

| Problem | What to do |
|---|---|
| **Capture is slow / their site is down** | Expected. **Pre-record beat 3.** Never live |
| The AI answers without calling a tool | *"Use the tools this page provides."* |
| Beat 4 passes cleanly with no violations | Fine — skip beat 5's verdict and beat 7, go to beat 6 |
| Beat 4 comes back rejected | **Better.** That is the scripted path |
| **Approve returns an error** | You are not signed in on the right-hand screen |
| Proposal never reaches the right screen | `curl ".../api/webmcp/proposal?doc=upload:capture-cohere-5f71a053.md"`. It is stored durably, so this should hold |
| No badge on `cohere.com` | Reload. Flag must be on, extension loaded unpacked |
| Skill file 404s | It hydrates on first request — call it once before recording |

**Record a safety file first.** Beat 8 is the entire argument in thirty seconds
and needs only your own two screens. Record it alone before the full run.

---

# 16. Before you hit record

**App**
- [ ] `demo:reset` twice, everything under 1500ms
- [ ] Beat 3 recorded and edited
- [ ] Signed in on the right-hand screen

**Browser**
- [ ] Chrome flag enabled, browser relaunched
- [ ] Extension loaded unpacked
- [ ] `document.modelContext` prints an object
- [ ] Five tabs open as in Setup

**Recording**
- [ ] 1920×1080, zoom 110–125% so text survives compression
- [ ] Both screens in frame from beat 4 on
- [ ] Prompts in a file you can paste from

**Do not leak**
- [ ] No `.env` or `.env.local` open
- [ ] No terminal showing `NVIDIA_API_KEY`, Supabase keys, or a `bs_live_` key
- [ ] `/dashboard/api-keys` closed
- [ ] No personal tabs, bookmarks or notifications in shot

**Between takes**
- [ ] `demo:reset`
- [ ] Reload tab 2 on both screens
- [ ] If you approved the purple token, remove it before running beat 8 again

---

# 17. Where every judging criterion is proved

| Criterion | Beat | Time | What the judge sees |
|---|---|---|---|
| **Potential Impact** | 1–2 | 0:00–0:44 | A problem anyone who has shipped a site recognises, and a precise diagnosis of why it happens |
| **Creativity & Ambition** | 3 | 0:44–1:12 | Our tools registered on a site we have no relationship with; a rulebook pulled off a live page in twelve seconds |
| **WebMCP Leverage** | 4 | 1:12–1:44 | The AI querying the page for its constraints *before* generating — both calls visible, in order |
| **WebMCP Leverage** | 6 | 2:02–2:34 | Two facts with no DOM representation at all: a judgement about a visible colour, and a list of components that do not exist |
| **Execution** | 5, 7 | 1:44–2:52 | A verdict quoting an authored rule; automatic repair that stops where judgement starts |
| **Human–agent collaboration** | 8 | 2:52–3:26 | It proposes, a person approves, its next answer changes. The AI never holds write access |
| **Complete product** | 9 | 3:26–3:44 | The same rules in an editor and in a pre-commit hook — not a browser toy |
| **Non-trivial implementation** | 10 | 3:44–4:00 | A published manifest generated from the registry: 15 in-page, 4 any-site, 16 remote |
