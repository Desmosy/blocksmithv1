# For judges — no code required

You will not paste any code. You will ask an agent for a component and watch a
design system accept or refuse it, on the page, in front of you.

Budget about 15 minutes. Nothing here needs a developer.

---

## First, what WebMCP actually is

Today an AI agent using a website does what you would do: it looks at the
screen, guesses which button to click, and clicks it. It is reading the
*surface*.

WebMCP lets a website hand the agent a set of **labelled actions** instead —
"here is how you search this catalogue", "here is how you check a component
against our rules." The agent stops guessing.

The interesting part is what that makes possible. A page can hand over things
that are **not on the screen at all**. This project hands over a design team's
decisions:

- *this system does not do tooltips — use inline help instead*
- *`Card/Product` is deprecated; use `Surface`*
- *one primary button per view*

None of that is visible on any screen. No amount of looking at a page recovers
it. It exists only because a team decided it. That is what you are here to
evaluate: whether handing an agent a team's *intent*, rather than its
*interface*, is worth doing.

---

## Part 1 — Look at the product (5 minutes, no setup)

Open the live URL. You are in a **design system wiki** — the reference a design
team keeps: colours, type scale, spacing, components, rules.

**Browse it.** Colour, Typography, Spacing, Components in the left sidebar.
This is a real system with real opinions, not lorem ipsum.

**Look at a second one.** Add `?doc=saas.md` to the URL, then `?doc=docs.md`.
Three completely different systems — different typefaces, different palettes,
different rules. Each was authored, not generated from a template.

**Now the part that matters.** Go to **Governance** in the sidebar. You'll see a
panel that says *"Check a component"*. Click **"Try a typical AI component"**.

That loads a pricing card of the kind AI tools produce — purple gradient, drop
shadow, a stock blue. Watch the right-hand panel.

It says **REJECTED**, and for each problem it tells you *which rule*, in the
design system's own words:

> **Gradients are not allowed in this design system.**
> Rule: *"Do not use gradients anywhere, including on buttons and backgrounds."*

That sentence was written by whoever authored the design system. The tool is
quoting them back. **This is the thing to judge** — not that a linter found a
gradient, but that the refusal explains itself in the team's own language.

**One more.** Change the URL to `?doc=saas.md` and try the same component. The
violations change, because a different team decided differently. The code never
moved; the system judging it did.

---

## Part 2 — Bring an agent (10 minutes)

Now the actual point: an agent uses those same rules, and you watch.

### The easy way — ChatGPT's browser

ChatGPT's in-app browser supports WebMCP already. Nothing to install.

1. Open **ChatGPT** (the desktop or mobile app).
2. Ask it to open the live URL — *"open [URL] in the browser"* — or paste the
   link and let it browse.
3. Once the page is open, say:

   > **Build me a pricing card for a Pro plan at $29/month that fits this
   > design system.**

You do not need to explain the rules. The page gives them to the agent.

**What to watch for:**

- The agent reads the system first, rather than guessing.
- The component appears **on the page** — rendered, in that system's own
  colours and typefaces. You did not paste anything.
- Beside it, the verdict. If the agent got something wrong, the rule is quoted.
- Ask it to fix what it got wrong. It should correct itself using the specific
  replacement it was given, not by guessing again.

Then try this:

> **Add a tooltip explaining what the Pro plan includes.**

The system's answer comes back through the agent:

> *Tooltip — not part of this design system. Use Meta Label instead.*

The agent stops rather than inventing something. That refusal is authored, not
inferred.

### The other way — Chrome

If you would rather use Chrome:

1. Type `chrome://flags/#enable-webmcp-testing` in the address bar.
2. Set it to **Enabled**, then click **Relaunch**.
3. Open the live URL.

Look under the page header for a line reading **"12 agent tools live on this
page."** That means the page is offering tools to any agent in the browser.

Nothing breaks without the flag — the page just doesn't show that line.

---

## What to judge

Some suggestions, in rough order of how much they matter.

**Does the refusal teach?** Compare *"invalid colour"* with *"`#e0e0e0` is not a
design token. Use `Rule` (#e2e4ea) instead."* The second is what lets an agent
fix itself in one turn. Is it doing that consistently?

**Is it handing over intent or interface?** Ask the agent something the page
does not display — *"what components does this system deliberately not have?"*
There is no screen showing that. If the answer is right, the page gave it
something a screenshot never could.

**Does it refuse well?** Ask it to fix everything automatically. It applies what
it can and hands back a list of what it won't — a colour with no near match, a
gradient whose removal changes the composition. **Judge whether the split is
right.** A tool that silently substituted a grey for a blue would be worse.

**Does the human stay in charge?** Every tool call is visible. The agent's work
lands on your screen, not in a hidden sidebar. Is that enough oversight, or too
much noise?

**Is it honest?** Ask for something that should fail. Does it fail cleanly, or
paper over it?

---

## Things we are not claiming

Stated plainly, so you can weigh them rather than discover them:

- **Enforcement is mechanical.** Colours, spacing, type sizes, radii, banned
  patterns, and composition rules like "one primary per view." It does not judge
  whether a layout is any *good*. Nothing here has taste; it has rules.
- **This makes output more uniform, not less.** It is not a cure for AI
  sameness. It is a way to choose *which* sameness — your team's.
- **The rendered preview is limited.** It shows this system's tokens and inline
  styles. A sandboxed frame cannot run a utility framework like Tailwind, so a
  missing gradient in the preview is the preview's limit. The written verdict is
  the accurate account.
- **Pointing at a website reads what its CSS states.** It cannot see *why* a
  choice was made, so a captured system arrives as a draft with no components.

---

## If something doesn't work

- **No "agent tools live" line?** Your browser doesn't have WebMCP. Use
  ChatGPT's browser, or the Chrome flag above. The page still works without it.
- **The agent ignores the page.** Some agents need prompting to use page tools —
  try *"use the tools this page provides."*
- **A page seems stuck loading.** Give it a few seconds on first open; the
  design system is parsed on the server.
