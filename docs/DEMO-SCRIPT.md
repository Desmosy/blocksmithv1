# Demo script — WebMCP Challenge

## Read this first

This is **one scene**, not a tour. A person sits down to build a pricing section
for their startup, has no designer, and finishes it with an AI that knows their
rules. The camera never leaves that task.

Earlier drafts of this script jumped between three different rulebooks and six
tabs to show off more features. That is why they were confusing. **One person,
one job, one rulebook, two tabs.** Everything the product can do is shown *by
that person needing it*, never because it exists.

- **Narration: 446 words.** 2:58 if you read it slowly, **2:42 at the pace
  people actually narrate a demo**. The limit is 3:00 and judges are not
  required to watch past it, so **read it aloud with a stopwatch before you
  record** — do not assume.
- **If you land over 2:50**, cut beat 5 (it is marked). It is the only beat that
  argues rather than acts. Without it: 383 words, comfortably 2:33.
- **Every result quoted here is real output from `blocksmithv1.vercel.app`**,
  captured 2026-08-30. Nothing is mocked.

---

## The scene, in one paragraph

*I'm building a pricing section for my startup tonight. I have no designer. I
ask an AI and get the same generic card that's on ten thousand other websites —
because nobody ever told it what my product looks like. So I point BlockSmith at
a website I admire and say "fetch me that", and twelve seconds later I have a
rulebook. Now the AI asks the page what it's allowed to use before it writes a
line. It builds in my colours. It refuses a purple I asked for, because purple
isn't mine — and instead of overruling me or ignoring me, it asks. I say yes.
It carries on, working from the rule I just made.*

That is the whole video. Everything below serves it.

---

## Language rules

Nobody watching knows what a design system is. Never say these words:

| Never say | Say |
|---|---|
| design system | **a rulebook**, or **my rules** |
| design tokens | **the exact colours and spacing** |
| governance / validation | **the page says no** |
| `check_governance`, `get_governance_rules` | *never spoken — they appear on screen when called* |
| WebMCP | say it **once**, in beat 7, and nowhere else |

**You never read a tool name aloud.** ChatGPT displays each call on screen by
itself. That is what proves the engineering to a judge, and it costs you zero
seconds of narration.

---

## Setup (20 minutes, off camera)

### Warm the app

```bash
BLOCKSMITH_DEMO_URL=https://blocksmithv1.vercel.app npm run demo:reset
```

Twice. The second run must report everything under 1500ms.

### Sign in

Sign in on your Chrome — the right-hand screen. The **Approve** click in beat 6
writes a real change and returns 401 to anyone who isn't signed in. It is the
only beat that needs a session.

### Turn the agent surface on

- `chrome://flags/#enable-webmcp-testing` → **Enabled** → **Relaunch**
- `chrome://extensions` → Developer mode → **Load unpacked** → `extension/`
- Check: any page, console, `document.modelContext` must print an object.

### Two screens

- **LEFT — ChatGPT desktop app**, using its in-app browser. This is *the AI*.
- **RIGHT — your Chrome.** This is *you*.

From beat 4 onward both are on the same page, and the AI on the left puts things
on your screen on the right. If the viewer can't see both, that beat is dead.

### Only two tabs

| Tab | Screen | URL |
|---|---|---|
| 1 | RIGHT | `https://cohere.com` — extension loaded |
| 2 | BOTH | `/wiki?doc=upload:capture-cohere-5f71a053.md` |

That is the entire demo. Two tabs.

### Pre-record beat 3

The capture fetches a live third-party website through a headless browser.
Twelve seconds normally, but it depends on somebody else's server. **Record it
separately and cut it in.** Never live.

---

# The run

---

## Beat 1 · 0:00 – 0:26 · The situation, and what everybody actually gets

**On screen:** a plain code editor or a chat window. Nothing of ours.

> "I'm building a pricing section for my startup tonight. I don't have a
> designer. So I do what everyone does now — I ask an AI."

**On screen:** the generated card. Let it sit for two seconds.

> "And this is what everybody gets. It's fine. It's also the same card that's on
> ten thousand other sites. Because the AI has no idea what *my* product looks
> like. Nobody told it."

**What the viewer should feel:** *I have been here.* You have not mentioned your
product yet. Don't.

---

## Beat 2 · 0:26 – 0:46 · Why it happens — and it isn't taste

**On screen:** an ordinary website. Any one.

> "It's not that the AI has bad taste. Nobody gave it a standard. Real companies
> have one — exact colours, exact spacing, things you never do. But it lives in
> a Figma file, or somebody's head. And the AI is looking at a web page. None of
> that is *in* a web page — so it gives you the average of the internet."

**What the viewer should now understand:** *the rules exist, but the machine
doing the work can't see them.* This is the sentence the entire video rests on.

---

## Beat 3 · 0:46 – 1:14 · The turn — I take a rulebook

**This is where BlockSmith arrives.** Say the name here and nowhere earlier.

**On screen:** tab 1, `cohere.com`, extension running. The badge is visible in
the corner: *"BlockSmith · 4 agent tools live on this page."*

> "So what if you didn't need to know any of this? That's BlockSmith. Two ways
> in. Bring the rules your team already has — or point at a site you admire and
> say: fetch me that one."

**On screen:** on the words "fetch me that one", the capture runs (pre-recorded).

```
Captured Cohere — 14 colours · 2 typefaces · 16 components
```

> "Twelve seconds. Their colours, their spacing, their type, read off the live
> page. I'm not copying their website — I'm borrowing their discipline. And now
> it's mine."

**Emphasise "I'm not copying their website."** It's the honest claim and the
more impressive one — anyone can screenshot a site; almost nobody can pull out
the decisions underneath it.

---

## Beat 4 · 1:14 – 1:48 · The same request, standing on my rulebook

**On screen:** both screens now on tab 2 — my new rulebook. Left is ChatGPT's
in-app browser sitting on it.

> "Now the same request again — except this time the AI is standing on my
> rulebook."

**Type:**
`Build me a pricing card for the Pro plan at $29 a month and show it to me on the page.`

*Two tool calls appear in ChatGPT. It reads the rules first, then builds. Do not
name either one out loud — just let the viewer watch it happen.*

*The component appears on the **RIGHT-hand screen**. Point at it.*

> "It didn't guess. Before it wrote a line, it asked the page what it was
> allowed to use. And there it is, on my screen, in my colours. I never pasted a
> style guide into that chat."

**If it comes back with violations instead of a clean pass** — likely, and
*better television*: read one out, then type `fix what you can`. It repairs the
mechanical ones and hands back the rest. Narrate:

> "It fixes what it can, then stops. The rest it hands back — those aren't
> typos, they're decisions."

---

## Beat 5 · 1:48 – 2:10 · The rule no scraper could ever find

> **Cut this beat first if you are over time.** It is the only one that argues
> rather than acts — but it is also the sharpest proof in the video, so cut it
> reluctantly.

**On screen:** scroll to the Don't list on the right-hand screen. Highlight this
line:

```
Do not use #ff7759 Red for UI chrome or interactive elements — it is decorative only
```

> "And here's what I couldn't have got any other way. That red is right there on
> their website — you can see it. Anything that scrapes a page would grab it and
> stick it on a button. But somebody decided that red is decorative. It never
> touches a control."

> "That decision isn't a pixel. It isn't in the HTML. No screenshot contains it.
> It exists because the page can say it out loud — and now my AI knows it too."

**Slow down here.** This is the twenty seconds a judge scoring the technology is
waiting for, and it is said entirely in plain English.

---

## Beat 6 · 2:10 – 2:44 · I change my mind, and it asks permission

**On screen:** stay on tab 2. Both screens in frame.

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
the AI is never working from a stale copy.*

---

## Beat 7 · 2:44 – 2:58 · Close

**On screen:** the finished pricing section and banner, together.

> "A pricing section and a banner, built by an AI in one sitting — and every
> colour in them is mine. That's WebMCP: the page itself handing an agent the
> rules. Agents will build most of the web from here. It doesn't all have to
> look the same. They just need somebody's rules — and a page that hands them
> over."

---

# Everything you type, in order

```
1. Build me a pricing card for the Pro plan at $29 a month and show it to me on the page.
2. (only if beat 4 comes back rejected)  fix what you can
3. Build a launch banner using #7c3aed and show it to me on the page.
4. Then propose adding it to the system as a new token.
5. Check that banner again.
```

If ChatGPT answers from the page text instead of calling a tool, say once:
**"Use the tools this page provides."** One nudge per session is usually enough.

---

# If something goes wrong

| Problem | What to do |
|---|---|
| **Capture is slow / their site is down** | Expected. **Pre-record beat 3.** Never run it live |
| The AI answers without calling a tool | *"Use the tools this page provides."* |
| Beat 4 passes cleanly with nothing to fix | Fine — skip the `fix what you can` line and move on. It's a shorter, cleaner beat |
| Beat 4 comes back with violations | **Better.** Read one out and use the fix line. This is the scripted path |
| **Approve returns an error** | You are not signed in on the right-hand screen |
| The proposal never reaches the right screen | `curl ".../api/webmcp/proposal?doc=upload:capture-cohere-5f71a053.md"`. It's stored durably, so this should hold |
| No badge on cohere.com | Reload. The Chrome flag must be on and the extension loaded unpacked |
| Over 2:50 | Cut beat 5 |

**Record a safety file first.** Beat 6 is the whole argument in thirty seconds
and needs only your own two screens. Record it alone, once, before the full run.

---

# Before you hit record

**App**
- [ ] `demo:reset` twice, everything under 1500ms
- [ ] Beat 3 already recorded and edited
- [ ] Signed in on the right-hand screen

**Browser**
- [ ] Chrome flag enabled and browser relaunched
- [ ] Extension loaded unpacked from `extension/`
- [ ] `document.modelContext` prints an object
- [ ] Two tabs only, as in Setup

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
- [ ] If you approved the purple token, remove it before running beat 6 again

---

# Where each judging criterion is proved

| Criterion | Time | What the judge sees |
|---|---|---|
| **Potential Impact** | 0:00–0:46 | A problem anyone who has shipped a site recognises, plus a precise diagnosis of why it happens |
| **Creativity & Ambition** | 0:46–1:14 | Our tools running on a site we have no relationship with; a rulebook pulled off a live page in twelve seconds |
| **WebMCP Leverage** | 1:14–1:48 | The AI querying the page for its constraints *before* generating, with the calls visible on screen |
| **WebMCP Leverage (2)** | 1:48–2:10 | A rule with no DOM representation at all — a judgement about a colour that is plainly visible |
| **Human–agent collaboration** | 2:10–2:44 | It proposes, a person approves, its next answer changes. The AI never holds write access |
| **Execution** | throughout | One live URL, one continuous task, finished on camera |
