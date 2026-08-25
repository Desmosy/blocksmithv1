# The North Star Tracks: Restyle The Web, Then The Device Layer

**What this chapter covers:** the two long-horizon tracks that define what this company is ultimately for, and that are deliberately not being worked on right now. Track one is a browser extension that lets a person apply their own design system to any live site on the internet. Track two is extending that same per-user control below the browser, down to device and operating system interfaces. This chapter states each claim in full, explains why both are the same engine rather than two new products, names the hard problems without softening them, records exactly what code exists today, and writes down the conditions under which either track becomes active work.

**Why it matters:** parked ideas rot in one of two ways. They get forgotten, and someone else builds them. Or they leak into a sales conversation, and the near-term product loses credibility because the pitch sounds like a company that has not decided what it does. This chapter exists to prevent both failures at once. It is the permanent record of the vision *and* the fence around it.

**Read this if:** you have heard the phrase "change Facebook's layout from a prompt" and want to know whether that is real, or you found `scripts/compile-device.ts` in a Next.js repository and wondered what it is doing there, or an investor asked you about hardware and you do not yet know how much to claim.

---

## 0. Read the status words before you read anything else

Everything in this chapter is subject to the status vocabulary defined in [`STYLE.md`](./STYLE.md). Both tracks contain a mixture of Shipped, Built-unproven, Planned, and Idea, and the mixture is not intuitive. Some of the hardware work is genuinely shipped and covered by a verify script. Almost none of the restyle work is.

Here is the honest one-screen summary. Read the rest of the chapter as an expansion of this table, and do not quote any claim externally that is stronger than what appears here.

| Track | Component | Status |
|---|---|---|
| 1. Restyle the web | Screenshot capture extension (`extension/`) sending images to `POST /api/ingest/capture` | **Shipped**, and uncommitted to git (see 1.6) |
| 1. Restyle the web | Live DOM to Design IR extraction | **Idea**. No code. No content script. No host permission for third-party sites. |
| 1. Restyle the web | Applying a user's design system back onto a third-party page | **Idea**. No code, no design, no storage model. |
| 2. Device layer | Device profile compile target (`src/lib/ir/targets/device-sim.ts`) | **Shipped**, asserted by `npm run verify:ir-cicd` |
| 2. Device layer | C token header emitter (`src/lib/ir/targets/c-header.ts`) | **Shipped**, asserted by `npm run verify:ir-cicd` |
| 2. Device layer | Browser device frame simulator (`/demo/device`) | **Shipped** |
| 2. Device layer | LVGL descriptors, RTOS style packs, dev board profile, HMI pipeline, OTA | **Planned** at the roadmap level, **Idea** at the design level. No code, and `grep -r "OTA" src scripts packages` returns nothing. |

Notice the asymmetry. The hardware track has three real emitters and a verify script. The restyle track has one screenshot tool that does not read a page. When you talk about these tracks, the hardware one is further along than people expect and the restyle one is much further behind than the vision statement implies.

### A correction to Chapter 03

[Chapter 03](./03-what-blocksmith-is.md), section 3, states: "There is no extension directory in this repository." That was true of the git repository at the time and it is still true of the git repository today, but it is false of the working tree. `extension/` exists on disk with five files. It is not what the north star describes, but it is not nothing. Section 1.6 records exactly what it is. When Chapter 03 is next revised, that sentence should be replaced with a pointer here.

---

# Part 1: Track one, restyle anything on the internet

## 1.1 The claim, in full

The claim, in the founder's own framing from `north-star-vision.md`, is this:

> The engine is strong enough that a user can restyle and restructure anything on the internet, not only documents they upload. The delivery vehicle is a browser extension that applies a user's prompt or design system to live third-party sites. The canonical example is changing a major social network's layout from a prompt. Each user gets independent, personal control of any UI they encounter.

Unpack the three parts, because each one is a separate bet.

**Anything on the internet.** Not a partner integration, not a set of supported sites, not a curated list. An arbitrary page, including one that has never heard of us, has no cooperation agreement with us, and actively resists being reshaped by anyone other than its owner.

**A user's own design system.** This is what separates the idea from a userstyle manager or a dark-mode extension. Stylus and Dark Reader restyle a page. They do not hold a *system*. The claim here is that a person owns a governed design system, the same shape of artifact a team owns in the wiki today, and that system can be projected onto whatever surface they are looking at. Your type scale, your surfaces, your spacing rhythm, your density preference, applied to a page that was designed by strangers.

**Independent, personal control.** Today the person who decides what an interface looks like is the team that shipped it. You get their choices. The claim is that this is an accident of tooling rather than a law. If a UI has a governed machine-readable representation, and an engine can recompose it faithfully inside validated constraints, then the design system can belong to the viewer rather than the publisher.

That last sentence is the actual thesis of the company at maximum altitude. Everything BlockSmith sells today is a special case of it where the viewer and the publisher happen to be the same team.

## 1.2 Why this is the same engine and not a new product

The most common misunderstanding, including internally, is that the extension is a second product that would need to be built from scratch. It is not. It is the existing engine pointed at a different input.

The engine has a specific and unusual shape, described fully in [Chapter 13](./13-the-ai-layer.md). Stated compactly: **deterministic composition, with AI constrained to selecting inside validated bounds.** The model never emits raw CSS that goes straight to a screen. It selects from and arranges governed primitives, and its output passes through validators that can reject it.

That shape appears in at least four places in the current codebase, which is why it should be read as an architectural commitment rather than a coincidence:

- **Visualize.** `src/lib/design-ir/semantic-resolve.ts` deterministically resolves wiki chrome colors from the IR, and `src/lib/design-ir/merge-ai-chrome.ts` merges an optional AI refinement on top. Both paths end at the same call: `enforceChromeLegibility()`. The AI can suggest, and the guardrail has the last word.
- **Pulse codegen.** The model does not write CSS. It composes governed primitives generated from promoted blocks.
- **Governed generation.** `src/lib/ai/governed-generate.ts` scores model output with `findOffTokenColors()` and `nearestToken()`, the exact functions the CI gate uses.
- **font-generator.** The model picks a base family and axis values, and `sanitizeParams` validates them. It does not draw glyphs.

Now map the extension onto that engine. The wiki proves the engine on documents a team owns, where the source is clean and the team consented. The extension points the same engine at the live DOM of arbitrary sites, where the source is hostile and nobody consented. **Only the input changes.** The IR, the composition rules, the validators, and the guardrails are already built.

That is the whole argument for why this is a north star rather than a pivot. It is also the argument for why it must come second: an engine that cannot be trusted on the easy case has no business being pointed at the hard one.

### The guardrails are the product, not a safety feature

There is a specific reason "restyle any site" is a credible thing for *this* company to say and a reckless thing for most companies to say, and it lives in two files.

**`src/lib/governance/color-lint.ts`** implements the no-invented-tokens rule. `paletteFromColors()` builds the set of legal colors from the design system. `findOffTokenColors()` finds every raw hex literal in a body of code that is not in that palette, with line numbers. `nearestToken()` points at the token the author probably meant, using squared RGB distance. This exact module is imported by three separate enforcement surfaces: the MCP tool handler at `src/mcp/handlers.ts`, the commit and CI gate at `src/lib/governance/check-diff.ts`, and the governed generation scorer. One rule, three enforcement points, no divergence.

**`src/lib/design-ir/color-utils.ts`** implements the legibility rule. `contrastRatio()` is WCAG relative luminance. `ensureReadable(fg, bg, min = 4.5)` returns the supplied foreground if it clears the threshold and a derived legible one if it does not. `legibleMuted()` blends body text toward the surface in steps until it clears a lower threshold, so that muted text stays on-palette instead of falling back to grey. `enforceChromeLegibility()` runs the whole map: body text on background, muted text on background and again on the sidebar surface, the CTA label on the accent fill, nav text on nav background.

Put those two together and you get the sentence that makes the north star defensible: **an arbitrary restyle of an arbitrary page cannot invent a color that is not in your system, and cannot produce a text and surface pairing you are unable to read.** That is the difference between a personal design system and chaos. Without those guardrails, "AI restyles the web" produces unreadable pages and the idea dies on first contact with a user. With them, the output is bounded by construction.

This is worth internalizing because it inverts the usual reading. The governance machinery looks like enterprise compliance plumbing. It is actually the thing that makes the consumer vision possible.

## 1.3 The nearer-term concrete feature: any webpage to a `design.md`

Between "nothing" and "restyle Facebook" there is one intermediate feature that is worth far more than its cost, and it is the one the founder's `extension-restyle-web.md` note actually specifies:

> An AI extension that analyzes any webpage on the internet and produces a `design.md` (Design IR) from it, extracting tokens, type scale, surfaces, and components from the live DOM and CSS.

Read direction only. No writing back to the page. No overrides, no persistence, no per-user state. You point the extension at a page and BlockSmith gives you that page's design system as a governed document.

The reason this is the right first step is that it is almost entirely free. Everything downstream of `design.md` already exists and does not care where the document came from. Here is the exact inventory of what a DOM extractor would inherit on day one.

| What the extension would need | What already exists | Path |
|---|---|---|
| A place to send extracted data | Capture ingest endpoint, auth, rate limits, org registration | `src/app/api/ingest/capture/route.ts` |
| A document format the system understands | The Style Reference `design.md` shape the wiki already renders | `src/lib/ingest/capture.ts`, `data/uploads/design-*.md` |
| Storage, ownership, multi-tenancy | Upload store, document registry, org access checks | `src/lib/uploads/store.ts`, `src/lib/cloud/documents.ts`, `src/lib/cloud/access.ts` |
| Turning the document into blocks | The full ingest to IR path | `src/lib/blocks/refresh.ts`, `src/lib/ir/registry.ts` |
| A human surface to review the result | The entire wiki | `src/app/wiki/`, `src/components/wiki/` |
| A truth model for uncertain extractions | The capture draft lifecycle and provenance footer | `CAPTURE_DRAFT_MARKER` in `src/lib/ingest/capture.ts` |
| Governance and validation on the result | Tiered governance, color lint, legibility | `src/lib/governance/`, `src/lib/design-ir/color-utils.ts` |
| Compile targets for the result | Pulse, MCP, device profile, tokens header | `scripts/codegen-pulse.ts`, `src/lib/ir/targets/` |

The new code is one browser content script and one normalizer. Everything else is reuse. That is the definition of a cheap experiment, and it is why this specific feature is the natural first unpark.

There is also a strategic reason it is the right first step, separate from cost. A DOM to IR extractor is the *read* half of the restyle loop. You cannot faithfully rewrite something you cannot faithfully read. Building the read half first means the hardest unsolved problem gets attacked in isolation, with a visible artifact at the end (a wiki page you can look at and judge), instead of being buried inside a feature where a bad extraction shows up as a subtly wrong page.

### The truth model transfers directly, and it matters

The capture pipeline already established the rule that a machine-extracted design document is a **draft project pending human review**, not a source of truth. From `docs/DESIGN-FIRST-INGEST.md`, the tiered confidence order is explicit:

```
code scan  >  design-tool node tree  >  vision capture
```

A DOM extraction would slot in as a fourth tier, somewhere between the node tree and the vision capture: more exact than a screenshot (you are reading computed values, not guessing from pixels) and far less trustworthy than a code scan (you are reading someone else's compiled output with no access to their source or their intent).

The mechanism to enforce that is already built. `CAPTURE_DRAFT_MARKER`, the string `<!-- blocksmith:capture-draft -->`, is embedded in the generated markdown. While it is present the wiki shows a banner on every page of the document, and the document can never auto-promote into a lock. A human strips it by clicking Confirm. A DOM extractor should emit the same marker on day one and inherit the same banner for free.

## 1.4 The hard technical problems

These are stated in `north-star-vision.md` as "open questions to revisit before committing eng." They are open in the strong sense: nobody has designed a solution, and at least two of them are genuinely hard rather than merely unbuilt. Do not let anyone tell you this is a weekend project.

### Problem 1: per-site DOM to IR extraction from a live page

A repo scan reads *source*. It sees `--color-accent: #d97757` in a stylesheet and a `Button.tsx` that exports a component with named variants. Names, intent, and structure are all present because a human wrote them for other humans.

A live page gives you none of that. You get a rendered DOM and a computed style tree. The stylesheet has been minified, the class names are hashed (`.a7f3b2`), the component boundaries have been erased by the compiler, and utility-class frameworks have shattered every semantic grouping into hundreds of atomic declarations. What you can read is real but flat.

Note that we already have the machinery for reading computed values in the browser: `src/lib/visual/computed-metrics.ts` exposes `readBoxModel()` and `readComputedSnapshot()`, which pull the box model, font size, line height, letter spacing, weight, family, color, background, radius, and shadow off a live element through `getComputedStyle`. That is genuinely the closest existing analog to what a DOM extractor needs, and it is a real head start. But it reads **one element at a time in our own page**, for the inspector overlay. It is a measurement primitive, not an extractor.

The unsolved part is the inference layer above it:

- **Tokens from frequencies.** A page has three hundred distinct color values in its computed styles. Perhaps twelve of them are the design system and the rest are anti-aliasing artifacts, one-off borders, third-party embeds, and ad iframes. Deciding which twelve is a clustering and ranking problem with no ground truth to check against.
- **Type scale from samples.** You will observe font sizes of 13, 13.008, 14, 15.996, 16, 17, 24, 32. Recovering the *intended* scale from the observed values means deciding what is rounding, what is a browser default, and what is a deliberate step.
- **Component boundaries from structure.** There is no `Button.tsx`. There are forty-one `<div>` elements that happen to look like buttons. Grouping repeated structural and stylistic patterns into a thing worth calling a component is the core problem, and it is the one where a wrong answer produces a `design.md` that is confidently useless.
- **Semantic roles.** "This is the primary CTA" and "this is a muted surface" are judgments about intent. The Figma track already decided the rule for this class of problem, and it applies verbatim here: **vision describes, structure governs.** A vision or language model may supply the prose role, and it may never supply a value that something downstream treats as authoritative.

### Problem 2: persistence and sync of per-user overrides

The read-only feature has no state. The full restyle feature has a great deal of it, and none of the existing storage model applies.

Today, storage is org-scoped by construction. `src/lib/cloud/documents.ts` registers documents against an org, `src/lib/cloud/access.ts` gates every read, and the entity model in [Chapter 03](./03-what-blocksmith-is.md) is emphatic: one team, one design system, one package, and there is no such thing as "my version of the design system."

A restyle extension inverts that model completely. The unit becomes one person, holding one design system, applied across N third-party sites, synced across their devices, and surviving the day the site redesigns. Every question that follows is unanswered:

- Is an override stored against a URL, a URL pattern, a domain, or a selector path? All four are wrong in a different way.
- Does the user's design system live in a wiki document, and if so who is the org? A single-member org for every consumer user is a viable answer and nobody has evaluated it.
- What is the promote and lock story for a personal system? See section 3.2, because this is where the two hop rule bites hardest.
- What happens when a user has an override for a site and then that site is also scanned by their employer's org? Two graphs, one page.

### Problem 3: performance on third-party sites

Our own pages are ours. Third-party pages are a hostile runtime, and every constraint below is real:

- The extraction has to walk a DOM that may hold tens of thousands of nodes. `getComputedStyle` forces style resolution, and calling it in a loop over a large tree is one of the classic ways to freeze a browser tab.
- Applying a restyle means fighting specificity against a stylesheet you did not write, on a page that may re-render continuously under a framework that owns the DOM.
- Single-page applications replace their DOM after navigation, so any override has to survive mutation. That means a `MutationObserver` running for the lifetime of the tab, which is exactly the mechanism that makes extensions notorious for battery drain.
- Content Security Policy on many large sites restricts injected styles and scripts.
- If any part of the pipeline is a server round trip, the user is waiting on a network call before their page looks right. Every frame of that wait is visible.

The architectural answer that follows from our own principles is that the **apply** step must be fully deterministic and local, with zero network in the hot path, and any model call must happen once at system-authoring time rather than per page load. That is the same hybrid resolution Visualize arrived at after an early AI-only version was rejected for making users wait with nothing on screen. See [Chapter 01](./01-origin-story.md) for that episode. It is the single most transferable lesson we have for this track.

### Problem 4: resilience when a site ships a redesign

Every override is coupled to a structure that a stranger controls and changes without notice. A CSS selector, a DOM path, a class name, and a text anchor are all fragile in different ways, and a large site may deploy several times a day.

Note that this is not an entirely new problem for us. It is **drift**, which is the thing the Figma track already treats as its most valuable artifact: "Figma says X, shipped code says Y." The equivalent here is "your override assumed X, the site now renders Y." We already have the vocabulary and the graph shape for that. `src/lib/figma/drift.ts` and `component-drift.ts` compute token-level and variant-level divergence between two sources held in one graph.

What is genuinely unsolved is the failure mode. When drift is detected on a third-party page, what should the user see? Reverting to the site's own design silently is confusing. Applying a stale override to a changed structure produces a broken page. Prompting on every navigation is intolerable. Nobody has picked.

### Problem 5: where the deterministic and validated boundary sits with no clean source

This is the deepest question and it deserves to be stated precisely.

The engine's guarantee is that AI selects inside validated bounds. The bounds come from the design system, and the *anchor* comes from the source document. When a team scans their repo, the extracted tokens are facts, the components are facts, and the model is only allowed to propose prose and arrangement on top of facts. Auto-promotion of scan facts is justified precisely because shipped code is a fact rather than a proposal.

On an arbitrary web page, **the extraction itself is a judgment.** There is no clean source document. The "tokens" are a clustering result. The "components" are a pattern-matching result. So the model's output is being validated against bounds that the model helped construct, and the guarantee weakens from "provably on-brand" to something softer that nobody has yet articulated.

There is a defensible answer available and it should be written down as a design constraint before any code is written:

> The bounds come from **the user's own system**, which is a clean governed document with a promote history. The page extraction is only ever used to decide **where** to apply which bound, never to widen the bounds themselves. An extracted color from a third-party page may never enter the user's palette automatically.

If that constraint holds, the guarantee is preserved: no invented tokens, and legibility enforced, because both are checked against the user's system rather than the page. If that constraint is ever relaxed for convenience, the whole safety argument collapses and the product becomes a very fast way to make the web unreadable.

## 1.5 How a thin client surface is built here, for reference

Whoever builds the real extension should copy the pattern that `figma-plugin/` established, because it is the house style for client surfaces and it was arrived at deliberately.

`figma-plugin/` contains four files: `manifest.json`, `code.js` (the plugin main thread), `ui.html` (the panel), and `README.md`. The properties worth copying:

- **The client is thin and the server is thick.** The plugin exports up to four small previews and posts them to BlockSmith. All extraction and model work happens server-side, behind the same auth and the same rate limits as every other endpoint.
- **Credentials live in the client's private storage, never in the document.** The README is explicit: the `bs_live_…` API key is stored in Figma's private `clientStorage`, not in the Figma file.
- **Network access is allowlisted, not open.** `manifest.json` declares `networkAccess.allowedDomains` as the production origin plus `http://localhost:3000`, with `devAllowedDomains` narrowing further.
- **There is a deterministic local path that works without the server.** The README notes a local deterministic preview remains available with no server call. Same hybrid principle as Visualize.
- **Everything the human applies is reviewed first.** The flow is generate proposals, review every checked proposal, then apply. The plugin never writes to the document unprompted.

The existing `extension/` follows the same shape: the popup does the user-gesture work, the server does the extraction, `background.js` is an intentionally empty service worker that exists only because MV3 requires one for the action to be installable, and the server origin is configurable but defaults to production.

A restyle extension breaks exactly one of these properties, and it is worth naming: it needs broad host permissions to read and modify third-party pages, where both existing surfaces have narrow allowlists. That is a meaningful escalation in what the user is trusting us with, and it is a store-review risk as well as a security one.

## 1.6 What exists in `extension/` today, precisely

This section is deliberately literal, because the gap between what the directory is named and what it does is the single most likely source of an overclaim.

**Five files:** `manifest.json`, `background.js`, `popup.html`, `popup.js`, `README.md`.

**It is a Manifest V3 Chrome extension named "BlockSmith Capture", version 0.1.0.** The description reads: capture any design from Canva, Figma, Adobe, or live sites, and turn it into a governed `design.md` in your BlockSmith wiki.

**What it actually does.** The popup calls `chrome.tabs.captureVisibleTab()` to take a JPEG screenshot of the visible area of the current tab at quality 82. Up to four shots accumulate in `chrome.storage.session`, so the user can capture different frames, scroll positions, or hover states of the same design. Clicking Generate posts the array of data URLs to `POST /api/ingest/capture` with `credentials: "include"`, so the user's existing browser session authenticates the call. The server runs vision extraction and returns a wiki URL, which the extension opens in a new tab. There is an optional "Enrich Figma doc" field, and if the captured tab is a `figma.com/design/...` or `figma.com/file/...` URL the popup auto-fills a stable document reference of the form `upload:scan-figma-<fileKey>.md`, matching the slug the Figma connector uses. The server origin is stored in `chrome.storage.sync` and defaults to the production deployment.

**What it does not do, and this is the important half:**

- It has **no content script**. Nothing of ours ever runs inside the page.
- Its permissions are `activeTab` and `storage`. It does not request `scripting`, and it does not hold `<all_urls>` or any third-party host permission. `host_permissions` lists only the BlockSmith production origin and `http://localhost:3000`, which are the servers it talks *to*.
- It therefore **cannot read the DOM, cannot read computed styles, and cannot modify any page**. It takes a picture. That is the entire client-side capability.
- `background.js` is a no-op `onInstalled` listener with a comment saying it is intentionally empty.

**Server side, which is the substantive part.** `src/lib/ingest/capture.ts` runs the vision extraction and produces a Style Reference `design.md` in the same format as `data/uploads/design-*.md`, so the output flows through the existing upload to wiki pipeline with no new UI. `src/app/api/ingest/capture/route.ts` gates on `isCaptureConfigured()` (returns 503 when no vision model is configured), requires a signed-in user in SaaS strict mode, applies the same AI rate limits as other model endpoints, and registers the resulting document against the user's org. Generated documents carry a provenance footer and the `<!-- blocksmith:capture-draft -->` marker, and are never auto-promoted into a lock. `docs/DESIGN-FIRST-INGEST.md` records this as Phase 1, shipped.

**The status honestly stated.** This is a *design-first ingest* tool that happens to live in a browser. It belongs to the ingest story described in [Chapter 08](./08-ingestion-how-truth-gets-in.md), not to the north star. Calling it "the restyle extension, version 0.1" would be false. Calling it "we already ship a browser extension" is technically true and misleading in context, so do not say it without immediately saying what the extension does.

**One operational finding that needs fixing.** Both `extension/` and `figma-plugin/` are **untracked in git**. `git status --porcelain` reports them as `??`, and `git check-ignore` confirms neither is ignored, so this is not deliberate exclusion. They exist only on one machine. `git log -- extension/` returns nothing, so there is no history to recover. Two client surfaces that are documented in `docs/DESIGN-FIRST-INGEST.md` as shipped exist nowhere but a laptop. They are outside CI, outside review, and one disk failure from gone. Committing them is a few minutes of work and should happen before anything else in this chapter is acted on.

## 1.7 The ICP separation rule, and why it is enforced

This is the rule that saves you from a bad meeting, and it is stated in the founder's own note (`extension-restyle-web.md`), in [Chapter 01](./01-origin-story.md), and again in [Chapter 03](./03-what-blocksmith-is.md) section 7. It is repeated here because it applies to this chapter's contents more than to anything else in the book.

**The rule.** The restyle-the-web track never appears in design-system customer material. Not in a deck, not in a demo, not in a landing page, not as a "and eventually" bullet on a slide a customer will screenshot.

**Why.** A Figma-centric design-system lead does not care that you can scrape a public website. In the founder's words: they care that *their own* system is enforced. Showing that buyer "look, we restyled Facebook" does not read as power. It reads as a company that has not decided what it does.

Concretely, it raises three objections at once, and all three are expensive:

1. **Is this a toy?** Consumer browser extensions and enterprise design governance have different smell profiles. The moment one shows up in the other's pitch, the buyer starts pattern-matching to "side project."
2. **Is this legal?** A large-company procurement or security reviewer hears "modifies third-party sites" and starts thinking about terms of service, about what else the extension can see, and about whether their own site could be modified by someone else's users. You have now spent the meeting on a product you are not selling.
3. **Are you actually going to support my workflow?** If the roadmap points at consumers, the enterprise buyer reasonably assumes their enterprise needs will be deprioritized. They are buying a multi-year dependency, and roadmap direction is a real input to that decision.

**What happens to a pitch that mixes them.** You get the worst of both. The listener cannot identify the customer, so they cannot size the market. The near-term product loses credibility, because it now appears to be a stepping stone rather than a thing that stands up on its own. And the long-term vision loses credibility too, because it is being presented before the engine that makes it plausible has been proven on the easier case. Mixing does not add the two stories together. It subtracts.

**The symmetric rule.** It runs the other way as well. Pitching bidirectional Figma drift detection to someone who is excited about consumer UI control reads as narrow enterprise plumbing. Pick your listener, pick your track, stay in it.

**The practical form.** In any given document, deck, or meeting, pick one track. If you must mention the other, mention it once, at the end, labeled as long-term direction, with no implication that it is being built now. This chapter is the place where both live together, and this chapter is internal.

**The correct sequencing, stated once.** Prove the engine on the governed, bounded case (a team's own repo and their own Figma file). Earn the right to the harder case. Then talk about the internet.

## 1.8 Trigger conditions: what would unpark this track, and who decides

Nothing in the repository currently records a trigger for this track. The conditions below are **proposed** and should be ratified into [Chapter 18](./18-decisions-and-tradeoffs.md) before anyone treats them as decided. They are derived from rules that *are* recorded, so they are not invented from nothing: the "ship one correct software loop before hardware or new languages" rule in `docs/00-thesis.md`, the "disconnected work is banned" rule in `docs/CEO-DIRECTIVE.md`, and the Goal 1 and Goal 2 thresholds in the same directive.

**Proposed necessary conditions, all of which must hold:**

1. **Phase 1 is solid in the wild.** `docs/00-thesis.md` already parks a list of things ("ingest-everything, social screenshots, Quartus and FPGA, public block feedback at scale") behind exactly this condition. The restyle track belongs on that list and should be added to it explicitly.
2. **Goal 1 and Goal 2 are each at or above the threshold the CEO directive names on public SaaS**, verified by `npm run verify:production-goals` rather than by assertion.
3. **There is a real external team using the governed loop end to end**, meaning promote in the wiki, pull in their repo, and agents building against the lock. The engine is proven when someone outside the building depends on it.
4. **The read-only half is proven first.** Webpage to `design.md` produces a document a human judges as useful on at least a handful of substantially different real sites, before a single line of restyle-apply code is written.
5. **The deterministic and validated boundary from section 1.4, problem 5, has been written down and agreed.** This is a protocol-level semantics question, which per `docs/TEAM-NORTH-STAR.md` means it needs professor review and not a product decision made in a Friday PR.

**Sufficient conditions to reconsider early**, meaning the parked status should be re-examined even if the above are not all met:

- A credible competitor ships webpage-to-design-system extraction and it works. The option value of being parked drops sharply once someone else has proven the demand and the technique. [Chapter 01](./01-origin-story.md) already flags this in its open questions: there is a real risk this stays parked until someone else builds it.
- The DOM extractor turns out to be a materially better *ingest adapter* for the existing paying customer than the current screenshot capture. That would make it Stream D work rather than north star work, which changes the calculus entirely, because Stream D is funded today.

**Who decides.** Track activation is a founder and CEO decision, not an engineering one, because it is a positioning decision before it is a technical one. `docs/CEO-DIRECTIVE.md` sets the standing merge test ("does this make promoted design truth more visible, more enforceable, or more deployable"), and `docs/TEAM-NORTH-STAR.md` assigns IR and protocol semantics to the professor and research side, with product owning everything that touches a customer's hand. The extraction semantics question in condition 5 is squarely on the professor's side of that line. The go or no-go is on the founder's side. Whichever way it goes, the decision gets written into [Chapter 18](./18-decisions-and-tradeoffs.md) with its reasoning, not merely acted on.

---

# Part 2: Track two, down to the hardware UI layer

## 2.1 The claim

From `north-star-vision.md`:

> Extend that control down to the hardware UI layer, plug and play, so the same per-user UI control applies beyond the browser to device and operating system interfaces. The computer engineering background is the wedge for going below the web stack.

Two separate assertions are bundled there and they should be pulled apart, because they have very different maturity.

**Assertion A, the commercial one:** a promoted design graph should compile to the screens that a design system today reaches only via a PDF handed to an embedded team. Automotive clusters, industrial HMIs, kiosks, wearables, medical panels. This is on the roadmap, partially built, and has an identified buyer profile. It is the version that appears in `docs/CEO-DIRECTIVE.md` section VI as a five-rung ladder.

**Assertion B, the north star one:** per-*user* control below the browser, so that an individual can restyle device and OS interfaces the way they would restyle a web page. This is Idea in the strongest sense. It has no rung on any ladder, no code, and no design. It is the hardware analog of track one, and it depends on track one being solved first.

Almost everything below is about assertion A, because that is where the work is. Do not let the two blur, and in particular do not let assertion B's ambition inflate how you describe assertion A's status.

**Why the team background matters here specifically.** The founders are computer engineering majors. That is not a credential flourish, it is a claim about where the work is cheap. The web layer is well served by people with web backgrounds, and a team of web engineers proposing an embedded compile target is proposing to hire for something they cannot evaluate. A team that is natively comfortable below the browser (constrained memory, display drivers, RTOS scheduling, the reality that a 240 by 240 panel has no layout engine, no cascade, and no font fallback) can build the compile target as ordinary engineering rather than as a research project. Going below the web stack is also where the competition thins out dramatically. Every design-system tool competes on the web. Approximately none of them compile to a watch.

## 2.2 The framing that must never be overclaimed

There is exactly one correct framing and it is already written down in `docs/PITCH-AND-PRODUCT-MODEL.md`. Memorize the pitch line and the table underneath it.

> **One design package, multiple compile targets.**

The common confusion the table exists to kill is "same `import` on web and chip." Here is the table, reproduced with its punctuation rewritten.

| | Software (web) | Hardware / embedded |
|---|---|---|
| **Same input** | The same `.md` or scan document | The same `.md` or scan document |
| **Same contract** | `Button`, `Surface`, colors, rules | The same names plus the same tokens |
| **How you use it** | `import { Button } from "@blocksmith/..."` | Generated C, LVGL, or configuration. **Not** JavaScript on the MCU. |
| **Prototype** | A real React package at `/demo/pulse` | A browser device frame (watch or HMI) from the same IR, at `/demo/device` |

**Row 1, same input.** This is the claim that carries all the weight. There is one promoted graph per product, and both the web package and the device profile are built from it by reading `getOfficialGraph(doc)`. Not a copy, not an export, not a hand-maintained parallel file. You can verify this in thirty seconds: `scripts/compile-device.ts` calls `getOfficialGraph(doc)`, and so does the Pulse codegen path. If those two ever read from different sources, the claim is dead and the whole hardware story becomes marketing.

**Row 2, same contract.** What survives the trip is **names and values**, not syntax. A block called `token:color:accent` at version 3 with value `#d97757` shows up on the web as a CSS variable and on the device as `#define BS_COLOR_COLOR_ACCENT 0xD97757u`. The identifier and the version are preserved verbatim so that an embedded engineer can trace any constant in their firmware back to a specific block at a specific version. `emitTokensHeader()` puts `graphHash` in the file header and `blockId@vN contentHash` in a comment on every single define, exactly so that a firmware build can be audited against the design graph that produced it.

**Row 3, how you use it.** This is the row people get wrong, and it is the row that produces the overclaim on `docs/PITCH-AND-PRODUCT-MODEL.md`'s explicit forbidden list: "same npm `import` on microcontrollers." No. On a microcontroller there is no module system, no runtime, and often no heap worth speaking of. What ships is **generated source or configuration** that a human integrates into their firmware build. The design system reaches the device as artifacts, not as a runtime dependency.

**Row 4, prototype.** The device frame is a browser simulator. It proves semantic compile without taking on firmware risk, and it is honest about being a simulator. Nobody should ever see `/demo/device` and come away thinking they watched a physical device update.

**The two other overclaims on the forbidden list**, both from the same document, are worth reciting: "plug any `.md` into any hardware" and "upload a `.md` and it runs on any hardware." The correct sentence, which is on the permitted list, is: **one IR to web today, device profile tomorrow.** Or, in the version [Chapter 03](./03-what-blocksmith-is.md) uses: **we claim semantic portability, not flash any `.md` to any chip on day one.**

## 2.3 The staged path

`docs/CEO-DIRECTIVE.md` section VI lays out five rungs, and `docs/TEAM-NORTH-STAR.md` splits them across Stream C (compile targets) and Stream E (field and OTA). Here is each stage with what it proves and what it costs, which is the part the source documents do not spell out.

### Stage 1: browser device frame simulator

**What it is.** Compile the promoted graph into a device profile and render it inside a browser frame that mimics a physical screen. `/demo/device` today.

**What it proves.** That the IR carries meaning rather than syntax. The profile contains resolved literal color values (no CSS variable indirection, because devices have no cascade to resolve one), physical touch-target math derived from pixels per millimeter, and governance rules compiled into machine-readable constraints. It also proves that **semantic loss is measurable**, which is a subtler and more important point: `deviceCompileLoss()` returns exactly which blocks did not survive the trip and why, so the loss is a reported number rather than a silent omission.

**What it costs.** Already paid. This is Shipped.

**Its limit.** It proves nothing about hardware. It is a React component drawing a circle. Its entire value is that it forced the IR to answer embedded questions (what is a touch target in millimeters, what is a color without a cascade) at a stage where getting the answer wrong was cheap to fix.

### Stage 2: generated artifacts for real embedded toolchains

**What it is.** `tokens.h` today. The directive names style packs for RTOS, LVGL, embedded Linux, and automotive clusters as the fuller version.

**What it proves.** That an embedded engineer receives something they can compile rather than something they must transcribe. Today the handoff at most companies is a PDF and a spreadsheet, retyped into C by hand, and permanently divergent from the day it is typed.

**What it costs.** `tokens.h` is Shipped and small. An LVGL descriptor emitter is materially harder, because LVGL styles are structs with a defined API surface and getting them wrong produces code that does not compile. Call it real engineering weeks, and it requires someone who has actually written LVGL rather than read about it.

**Its limit.** Generated artifacts still require a human to integrate them into a firmware build. That is fine and should be stated plainly rather than hidden.

### Stage 3: dev board profiles

**What it is.** Flash a reference UI onto a commodity development board with an LCD, built from the promoted graph.

**What it proves.** The first thing on the entire ladder that a skeptic cannot dismiss. Pixels on a physical screen that changed because someone clicked Promote in a browser. Everything before this stage is software claiming things about hardware.

**What it costs.** Cheap in hardware and moderate in time. A board, a display, a toolchain, and a reference application. The real cost is that it introduces a build and flash step that has to be reproducible, and reproducible embedded builds are their own discipline.

**Its limit.** A demo board is not a product. It proves feasibility, not that anyone wants it.

### Stage 4: production HMI pipelines

**What it is.** An OEM team promotes in the wiki, and a build farm emits signed artifacts for their real product.

**What it proves.** That the loop survives an organization with safety requirements, regulatory review, and a release process measured in months.

**What it costs.** Large, and mostly not engineering. Signing infrastructure, a build farm, and above all a design partner willing to route part of their product pipeline through a startup. This is the stage that requires a customer more than it requires code.

**Its limit.** Without a named partner this stage is a slide.

### Stage 5: field deployment with OTA carrying promoted versions

**What it is.** A promoted token or component change ships to devices in the field, with the same version semantics as software: a staging channel, a production channel, rollback, and an audit trail.

**What it proves.** The full thesis. Design truth flows once, from a human clicking Promote to a screen on a factory floor, with nobody retyping anything anywhere along the path.

**What it costs.** Very large. Signed artifacts, staged rollout infrastructure, device fleet management, and a failure mode where a bad promote bricks the visual layer of physical devices you cannot reach. Rollback stops being a database pointer update and becomes a fleet operation.

**Why it matters commercially anyway.** `docs/CEO-DIRECTIVE.md` is direct about this: OTA is the reason automotive, IoT, and industrial teams pay enterprise prices, because their design system must reach devices that cannot run `npm install`. That sentence is the whole enterprise thesis for this track in one line.

**The invariant that runs through all five stages**, and it is non-negotiable: **every hardware milestone must trace to `official` versions and lock pins.** Field devices do not read draft wiki edits. This is the constraint that keeps hardware an extension of the existing thesis rather than a second company. It is already enforced structurally, because `DeviceProfile.graphHash` carries the graph hash and `verify:ir-cicd` asserts that it equals the official graph's content hash.

## 2.4 What exists today, precisely

### `src/lib/ir/targets/device-sim.ts` (Shipped)

Compiles a `BlocksmithGraphV1` into a `DeviceProfile` for one frame.

Three frames are defined in `DEVICE_FRAMES`: `watch-240` (240 by 240, round, 7.5 pixels per mm), `watch-396` (396 by 396, round, 9.8 px/mm), and `hmi-480` (480 by 320, landscape, 6.3 px/mm). `MIN_TOUCH_MM` is 9, so the minimum touch target in pixels is computed per frame from physical density rather than assumed. That single detail is the clearest evidence that the IR was made to answer an embedded question: on the web a touch target is a CSS pixel guess, on a device it is millimeters of finger against a known panel.

The compile walks every block once:

- `type === "token"` becomes a `DeviceToken` with a **resolved literal** value (the code comment states the reason: devices have no CSS variable indirection), an `rgb` integer when the value parses as a six-digit hex, a `kind` derived from the id prefix, and the block's `version` and `contentHash` carried through.
- `type === "component"` becomes a `DeviceWidget` with a snake_case identifier safe for C and LVGL, a corner radius in pixels, the frame's `minTouchPx`, and again `version` and `contentHash`.
- `type === "guideline"` or `"agent-rule"` becomes zero or more `DeviceConstraint` entries, with severity `enforce` when the block id contains "dont" and `advise` otherwise.

The profile also carries an `invariants` array stating in plain text what the target promises: every interactive widget clears the physical touch minimum, colors are resolved from locked token blocks with no invented hex, block id and version and content hash are preserved verbatim, and governance don'ts compile to enforce-level constraints.

`deviceCompileLoss()` returns `{ carried, dropped }`, where each dropped block has a reason such as "prose page, no device equivalent." Measured loss rather than silent loss.

### `src/lib/ir/targets/c-header.ts` (Shipped)

`emitTokensHeader(graph)` produces a `tokens.h`. The file header carries the schema, the `docRef`, the `graphHash`, and a generation timestamp. Three sections follow: color tokens as `0xRRGGBB`, spacing tokens as integer pixels, and surface levels as `0xRRGGBB`. Every single define carries a trailing comment with `blockId@vN` and the content hash.

The comment at the top of the file states the purpose exactly right: the embedded engineer gets a token table traceable to block versions, not a screenshot or a PDF.

### `scripts/compile-device.ts`, `npm run compile:device` (Shipped)

Takes `--doc` and `--frame` flags, validates the frame against `DEVICE_FRAMES`, calls `ensureDocBlocks()` then `getOfficialGraph()`, and refuses to proceed if the document has no promoted blocks ("open the wiki and Finalize first"). That refusal is the two hop rule made executable: there is no device output without a promote.

It writes into `.blocksmith/targets/<docKey>/`:

```
device-<frame>.json    the device profile
tokens.h               the C header
tokens.css             Style Dictionary output
tokens.json            Style Dictionary output
```

and prints the graph hash, the promoted block count, the token and widget and constraint counts, and the semantic loss.

### `/demo/device` (Shipped)

`src/app/demo/device/page.tsx` is `force-dynamic`, resolves a document from `?doc=`, compiles **all three frames** plus the token header, and renders `DeviceSimDemo`. It catches compile failure and renders an empty state rather than erroring, which is the right call for a demo route. It is linked from the wiki at `src/components/wiki/pages/ReleasesPage.tsx` and from the investor demo at `src/components/demo/InvestorDemo.tsx`, so the device frame is reachable from the release console rather than being an orphan URL.

### `npm run verify:ir-cicd` (Shipped)

The device path is not merely built, it is asserted. The cross-platform compile section of `scripts/verify-ir-cicd.ts` checks that the device profile's `graphHash` equals the graph's content hash, that the accent color survives as `0xD97757` at official version 3 (a real end-to-end assertion that promote semantics survive the compile), that a governance rule compiled into a constraint, that every widget meets the minimum touch target, that semantic loss accounting is complete (carried plus dropped equals total blocks), and that `tokens.h` contains the traceable comment and the graph hash.

That verify script is the reason "Shipped" is the honest word for stages 1 and 2 rather than "Built, unproven."

### `public/schema/blocksmith.compile-targets.v1.json` (Shipped)

A published registry schema for compilers *out of* the IR. Every target must declare `input: "blocksmith.blocks.v1"` and an `officialOnly` boolean, described in the schema as the default and the rule: targets with `officialOnly` true must never read draft or conflict blocks. The device target's constraint is encoded in the protocol, not only in the implementation.

### What does not exist

No LVGL emitter. No RTOS or embedded Linux style pack. No dev board profile. No production HMI pipeline. No OTA anything: `grep -r "OTA" src scripts packages` returns nothing. `docs/00-thesis.md` lists Phase 3 (device profiles) as Planned, which is now slightly out of date in a favorable direction, since the simulator and the header emitter are shipped and verified. The accurate statement is: **stages 1 and 2 are Shipped, stages 3 through 5 have no code.**

## 2.5 Why the IR must stay portable now, even though hardware is later

This is the operational heart of Part 2, and the reason this chapter belongs in the book rather than in a roadmap document. Hardware is parked. **IR portability is not parked**, because portability is not something you add later. It is something you preserve or lose, one small decision at a time, in code that ships this week.

[Chapter 01](./01-origin-story.md) already makes the point: `scripts/compile-device.ts` exists in a Next.js repository as a deliberate early marker, planted so that the IR does not accidentally become web-only. That is the correct instinct and it needs teeth. A compile target that nobody runs decays. A compile target asserted by `verify:ir-cicd` on every run is a live tripwire, and that is what we have.

Here is the concrete failure mode, drawn from the current code. It is not hypothetical.

### Foreclosure 1: color representations that only a browser can resolve

`hexToRgbInt()` in `device-sim.ts` matches exactly one shape:

```ts
const m = hex.trim().match(/^#([0-9a-f]{6})$/i);
if (!m) return undefined;
```

Six-digit hex, nothing else. And in `c-header.ts` the consequence is a silent skip:

```ts
const rgb = hexToRgbInt(hex);
if (rgb === undefined) continue;
```

So the moment a token's value is written as `#fff`, `rgb(217 119 87)`, `hsl(...)`, `oklch(...)`, `color-mix(...)`, a gradient, or a `var(--other-token)` reference, that token **vanishes from `tokens.h` with no error and no warning**. The header is shorter and nobody notices. An embedded engineer builds firmware missing a color they were told exists.

This is the most likely way the hardware path gets quietly foreclosed, because modern CSS color functions are genuinely better for the web and there is real pressure to adopt them. The decision "let us store token values in `oklch` because it interpolates better" is a good web decision that silently amputates a compile target.

**The rule that follows:** the IR stores a device-resolvable color representation as the canonical value, and any browser-preferred representation is a derived form emitted by the web target. Not the other way around.

### Foreclosure 2: units the target cannot parse

`parsePx()` requires a literal `px`:

```ts
const m = value.match(/([\d.]+)\s*px/);
return m ? Math.round(Number(m[1])) : fallback;
```

Spacing tokens expressed in `rem` produce no match. In `c-header.ts` they are skipped entirely (`if (!px) continue`). In `device-sim.ts` a component radius falls back to the literal `8`.

Note the difference between those two outcomes, because it is instructive. The header **omits** the value, which is visible if you look. The device profile **substitutes a plausible wrong value**, which is not. A rem-based spacing scale compiles into a device profile where every corner radius is 8 pixels and the output looks entirely reasonable. Silent wrongness is worse than loud absence, and the device profile currently does the worse one.

`rem` is relative to a root font size, which is a browser concept. A microcontroller has no root font size, no user font preference, and no cascade to resolve one against. Any unit that is relative to something the device does not have is a unit the device cannot honor.

**The rule that follows:** token values that are meant to be portable carry an absolute unit, and relative units are a web-target concern. If the IR ever grows a typed value shape, `{ value: number, unit: "px" | "mm" | "pt" }` is the direction, not a bare string.

### Foreclosure 3: assuming a cascade exists

`device-sim.ts` resolves a token value as `content.value` and falls back to `content.cssVar`. That fallback is a small landmine: if a token's only value is a CSS variable name, the device profile carries the variable *name* as its value, and there is nothing on the device that can resolve it. The code comment is right that devices have no CSS variable indirection. The fallback quietly violates it.

The broader class of assumption is worth naming, because cascade thinking is invisible to web engineers:

- **Inheritance.** "Text color inherits from the surface" is meaningless where every widget's color is a literal in a struct.
- **Specificity and overrides.** "The dark theme overrides these six variables" assumes a resolution order that does not exist.
- **Media queries and breakpoints.** A 240 by 240 panel has one size, forever.
- **Font fallback stacks.** A font family list assumes a font matching system. An embedded target has whatever glyph data was compiled into the binary, and asking for a font that is not there yields nothing, not a fallback.
- **Layout engines.** There is no flexbox. `BlockType` in `src/lib/blocks/types.ts` is `page | token | component | guideline | agent-rule`, with no layout primitive at all, which is why `compileDeviceSim` emits widgets with styling and constraints but no positions. That is an honest current limitation and it should stay visible rather than being papered over with web layout assumptions.

**The rule that follows:** any governance rule or token whose meaning depends on a resolution mechanism should be expressible as a resolved literal at compile time. If it cannot be resolved without a browser, it is a web-target concern and it does not belong in the portable core.

### Foreclosure 4: untyped content that every target re-parses

`BlocksmithBlockV1.content` is `Record<string, unknown>`. That gave the schema room to grow, which was the right call early. The cost is that every compile target re-parses the same strings with its own regexes, and each target drops a different set of values.

The web target is forgiving because the browser is forgiving. The device target is strict because a `#define` must be a number. So the two targets disagree about what the design system contains, and nobody finds out until an embedded engineer asks why a color is missing.

**The rule that follows:** the moment a third serious target appears (LVGL is the likely candidate), the parsing must move **up** into the IR as typed token values, rather than being reimplemented a third time. Until then, `deviceCompileLoss()` is the early warning system, and its dropped count is a number somebody should actually look at.

### The cheap discipline that keeps the option open

None of this requires hardware work. It requires four habits, each of which costs approximately nothing today and is expensive to retrofit:

1. **Keep `npm run verify:ir-cicd` green**, including its device assertions. It is the tripwire.
2. **When adding a token kind or changing a value format, run `npm run compile:device` and look at the semantic loss line.** If the dropped count went up, you just foreclosed something.
3. **Prefer absolute, device-resolvable canonical values in the IR**, and treat browser-preferred formats as derived output.
4. **When a governance rule can only be expressed in terms of a cascade, write it down as a web-target rule** rather than letting it into the portable core unlabeled.

## 2.6 The honest risk, and how to talk about it

Here is the uncomfortable truth about this track, stated plainly because you will feel it in your first investor conversation:

**The hardware track is the most compelling part of the story to a certain kind of investor, and the least proven part of the product.**

The gap is real. "Design systems today stop at the browser, and we compile the same governed graph to a watch face and an industrial panel" is a genuinely differentiated sentence. It separates us from every design-system tool in the market in one line, and it lands especially well with anyone who has worked in automotive, industrial, or medical devices, because they have personally lived the PDF-to-embedded-team handoff and know how badly it fails.

And what stands behind that sentence today is: a React component that draws a watch-shaped circle in a browser, and a generated C header file. Both are real, both are verified, and neither has ever been near a physical device. [Chapter 03](./03-what-blocksmith-is.md) lists the honest version of this in its open questions: rung 3 is a simulator and a header emitter with no customer attached, and until one exists the hardware ladder is a roadmap slide.

### How to talk about it without overclaiming

**Lead with what is true and let it be smaller than they expected.** "Today the same promoted graph compiles to a browser device simulator and a C token header, and there is a verify script that asserts the accent color survives the trip at the right version. Everything past that is roadmap." Understating what you have is a cheap way to buy credibility for what you claim next. Overstating it costs you the whole conversation the moment someone asks a follow-up question.

**Use the permitted sentences and avoid the forbidden ones.** Permitted: "one design package, multiple compile targets", "one IR to web today, device profile tomorrow", "we claim semantic portability, not flash any `.md` to any chip on day one." Forbidden, and these are on an explicit list in `docs/PITCH-AND-PRODUCT-MODEL.md`: "plug any `.md` into any hardware", "same npm `import` on microcontrollers", "upload a `.md` and it runs on any hardware."

**Name the constraint that makes it coherent rather than opportunistic.** Every hardware milestone traces to `official` versions and lock pins, and field devices do not read draft wiki edits. That single sentence tells a technical listener that this is an extension of an existing architecture rather than a new company bolted on for narrative reasons. It is also the fastest way to demonstrate that the ladder has been thought about rather than dreamed about.

**Say what is missing before they ask.** No firmware. No dev board. No OTA. No hardware customer. Volunteering the gap is what makes the rest of the account trustworthy, and a serious investor will find the gap in one question anyway.

**Do not lead with it.** `docs/PITCH-AND-PRODUCT-MODEL.md` puts the device frame fourth in its hero demo priority order, behind design CI/CD, the handshake, and Pulse. That ordering is deliberate. The device frame is the sentence that makes someone remember the meeting, and it only works after they believe the software loop.

### The single cheapest demo that would make it credible

**Stage 3, in its minimal form: one commodity development board with a small LCD, running a fixed reference layout, whose colors, spacing, and corner radii come entirely from a generated `tokens.h`. Then, live, change a token in the wiki, click Promote, re-run `compile:device`, rebuild, flash, and show the physical screen change.**

Why this specific demo and not a larger one:

- **It closes the only gap that matters.** Everything today is software claiming things about hardware. This is the first artifact where a stranger sees an atom move because a human clicked a button in a browser. That transition, from claim to demonstration, cannot be produced by any amount of additional simulator work.
- **It reuses everything.** `compile:device` already emits the header. The remaining work is a reference application and a build, not new BlockSmith architecture.
- **It is cheap.** A board, a display, a toolchain, and a reference app. This is the sort of thing the founding team's background makes an ordinary task rather than a hire.
- **It is honest.** Nobody watching it will think we shipped an automotive pipeline. They will think the compile path is real, which is exactly the claim, and it is true.

Two things to be careful about if this gets built. Do not fake the promote step, because if the flash is pre-baked and the click is theater, that is worse than not doing the demo at all. And keep the reference application deliberately plain, because the moment you hand-tune the layout for the demo you are showing a designer's work rather than the compiler's.

Status of this proposal: **Idea.** It is not on any current sprint and this chapter is the first place it is written down.

---

# Part 3: The discipline that holds both tracks

Two tracks this large, both parked, create a standing temptation. Part 3 is the set of rules that keep the temptation from turning into drift.

## 3.1 The standing rule: one correct software loop first

From `docs/00-thesis.md`, in the section on current focus, stated as a rule and not as a preference:

> **Ship one correct software loop before hardware or new languages.**

The same document parks a specific list behind that rule: ingest-everything, social screenshots, Quartus and FPGA work, and public block feedback at scale. Note that the list already includes hardware-adjacent work (Quartus is FPGA tooling), so the rule has been applied to exactly this class of temptation before.

**Why the rule exists.** Three reasons, in increasing order of importance.

**First, credibility is sequential.** Nobody believes "the same graph compiles to a watch" from a team whose web loop is half-finished. The device claim borrows all its plausibility from the software loop being demonstrably correct. Build them in the wrong order and the hardware demo makes the software look like a distraction, rather than the software making the hardware look inevitable.

**Second, the IR is a hard ceiling.** [Chapter 01](./01-origin-story.md) records the output plane reckoning in late June 2026, and it is the single most useful lesson in this repository: code generation stamped a `<div>{children}</div>` for every component because the scan IR captured file paths, exports, CSS variables, and colors but never captured component structure. Faithful generation was **literally impossible** from the data available. The lesson generalizes: **the richness of your intermediate representation is a hard ceiling on the quality of everything downstream of it.** A hardware target built on an IR that has not yet been proven correct on the web inherits every one of the IR's defects and adds a firmware build cycle to the feedback loop, which turns a one-hour fix into a one-week fix.

**Third, and most concretely: what happens to companies that break it.** They ship two half-products. The web loop is not good enough for anyone to depend on, and the hardware path is a demo that cannot survive a real device. Both need continuous maintenance, so the team's capacity is now split against two moving targets and there is no revenue from either. Meanwhile the story to customers has become "we do design systems and also embedded", which reads as unfocused, so the sales motion gets slower at exactly the moment the burn got faster. `docs/CEO-DIRECTIVE.md` puts the same failure in organizational terms: a team that does not share a loop becomes many startups rather than one company.

The rule is not a statement that hardware is unimportant. `docs/CEO-DIRECTIVE.md` is explicit that hardware is "not a side quest." The rule is about **order**, and the directive's own sequencing table is the reconciliation: hardware appears under Stream C with "Pulse, device-sim, tokens.h" in the Now column and dev boards in Next. Parallel, but with Stream A as the spine.

## 3.2 The two hop rule, applied to both tracks

From `docs/TEAM-NORTH-STAR.md` and restated in `docs/CEO-DIRECTIVE.md`:

> Disconnected experiments do not ship. Everything connects to **promote then lock** within two hops. If your work does not connect to promote then lock within two hops, reframe it until it does.

"Two hops" means: your artifact is either produced directly from the promoted graph, or produced from something that is. An ingest adapter is one hop in (it feeds the graph that gets promoted). A compile target is one hop out (it reads the official graph). Anything that neither feeds the promote gate nor consumes its output is disconnected, and disconnected work is what turns one company into many.

Nothing is banned by this rule. **Disconnected work is banned.** The instruction is to reframe, and the reframing is usually available.

### Track two passes the rule today, structurally

The hardware track satisfies the rule and does so in code rather than in intention:

- `scripts/compile-device.ts` calls `getOfficialGraph(doc)`. One hop out of the promoted graph.
- It **refuses to run** when the document has no promoted blocks, printing a message telling you to open the wiki and Finalize first. The rule is enforced by the tool, not by discipline.
- `DeviceProfile.graphHash` carries the official graph's content hash, and `verify:ir-cicd` asserts they match. Any device artifact is traceable to the exact graph state that produced it.
- `public/schema/blocksmith.compile-targets.v1.json` requires every registered target to declare `officialOnly`, described in the schema as the rule: targets agents or devices consume must never read draft or conflict blocks.
- `docs/TEAM-NORTH-STAR.md`'s consumer table lists "Device sim / tokens.h" and "Embedded firmware" with "must use official only" marked yes.

This is why the hardware track can stay warm at nearly zero cost. It is already wired into the spine. Rungs 3 through 5 extend a connection that exists rather than creating a new one.

### Track one fails the rule today, and the failure is instructive

Split it into halves, because they get different answers.

**The read half passes.** Webpage to `design.md` to wiki to promote to lock is the exact shape of the existing capture pipeline: an ingest adapter, one hop in. It even inherits the draft marker and the never-auto-promote rule. If the DOM extractor were built tomorrow it would connect to the spine on day one.

**The write half fails.** "Apply a user's design system to a third-party page" has no promoted graph, no lock, and no promote gate anywhere in the loop. A per-user override of someone else's site is, as currently imagined, exactly the kind of disconnected experiment the rule exists to prevent. It would be a second product with a second truth model, built by the same team, competing for the same attention.

**The reframing that the rule demands.** The rule says reframe until it connects, so here is the reframe:

> The user's personal design system is a **promoted graph**, held exactly like a team's graph: versioned blocks, a draft-to-official lifecycle, an official pointer. The restyle extension is a **compile target** of that graph, one hop out, in the same position `device-sim` occupies. Applying a system to a page is a compile, not an edit. The page contributes structure (where to apply what), never bounds (what is legal).

Under that framing every existing invariant survives. The extension may only read official versions, precisely as `enforce.ts` requires of every agent. Changing your personal design system requires a promote, so an experiment on one site cannot silently change every site you have styled. The no-invented-tokens rule has a palette to check against, because the user's promoted graph *is* the palette. This is also exactly the constraint section 1.4 problem 5 arrived at from a completely different direction, which is a good sign that it is the right constraint.

**The finding, stated plainly:** the restyle track fails the two hop rule as currently described in the founder's notes, and passes it under a reframing that costs nothing to adopt now and would be expensive to retrofit later. Write the reframing down before anyone writes code.

## 3.3 The parking record

This is the durable artifact of this chapter. Its purpose is that in twelve months nobody has to reconstruct why these were parked, and nobody is surprised by what was quietly kept alive.

| Item | Status | Why parked | What would unpark it | What we do meanwhile |
|---|---|---|---|---|
| **Live DOM to Design IR extraction** | Idea | Phase 1 is not solid in the wild. The extraction semantics question (1.4, problem 5) is unresolved and is protocol-level. | Conditions 1 through 5 in section 1.8, all of them. Or a competitor shipping it credibly. | Keep `src/lib/visual/computed-metrics.ts` working, since it is the measurement primitive. Keep the capture draft lifecycle intact, since a DOM extractor inherits it. |
| **Restyle apply, arbitrary sites** | Idea | Depends on extraction. Fails the two hop rule as described. Needs broad host permissions, which is a real security and store-review escalation. | Extraction proven first, and the section 3.2 reframing ratified in Chapter 18. | Nothing. Do not prototype this. Write down the reframing so the option stays open. |
| **Per-user design system storage and sync** | Idea | The entire storage model is org-scoped today, on purpose. | A decision that the consumer track is active. | Nothing. Do not contort the org model to anticipate it. Premature generality here would damage the product that pays. |
| **Hardware stages 1 and 2** | **Shipped** | Not parked. Already built. | Not applicable. | Keep `verify:ir-cicd` green. Watch the semantic loss number. |
| **Hardware stage 3, dev board** | Idea | No customer, and the software loop comes first. It is the cheapest credible demo (section 2.6) but it is still a demo. | An investor conversation where the simulator is provably not enough, or a design partner asking for it. | Keep the IR portable (section 2.5). That is the whole maintenance cost. |
| **Hardware stages 4 and 5, HMI and OTA** | Planned on the roadmap, Idea in design | Requires a design partner more than it requires code. Enormous cost, and rollback becomes a fleet operation. | A named OEM or industrial design partner. | Keep the invariant that every artifact traces to official versions and lock pins. Keep saying "roadmap" out loud. |
| **Committing `extension/` and `figma-plugin/` to git** | Not parked, just undone | No reason. It appears to be an oversight. | Nothing. Do it. | See section 1.6. Both are untracked and exist on one machine. |

### What "keeping the option open at near zero cost" actually means

Three things, and only three. Everything else is either doing the work or pretending to.

**One: keep the tripwire green.** `npm run verify:ir-cicd` asserts the device compile end to end. As long as it runs and passes, the hardware option cannot silently close. This is roughly the entire maintenance cost of track two, and it is measured in seconds per CI run.

**Two: write down the reframings and the constraints before they are needed.** The three that matter are the section 3.2 reframing (a personal design system is a promoted graph, the extension is a compile target), the section 1.4 problem 5 constraint (bounds come from the user's system, the page only contributes structure), and the section 2.5 rules (device-resolvable canonical values, absolute units, no cascade assumptions in the portable core). All three are free to adopt today and expensive to retrofit. Writing them down is the work.

**Three: refuse to prototype.** A half-built restyle prototype is worse than nothing. It consumes attention, it creates a second truth model that someone will later have to unpick, and worst of all it leaks into pitches, because a demo that exists is a demo that gets shown. The correct state for both tracks is: fully documented, fully unbuilt.

---

## Open questions

1. **Should the Figma track and the restyle track share extraction code, and where is the boundary?** Both solve "extract an IR from something that was not written for us." [Chapter 03](./03-what-blocksmith-is.md) raises this and nobody has designed the shared boundary. If a shared extraction layer is right, it should be discovered on the Figma track first, where there is a paying reason to build it.
2. **How long should the restyle track stay parked before the parking itself becomes the risk?** [Chapter 01](./01-origin-story.md) flags this directly: it is the north star and it is untouched, and there is a real risk it stays parked until someone else builds it. There is no review date on record. There should be one.
3. **Is a personal design system actually a promoted graph, or does the promote gate make no sense for an audience of one?** Section 3.2 assumes it works. The promote gate exists to separate a proposer from an approver, and when those are the same person the ceremony may be pure friction. Untested.
4. **What is the first hardware customer, and does one exist at all?** Stages 1 and 2 are shipped with nobody attached. Until a customer exists the ladder is a slide, and it should be presented as one.
5. **Which unresolved IR decisions are already quietly foreclosing the hardware path?** Section 2.5 names four candidates from reading the code. Nobody has audited the full token set for device-resolvability, and `deviceCompileLoss()` gives us the number for free but nobody is watching it over time.
6. **Does the extension need a content script at all, or can screenshot plus vision get far enough?** The existing capture extension avoids every permission problem by never touching the page. A vision-only "restyle" that renders a replacement view rather than modifying the original is a genuinely different architecture with a much smaller permission ask, and it has never been evaluated against the DOM approach.
7. **What is the legal position on modifying third-party sites at scale?** Userstyle extensions have existed for decades and the ground appears settled for user-side modification. "Appears settled" is not a legal opinion, and nobody has obtained one. This should be answered before, not after, any prototype exists.
8. **Should stage 3 be built purely as a fundraising artifact?** Section 2.6 argues it is the cheapest thing that converts a skeptic. It is also, strictly, not on the critical path for any customer we currently have. That tension is unresolved, and the honest framing is that it is a marketing expense with an engineering shape.

---

## Where to look in the code

| Concept in this chapter | Path | Notes |
|---|---|---|
| Founder's own north star note | `~/.claude/projects/-Users-koshish-BlockSmith/memory/north-star-vision.md` | Primary source for both tracks |
| Founder's extension note | `~/.claude/projects/-Users-koshish-BlockSmith/memory/extension-restyle-web.md` | Primary source for the webpage-to-`design.md` feature and the ICP rule |
| The existing capture extension | `extension/` (`manifest.json`, `background.js`, `popup.html`, `popup.js`, `README.md`) | Screenshot only, no content script. **Untracked in git.** |
| Capture ingest, server side | `src/lib/ingest/capture.ts`, `src/app/api/ingest/capture/route.ts` | Vision extraction, draft marker, never auto-promotes |
| Capture truth model | `docs/DESIGN-FIRST-INGEST.md` | Phase 1 shipped, tiered source confidence |
| Thin client surface pattern | `figma-plugin/` (`manifest.json`, `code.js`, `ui.html`, `README.md`) | The house style for client surfaces. **Also untracked in git.** |
| Live computed style reading | `src/lib/visual/computed-metrics.ts` | `readBoxModel()`, `readComputedSnapshot()`. Closest analog to DOM extraction. |
| Deterministic preview resolution | `src/lib/visualize/preview-tokens.ts`, `src/lib/design-ir/semantic-resolve.ts` | Preview values read only from compiled IR |
| AI refinement merged under a guardrail | `src/lib/design-ir/merge-ai-chrome.ts` | Ends at `enforceChromeLegibility()` |
| Legibility guardrails | `src/lib/design-ir/color-utils.ts` | `contrastRatio()`, `ensureReadable()`, `legibleMuted()`, `enforceChromeLegibility()` |
| No-invented-tokens guardrail | `src/lib/governance/color-lint.ts` | `paletteFromColors()`, `findOffTokenColors()`, `nearestToken()` |
| Where those guardrails are enforced | `src/mcp/handlers.ts`, `src/lib/governance/check-diff.ts`, `src/lib/ai/governed-generate.ts` | One rule, three enforcement points |
| Device compile target | `src/lib/ir/targets/device-sim.ts` | Frames, touch math, `compileDeviceSim()`, `deviceCompileLoss()` |
| C token header emitter | `src/lib/ir/targets/c-header.ts` | `emitTokensHeader()`, traceable defines |
| Device compile script | `scripts/compile-device.ts`, `npm run compile:device` | Refuses to run without promoted blocks |
| Device simulator route | `src/app/demo/device/page.tsx`, `src/components/demo/DeviceSimDemo.tsx` | Linked from `ReleasesPage.tsx` and `InvestorDemo.tsx` |
| Device assertions | `scripts/verify-ir-cicd.ts`, `npm run verify:ir-cicd` | Cross-platform compile section |
| Compile target registry schema | `public/schema/blocksmith.compile-targets.v1.json` | `officialOnly` is the rule |
| Block and graph types | `src/lib/ir/types.ts`, `src/lib/blocks/types.ts` | `content` is untyped, `BlockType` has no layout primitive |
| Agent enforcement | `src/lib/ir/enforce.ts` | Official only, the rule a restyle target would inherit |
| The one-loop-first rule | `docs/00-thesis.md` | Phase table and the paused list |
| Software versus hardware framing | `docs/PITCH-AND-PRODUCT-MODEL.md` | The table, the pitch line, the overclaim list |
| Hardware ladder, streams C and E | `docs/CEO-DIRECTIVE.md`, `docs/TEAM-NORTH-STAR.md` | Five rungs, the two hop rule, stream assignments |

Related chapters: [Chapter 01](./01-origin-story.md) for where the north star came from, [Chapter 03](./03-what-blocksmith-is.md) sections 7 and 8 for the two-track separation and the rung ladder, [Chapter 12](./12-codegen-pulse-and-compile-targets.md) for the output plane the device targets belong to, [Chapter 13](./13-the-ai-layer.md) for the deterministic-composition-with-validated-AI engine, and [Chapter 18](./18-decisions-and-tradeoffs.md) for where the decisions proposed here must be ratified.
