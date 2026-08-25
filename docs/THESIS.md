# Thesis — why this control point doesn't exist yet

Grounded in a prior-art review. Sources are marked `[read]` (fetched and read),
`[search]` (from search summaries — verify before external publication), or
`[inference]` (our reasoning, not from a source). Unverifiable claims are listed
at the bottom and must not be cited.

---

## The claim

LLM agents cannot reliably self-correct from prompted instructions, but do
correct reliably when given verifiable external feedback that names the violated
constraint **and supplies an admissible alternative**. Design systems are
precisely the class of constraint where prompt-level guidance is weakest. Every
deployed enforcement mechanism runs at build time, on the consumer's side of the
boundary, checking values rather than intent. Every agent-facing web policy
surface is static advisory text that never sees what the agent produced.

BlockSmith makes the design-system publisher's own page the enforcement surface:
a WebMCP tool that receives an agent's proposed UI, rejects it with the specific
violated rule and the compliant fix, and updates its own rule surface live as the
underlying governance changes.

**The novelty is the locus, not the mechanism.** Reject-and-repair is published
prior art. Governance authored by the party that owns the resource, evaluated
against the agent's *output* rather than its *request*, is the control point
neither the linting ecosystem nor the agentic-web stack provides.

---

## What the evidence supports

**External feedback works; intrinsic self-correction doesn't.**
Huang et al., *LLMs Cannot Self-Correct Reasoning Yet*, ICLR 2024
(arXiv:2310.01798) `[read]` — improvements in prior work "vanish when oracle
labels are not available"; but "when valid external feedback is available, it is
beneficial to leverage it." Kamoi et al., TACL 2024 (arXiv:2406.01297) `[read]` —
"self-correction works well in tasks that can use reliable external feedback."

**The fix matters more than the rejection.**
Ray & Goyal, *Structured Feedback Improves Repair in an LLM Agent Loop*
(arXiv:2607.14167) `[read]` — Qwen2.5-Coder-14B went 14/50 → 36/50 when feedback
carried failure location, observed value, **and admissible alternatives**.
Ablation: *the admissible-alternatives field drove nearly all the gain; location
and value alone stayed near baseline.*

> This is direct empirical support for our exact output shape. "`#e0e0e0` is not
> a design token. Use `Rule` (#e2e4ea) instead" is the version that works;
> "REJECTED" alone is the version that doesn't.

**Prompt-level style guides fail exactly where design systems live.**
Tang, *Compact Constraint Encoding for LLM Code Generation* (arXiv:2604.07192)
`[read]` — 11 models, 830+ invocations: "counter-intuitive constraints opposing
model defaults fail at 10–100%, while conventional constraints achieve 99%+
compliance regardless of encoding." Also: "model self-assessments systematically
overestimate compliance relative to rule-based scoring." A design system is by
construction counter-default.

**Deterministic gates help frontier models, not just weak ones.**
Reddy et al. (arXiv:2607.07405) `[read]` — read-only pre-execution gates on
τ²-bench airline: GPT-4o-mini 29.6% → 42.0% (p=0.0012); **GPT-5.2 61.2% → 71.6%**
(p=0.020).

**The category leader declines to enforce.**
Figma, *Design Systems And AI: Why MCP Servers Are The Unlock* `[read]` — their
Dev Mode MCP server "provides context only — **it does not validate or enforce
compliance**." Its strongest capabilities are advisory.

**The socket exists and nobody has plugged governance into it.**
Chrome Labs' `webmcp-tools` ships 15+ demos; the community catalog adds more.
Flight search, reservations, cart, drawing, games. **Every one is an action tool.
Zero are governance, policy, or validation.** `[read]`

**Every agent-facing web policy surface stops at the request boundary.**
llms.txt (no "disallow", "permission", or "policy" anywhere in the spec),
AGENTS.md, robots.txt, IETF `aipref` (charter lists *"technical enforcement of
preferences"* as **out of scope**), Cloudflare Content Signals ("preferences;
they are not technical countermeasures"). None sees the agent's output. None
returns a corrected artifact.

---

## Where a critic pushes hardest

**1. The mechanism is prior art.** Builder.io already published "make it a lint
error and put the linter in the agent's loop." AgentSpec (ICSE 2026,
arXiv:2503.18666) published `llm_self_examine` — inform the LLM of the violation,
prompt it to revise. MCP already specifies actionable tool errors for
self-correction. **Lead with locus and timing or be trivially anticipated.**

**2. A registry may beat a rule engine.** Cha et al., CHI 2026 EA
(DOI 10.1145/3772363.3798616) `[search — ACM DL 403'd, figure unverified]` found
registry-based assembly reached 95.08% compliance, beating instruction-based and
context-based strategies. The critique writes itself: *why negotiate over output
when you could constrain the option space up front?* Our capability negotiation
is partly this — but we should measure the difference, not assert it.

**3. WebMCP may not carry the weight.** `executeTool` returns a bare
`Promise<DOMString>`. **No `isError`. No `outputSchema`.** Whether the browser
validates at all is open issue #92, *"Who owns the validation layer?"*, unresolved.
**WebKit's formal position is `oppose`**, proposing the proposal be shelved
pending a TPAC 2026 workshop; Mozilla is neutral. Production adoption is ~zero.
*If reject-and-correct has to be smuggled through a free-text return value, why
not ship an ordinary MCP server that already has `isError`?* — this is the
hardest question and we do not have a strong answer yet.

**4. We are not fixing homogeneity — we are choosing whose wins.** Constraints
reduce output diversity (Kirk et al., arXiv:2310.06452 `[read]`: "RLHF
significantly reduces output diversity"; Yun et al., arXiv:2505.18949 `[read]`).
Successfully enforcing a design system makes output *more* uniform. That is the
right thing for a design-system team and an honest thing to say. **Pitching this
as a cure for AI slop will be caught immediately by any design-literate reviewer.**

**5. No benchmark exists to prove it.** Every UI-codegen benchmark — Design2Code
(NAACL 2025), Web2Code (NeurIPS 2024), Interaction2Code (ASE 2025), UI-Bench —
measures *resemblance to a reference* or human aesthetic preference. **None
measures token adherence.** And no controlled study anywhere runs "prompt
instruction" vs "rejecting validator" on style constraints in one experiment. We
cite a cluster, or we run it ourselves and get discounted for self-built evals.

**6. Convergence and cost are unaddressed.** Tang's finding cuts both ways: rules
opposing model defaults may need many rejection rounds or never converge. Ray &
Goyal's gains came inside a 4-call budget on TextWorld; nobody has shown it holds
for open-ended visual composition.

**7. "Human watching the page" is asserted, not evidenced.** The HCI literature
cuts the other way — automation bias means fluent output gets rubber-stamped.

**8. Self-updating is thinner than it sounds.** `toolchange` broadcasts *that*
something changed — no diff, no reason, and it is `SHOULD` not `MUST`. Pure cache
invalidation. The hard part, deriving current rules from current truth, gets no
help from the platform. Broadcasting the change is the easy 5%.

**9. Discoverability chicken-and-egg.** Chrome's own docs: *"Clients and browsers
must visit a site directly to know if it has callable tools."* An agent
generating UI in an IDE or a v0-style tool is not on our page. We need a story.

---

## The honest state of the academic ground

There is **no serious academic literature on design-system compliance
measurement.** The design-systems SE literature is sparse (Lamine & Cheng, *EmpSE*
2022 — paywalled, findings unread; Richter et al., CHI '25 EA — proposes inner
source, *no enforcement mechanism*). The "design smells" literature is about code
structure and rendering defects, not house-rule conformance. Computational
aesthetics (AIM, UIClip) measures universal quality, orthogonal to house rules.

The strongest evidence the problem is real is industry data: the **zeroheight
Design Systems Report 2026** (147 practitioners) `[read]` — **44% call their
design system unstable or very unstable**, only 8% "very stable"; **60% have no
token automation at all**; only 7% report full adoption; **61% are worried about
AI design generation**.

**The absence of prior academic work is itself part of the argument.** Say so
plainly rather than padding a related-work section.

---

## Do not cite without verifying

- Cha et al. CHI 2026 — the 95.08% figure came from search summaries, not the paper
- Lamine & Cheng 2022 — abstract and findings never read (Springer paywall)
- Huang et al. numeric table — from the ar5iv render, not the PDF
- WebCode2M / arXiv:2404.06369 — ID was originally titled "VISION2UI"
- "Flame-React-Eval" — not a standalone paper; a benchmark inside arXiv:2503.01619
- WebDev Arena / Design Arena vote counts — no peer-reviewed methodology
- Adobe Spectrum "~70% adoption" — practitioner interview, not measurement
- Named WebMCP enterprise adopters (Expedia, Shopify, Target) — unconfirmed
- Claims that Anthropic confirmed Claude respects llms.txt — likely false
