# The Output Plane: Pulse, Code Generation, And Compile Targets

**What this chapter covers.** Everything BlockSmith emits. The Pulse code generator (`src/lib/codegen/pulse.ts`), the structural component IR that makes faithful generation possible (`src/lib/scan/component-interface.ts`), the generated npm package (`@blocksmith/<product>`), the shared runtime primitives (`packages/pulse-runtime/`), the embedded compile targets (`device-sim.v1` profiles and `tokens.h`), the Pretext layout spin-off, and the separate `font-generator/` app that generates real downloadable typefaces.

**Why it matters.** BlockSmith has two halves. One half decides what the truth is: scan, wiki, registry, versions, lock, promote, governance. That is the control plane, and it is genuinely strong. The other half turns that truth into artifacts a machine can consume: a React package, a C header, a device profile, a font file. That is the output plane, and until mid 2026 it was mostly theatre. This chapter is the honest account of how it got fixed, how far it got, and where it still falls short.

**Read this if** you are about to touch codegen, add a compile target, change the scanner's component extraction, wire the generated package into a customer repo, or work on `font-generator/`. Also read it if someone asks you "so what does the customer actually get?" and you want an answer that survives a follow-up question.

Related reading: the Design IR chapter ([Chapter 07](./07-design-ir-and-blocks.md)) explains blocks, versions, promote and lock, which the compile targets in section 8 consume. The style contract for this book is [STYLE.md](./STYLE.md).

---

## 1. The output plane problem

### 1.1 The two planes

Somewhere around June 2026 the founder ran a CTO style deep dive on what was then called "the frontend pipeline", and the finding was that it was not one pipeline. It was two planes with very different maturity levels.

| Plane | What it does | Where it lives | Verdict at the time |
|-------|--------------|----------------|---------------------|
| **Control plane** | Scan a repo, build a block graph, version it, lock it, promote it, enforce it through MCP, detect drift | `src/lib/ir/`, `src/lib/scan/`, `src/lib/mcp/` | Real. Covered by verify scripts. Defensible. |
| **Output plane** | Turn that truth into something an engineer or an agent imports and runs | `src/lib/codegen/`, `packages/` | Thin. Mostly stubs. |

The control plane was doing what the pitch said. The output plane was not.

### 1.2 What the generator actually emitted

Here is the code that shipped before the fix. This is `stubComponent()` from the pre-fix version of `src/lib/codegen/pulse.ts` (commit `a5d0c1e`):

```ts
function stubComponent(comp: ComponentDoc): string {
  if (comp.title === "Button") return buttonComponent(comp);
  return `/** Auto-generated stub for ${comp.title} (expand in later pulse versions) */
import type { ReactNode, CSSProperties } from "react";

export type ${comp.title}Props = { children?: ReactNode; style?: CSSProperties };

export function ${comp.title}({ children, style }: ${comp.title}Props) {
  return (
    <div data-blocksmith-component="${comp.id}" style={{ padding: "var(--acme-space-4, 8px)", ...style }}>
      {children ?? "${comp.title}"}
    </div>
  );
}
`;
}
```

Read that carefully, because the shape of the failure matters.

There is exactly one special case: `Button`. `buttonComponent()` was a hand-written template with a `variant?: "primary" | "secondary"` union baked into the generator source, not derived from anything. It looked like faithful codegen in the demo, because the demo showed a Button. Every other component in the customer's design system, no matter what it really was, came out as a `<div>` that rendered `{children}` or, failing that, its own title as a string literal.

So a scanned `Card` with a required `title: string` prop and a `<section>` root became a div. A scanned `Input` that renders an `<input>` became a div. A `Badge` with a `label: string` prop became a div that printed the word "Badge".

The demo route `/demo/pulse` was honest about none of this, because it only imported `Surface`, `Text` and `Button`.

### 1.3 The root cause, precisely

The generator was not lazy. It was starved.

The scan pipeline's per-component metadata type, `ComponentScanMeta` in `src/lib/blocks/types.ts`, looked like this before the fix:

```ts
export interface ComponentScanMeta {
  sourceFile: string;
  exports: string[];
  cssVarsUsed: string[];
  colorsUsed: string[];
}
```

Four fields. A path, a list of exported identifier names, a list of CSS custom properties referenced anywhere in the file, and a list of hex colors found by regex.

Now ask what a code generator could possibly do with that. It knows a component named `Card` exists at `src/components/ui/Card.tsx`, that it exports the symbol `Card`, and that the file mentions `--acme-surface-1` somewhere. It does not know:

- what props `Card` takes
- whether any of them are required
- whether any of them are string-literal unions (variants)
- what the defaults are
- whether it renders `children`
- what HTML element it renders at the root
- what it looks like in any structural sense at all

Given that input, `<div>{children}</div>` is the *correct* output. There is no smarter generator that could have done better. The generator was as good as its input allowed, and its input was four strings.

### 1.4 The lesson

Write this one on the wall:

> **The richness of the IR sets a hard ceiling on the quality of every compile target downstream. You cannot generate what you did not capture.**

This is the single most transferable lesson in this chapter. Any time you are tempted to improve an emitter, first check whether the emitter is starved. If the IR does not carry the fact you want to emit, no amount of emitter cleverness recovers it. You go back and enrich the scan.

It also cuts the other way, which is the good news: enrich the IR once, and every target improves at once. The structural interface added for Pulse is available to the wiki, to governance checks, to the Figma drift comparison, and to any future compile target, for free.

---

## 2. Three directions that were on the table

Once the finding was clear, there were three honest ways forward. All three were viable products. This section records them because you will meet this fork again, on some other capability, and the reasoning transfers.

### Direction A: reposition the control plane as the product

Admit that codegen is a demo, delete or freeze it, and sell what actually works: scan, wiki, governance, lock, promote, drift detection, MCP enforcement. "We are the design system control plane. We do not write your components, we govern them."

**In favour.** It is true today. Nothing needs to be built. The verify suite already proves it. It is a coherent category (design CI/CD) with a real moat in the governance and drift story. It removes the risk of a customer importing `@blocksmith/acme-ui-kit` and finding a bag of divs.

**Against.** The "one design package, multiple compile targets" pitch line in `docs/PITCH-AND-PRODUCT-MODEL.md` dies. So does phase 3 in `docs/00-thesis.md`, because if we never compile to React we will certainly never compile to a watch. Every artifact in the funnel would end at markdown, and markdown is not a product a platform team pays for on its own. It also concedes the most defensible long-term position, which is being the thing between design truth and every runtime.

### Direction B: make codegen real with a richer scan IR

Enrich the scan to capture component structure, then rewrite the emitter to use it.

**In favour.** It is the only direction that makes the existing pitch true rather than replacing it. It is bounded work: a syntactic extractor plus an emit strategy. It improves the whole system, not just codegen, because a structural IR feeds wiki previews, drift comparison, and governance. It preserves phase 3.

**Against.** It is real work, and it is the kind of work that never fully finishes. TypeScript and React have an enormous surface: `forwardRef`, `memo`, HOCs, generic props, imported prop types from other files, `cva` and `tailwind-variants` style variant helpers, compound components, context. A syntactic extractor will always be a best effort. You are signing up for a permanent tail of "this shape does not extract" bugs, and you are signing up for a faithfulness guard in CI forever, because the failure mode is silent: it degrades to stubs instead of erroring.

### Direction C: governed wrappers

Do not generate the component. Generate a thin governed wrapper around the customer's own component, so their `Button` stays theirs, and BlockSmith's package only enforces tokens and constraints on top of it.

**In favour.** Zero faithfulness risk, because the real implementation is still the customer's. It is philosophically clean: BlockSmith governs, it does not author. It sidesteps the entire extraction problem.

**Against.** It only works when the customer's package is importable in the first place, which means the customer already publishes a component library, which means they already solved the hard part and BlockSmith is a lint rule. It does nothing for the device story, because a wrapper around a React component does not compile to a watch face. And it does nothing for the agent story either, because the agent could just import the customer's component directly.

### The choice

**Direction B was chosen.** The deciding argument was phase 3. Directions A and C both terminate at the browser. Only B produces a structural description of a component that can, in principle, be re-emitted for a different runtime. If you believe the long-term company is "one design truth, many compile targets", then you must own the structural IR, and owning the structural IR is exactly what B means.

**What B costs us, stated plainly:**

1. A permanent maintenance tail on the extractor as new React idioms appear.
2. A CI guard that must be kept honest, because the degradation mode is silent.
3. Carrying verbatim source through the markdown wire format, which makes scan documents larger and slightly weird to read in raw form.
4. A generated package whose quality varies per component, which is harder to explain to a customer than a uniform promise.
5. The lingering risk that "we generate your components" gets heard as "we replace your components", which is not the claim.

---

## 3. What shipped: the ComponentInterface extractor

The whole of direction B rests on one file: **`src/lib/scan/component-interface.ts`** (363 lines). It parses a single TSX or JSX source file and returns a `ComponentInterface`, or `null` if it cannot find a component.

### 3.1 The shape it produces

```ts
export interface PropSpec {
  name: string;
  /** Raw type text, e.g. `ReactNode` or `"primary" | "secondary"`. */
  type: string;
  optional: boolean;
  /** Default from the destructuring pattern (e.g. `variant = "primary"`). */
  default?: string;
  /** String-literal union members: the component's variants. */
  variants?: string[];
}

export interface ComponentInterface {
  name: string;
  props: PropSpec[];
  /** Non-literal props constituents, e.g. `ButtonHTMLAttributes<HTMLButtonElement>`. */
  extendsTypes: string[];
  hasChildren: boolean;
  propsTypeName?: string;
  /** Best effort: the JSX host element the component renders. */
  rootElement?: string;
}
```

Six things, and each of them is something the old four-field metadata could not express: the prop list with types and optionality, the variant unions, the destructured defaults, the external types the props intersect with, whether the component takes children, and which HTML element sits at the root.

### 3.2 Why the syntactic API, with no type checker

The extractor calls exactly one TypeScript entry point:

```ts
sf = ts.createSourceFile(
  fileName,
  source,
  ts.ScriptTarget.Latest,
  /* setParentNodes */ true,
  ts.ScriptKind.TSX,
);
```

That is `ts.createSourceFile`, not `ts.createProgram`. No `LanguageService`, no `TypeChecker`, no `ModuleResolutionHost`, no `tsconfig.json` lookup, no `node_modules` walk.

This was the right call, for four reasons that are all consequences of where the scanner runs:

1. **The scanner reads other people's repositories, and often not from disk.** GitHub scans (`src/lib/scan/github.ts`) pull file contents over the API. There is no installed dependency tree to resolve against. A type checker would immediately fail to resolve `import type { ReactNode } from "react"` and would produce a degraded or erroring result on a repo that is perfectly fine.
2. **Speed.** `createSourceFile` on one file is microseconds. Creating a program means resolving the transitive import graph of a real application, which is seconds to minutes and allocates hundreds of megabytes. The scanner walks hundreds of files.
3. **Determinism.** A syntactic parse of a given string always yields the same tree. A type-checked parse yields different results depending on which version of `@types/react` happens to be installed in the scanned repo, whether `strict` is on, and whether the repo even installs. Scan output feeds content hashes and block versions, so nondeterminism there would produce phantom version bumps.
4. **It degrades gracefully.** Unresolvable types are simply recorded as raw text in `extendsTypes`. `ButtonHTMLAttributes<HTMLButtonElement>` is captured as the literal string `"ButtonHTMLAttributes<HTMLButtonElement>"`, which turns out to be exactly what the emitter needs, because the emitter is going to paste it back into a generated `.tsx` file and let the customer's own TypeScript resolve it there.

The tradeoff you accept is that anything requiring cross-file resolution is out of reach. If `ButtonProps` is declared in `./types.ts` and imported, the extractor cannot follow it, and the type lands in `extendsTypes` as an unresolvable external. That is a known and accepted limitation.

### 3.3 How it finds the component

`findComponentFn(sf, wanted)` scans the top level of the file and collects candidates from three syntactic shapes:

- `ts.isFunctionDeclaration` gives `export function Button(...)`. It also handles the anonymous `export default function () {}` case by falling back to the `wanted` name passed in by the caller.
- `ts.isVariableStatement` gives `const X = <initializer>`, and each declaration is passed through `resolveInitializer`.
- `ts.isExportAssignment` gives `export default <expression>`, again resolved through `resolveInitializer`.

`resolveInitializer` is where the HOC handling lives. It unwraps arrow functions and function expressions directly, and for call expressions it strips any `React.` prefix and recognises `forwardRef` and `memo`. The type-argument positions differ between the two, which the code handles explicitly:

```ts
// forwardRef<Ref, Props> means props is arg 1; memo<Props> means arg 0.
const propsTypeNode =
  callee === "forwardRef"
    ? ta && ta.length >= 2 ? ta[1] : undefined
    : ta && ta.length >= 1 ? ta[0] : undefined;
```

It recurses, so `memo(forwardRef(...))` works. Selection prefers the candidate whose name matches `wanted` (the title the scanner already assigned to the component), then the first uppercase-named candidate, then the first candidate at all.

### 3.4 How it resolves props

`indexLocalTypes(sf)` first builds a map of every top-level `type` alias and `interface` declaration in the file. Then `resolvePropsType` walks the props type node with four cases:

- **Interface declaration.** Collect its `PropertySignature` members, then follow each `heritageClauses` entry. If the base type is a *local* interface it recurses into it and merges the members. If it is not local it is pushed to `extendsTypes` as raw text. A `seen` set prevents cycles.
- **Type literal.** `{ title: string; children: ReactNode }`. Collect members directly.
- **Intersection.** `A & B & { ... }`. Visit each constituent.
- **Type reference.** If it names a local type, recurse. Otherwise record it in `extendsTypes`.

That heritage-following behaviour is what lets `interface PanelProps extends BaseProps` where `interface BaseProps extends HTMLAttributes<HTMLDivElement> { title: string }` produce a flat prop list containing `title` *and* an `extendsTypes` entry for `HTMLAttributes<HTMLDivElement>`.

Then three small helpers do the rest:

- `literalUnion(typeNode)` returns the members of a union only when *every* member is a string literal. `"primary" | "secondary"` gives `["primary", "secondary"]`. `"primary" | number` gives `undefined`. That strictness is deliberate: a partial union is worse than none, because it would misreport the variant set.
- `destructuredDefaults(param)` reads the object binding pattern of the first parameter and pulls initializers, so `{ variant = "primary" }` records `variant -> "primary"` as raw source text, quotes included.
- `findRootElement(fn)` walks the function body for the first JSX opening or self-closing element whose tag starts with a lowercase letter, which is the JSX convention for a host element. `<button>` gives `"button"`, `<Wrapper>` is skipped because a capitalised tag is another component, not a DOM node.

Finally `children` is detected two ways: as a named member of the props type, or, if absent there, as an identifier in the destructuring pattern. That second path catches components whose props type is entirely external, such as a component typed only as `HTMLAttributes<HTMLDivElement>` that still destructures `{ children }`.

### 3.5 The guard: `verify:component-interface`

`scripts/verify-component-interface.ts` (139 lines) runs five hand-written cases through the extractor. It is a pure unit check with no I/O, run by `npm run verify:component-interface` and included in `npm run verify:software`.

| Case | Shape under test | What it asserts |
|------|------------------|-----------------|
| type alias plus literal union plus default | `type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children; variant? }` | `hasChildren`, `rootElement === "button"`, the HTML attrs extend is captured, `variant.variants === ["primary","secondary"]`, `variant.default === '"primary"'` |
| `FC<Props>` plus interface extends chain | `interface PanelProps extends BaseProps` where `BaseProps extends HTMLAttributes<HTMLDivElement>` | `title` survives the two-hop heritage walk, `collapsed` survives, `HTMLAttributes` reaches `extendsTypes`, `tone` yields 3 variants, children detected |
| `forwardRef<Ref, Props>` | `forwardRef<HTMLInputElement, FieldProps>(function Field(...))` | `size` yields 3 variants, `InputHTMLAttributes` captured, `rootElement === "input"` |
| `memo(arrow)` | `memo(({ label, color = "gray" }: TagProps) => ...)` | `label` present, `color` variants present |
| default export function | `export default function Hero(...)` | name resolves to `Hero` from the `wanted` hint, `headline` present, `cta` default is `"Get started"`, children detected |

The file's own header comment states the stakes: if extraction regresses, "the generator falls back to stubs and the 'pull a real UI kit' promise breaks."

---

## 4. The three-tier emit strategy

With a structural IR available, `emitComponent()` in `src/lib/codegen/pulse.ts` picks the most faithful path it can, in order:

```ts
function emitComponent(comp: ComponentDoc): string {
  return (
    sourceComponent(comp) ??
    (comp.scan?.interface ? synthesizedComponent(comp) : genericStub(comp))
  );
}
```

Three tiers, tried highest first.

### Tier 1: verbatim source

`sourceComponent(comp)` re-emits the scanned file's text unchanged, with a one-line generated header prepended. It is **faithful by construction**: the customer's component is literally their component, byte for byte in the body.

It fires only when both conditions hold:

1. `comp.scan.source` exists (see section 5 for when the scanner carries it).
2. The source exports the component *by name*, tested by two regexes:

```ts
const named =
  new RegExp(`export\\s+(?:async\\s+)?function\\s+${comp.title}\\b`).test(src) ||
  new RegExp(`export\\s+const\\s+${comp.title}\\b`).test(src);
```

The name gate exists because `src/index.ts` is generated with `export { Title } from "./components/Title.js";`. If the emitted file does not actually export that identifier, the package will not compile. So tier 1 refuses rather than producing a broken package.

Two consequences worth knowing before you debug a surprise:

- **`export default function Hero()` does not qualify for tier 1.** The regex requires `export` immediately followed by `function`, and `default` sits between them. Such a component falls through to tier 2. This is conservative rather than wrong, but it is a real gap and an easy future improvement.
- **Tier 1 does not rewrite imports.** The source is emitted as-is. If the customer's `Card.tsx` imports a local helper such as `import { cn } from "../lib/utils"`, that import goes into the generated package unchanged and the package will not build, because the helper is not there. The vendor fixture components happen to be self-contained (they import only from `react`), which is why this has not bitten yet. It will bite on a real customer repo. Treat it as the highest-value known bug in the output plane.

### Tier 2: IR-synthesized

`synthesizedComponent(comp)` fires when there is a `ComponentInterface` but no usable verbatim source. It produces a component with a **faithful interface and a best-effort body**.

What it gets right:

- The props type is rebuilt from the IR by `propsType()`, including optionality, the raw type text, and `children?: ReactNode` when `hasChildren` is set.
- Any `extendsTypes` entry that references an importable React attribute helper is preserved in full generic form. `importableExtends()` filters using the regex `/\b([A-Z]\w*(?:HTMLAttributes|SVGAttributes|HTMLProps))\b/g`, and `reactAttrTypes()` extracts the bare identifiers to place in the generated `import type { ... } from "react"` line. So `ButtonHTMLAttributes<HTMLButtonElement> & { ... }` survives intact and still imports correctly. Extends types that are not React helpers are dropped, because the generated package could not resolve them.
- The function signature destructures the real prop names, with the real defaults: `{ children, variant = "primary" }`.
- The root element comes from `iface.rootElement`, defaulting to `div`. Self-closing handling covers `input`, `img` and `br`.
- The rendered content is `{children}` when the component takes children, else the first prop whose name matches `/label|title|text|placeholder/i`, else the component title as a string literal.

What it makes up: the styling. It picks four CSS variables out of `comp.scan.cssVarsUsed` by pattern (`surface-1`, `radius`, `space`, and a `text` variable that is not `muted`), falls back to the `--acme-*` names if none match, and applies them as a flat inline `CSSProperties` object with background, color, border radius and padding.

So tier 2 gives the customer a component with the **right API and roughly the right tokens**, but not their layout. An agent writing code against it will pass the right props. A human looking at it will see something plausible but not pixel-correct.

### Tier 3: generic stub

`genericStub(comp)` is the old behaviour, retained deliberately as the floor. It fires only when there is no `ComponentInterface` at all, which means the extractor returned `null`: an unparseable file, or a file whose component shape none of the three candidate forms matched.

```ts
export type ${comp.title}Props = { children?: ReactNode; style?: CSSProperties };

export function ${comp.title}({ children, style }: ${comp.title}Props) {
  return (
    <div data-blocksmith-component="${comp.id}" style={{ padding: "var(--acme-space-4, 8px)", ...style }}>
      {children ?? "${comp.title}"}
    </div>
  );
}
```

Its header comment says "no structural IR captured", which is the diagnostic you want: it names the cause rather than promising a future version will fix it.

### Tier summary

| Tier | Fires when | Fidelity | What the customer gets |
|------|-----------|----------|------------------------|
| 1. Verbatim source | Source carried and exports the name via `export function` or `export const` | Exact | Their own component, unchanged. Tokens resolve against generated `tokens.css`. |
| 2. IR-synthesized | Structural interface exists, tier 1 declined | Interface exact, body approximate | Correct prop names, types, optionality, variants, defaults, root element. Invented inline token styling. |
| 3. Generic stub | No structural interface | Name only | A div. Compiles, renders, does not lie about being more. |

### What the fixture actually produces today

Run `npm run codegen:pulse` against the committed vendor fixture and all four components land in **tier 1**. You can see it in `packages/generated/acme-ui-kit/src/components/`: every file's header names the scanned source path and ends with the words "verbatim source". `Card.tsx` really renders a `<section>` with an `<h2>{title}</h2>`. `Input.tsx` really renders an `<input>` with `placeholder = "Search…"` as a default. `Badge.tsx` really has `label: string`. `Button.tsx` really has the `"primary" | "secondary"` union, and that union now comes from the customer's file rather than from a hard-coded template inside the generator.

That is the difference the whole exercise bought.

---

## 5. Round-trip carrying: how structure survives markdown

There is an awkward fact in the middle of this architecture. **The wire format between scan and codegen is markdown.**

`runPulseCodegen()` in `src/lib/codegen/run.ts` does not read the scanner's in-memory result. It reads a `.md` file and calls `parseWorkspaceScanMarkdown()`. That is by design: the markdown document is the artifact a human reviews in the wiki, edits, promotes, uploads, and syncs. Making codegen read the same document guarantees the generated package matches what the human approved. If codegen read a private side channel, the wiki and the package could drift.

But markdown has no slot for "the AST of this component". So the structural IR and the verbatim source are smuggled through as invisible HTML comments.

### 5.1 Capture, in `src/lib/scan/extract.ts`

```ts
/** Skip carrying source for huge files; codegen falls back to IR synthesis. */
const COMPONENT_SOURCE_CAP = 8_000;

// ...

const componentInterface =
  extractComponentInterface(text, relPath, title) ?? undefined;
// Carry verbatim source for faithful codegen; cap to keep scan docs lean.
const source = text.length <= COMPONENT_SOURCE_CAP ? text : undefined;
```

Note the exact semantics, because they are easy to misremember: the cap is **8000 characters and it is a skip, not a truncation**. A file over the cap carries no source at all rather than carrying a broken prefix. Truncated source would be worse than none, because tier 1's name regex could still match while the body is cut mid-expression, producing a package that does not compile. Dropping it cleanly means the component degrades to tier 2, which still works.

Both fields land on `ComponentScanMeta`, which is now six fields:

```ts
export interface ComponentScanMeta {
  sourceFile: string;
  exports: string[];
  cssVarsUsed: string[];
  colorsUsed: string[];
  /** Structural props/variants IR: enables faithful codegen, not div stubs. */
  interface?: import("@/lib/scan/component-interface").ComponentInterface;
  /** Verbatim component source (capped): codegen re-emits the real body. */
  source?: string;
}
```

### 5.2 Write, in `src/lib/scan/to-markdown.ts`

Inside the per-component block of the Component Library section, after the human-readable field table:

```ts
if (c.interface) {
  const props = c.interface.props
    .map((p) => `\`${p.name}${p.optional ? "?" : ""}: ${p.type}\`${p.variants ? ` (${p.variants.join(" · ")})` : ""}`)
    .join(", ");
  if (props) lines.push(`| Props | ${props} |`);
  // Full structural IR for faithful codegen: invisible in rendered wiki.
  lines.push("");
  lines.push(`<!-- blocksmith:interface ${JSON.stringify(c.interface)} -->`);
}
if (c.source) {
  // Verbatim source, base64 to survive markdown: codegen re-emits it.
  const b64 = Buffer.from(c.source, "utf-8").toString("base64");
  lines.push(`<!-- blocksmith:source ${b64} -->`);
}
```

Two things happen here at once. The interface is *also* rendered as a human-visible `| Props |` table row, so a designer browsing the wiki sees `variant?: "primary" | "secondary" (primary · secondary)` in plain text. And the full structure goes into a comment for the machine.

The source is base64 encoded. That is not paranoia: raw TSX inside an HTML comment would contain `-->` sequences in JSX comments, backticks that confuse fenced-block detection, and arbitrary newlines. Base64 gives a single-line payload over the alphabet `[A-Za-z0-9+/=]`, which is trivially safe to embed and trivially safe to match.

### 5.3 Read, in `src/lib/scan/parse.ts`

```ts
/** Recover the structural interface IR embedded as an HTML comment. */
function parseInterfaceComment(body: string) {
  const m = body.match(/<!--\s*blocksmith:interface\s+(\{[\s\S]*?\})\s*-->/);
  if (!m) return undefined;
  try { return JSON.parse(m[1]); } catch { return undefined; }
}

/** Recover verbatim component source (base64) embedded as an HTML comment. */
function parseSourceComment(body: string): string | undefined {
  const m = body.match(/<!--\s*blocksmith:source\s+([A-Za-z0-9+/=]+)\s*-->/);
  if (!m) return undefined;
  try { return Buffer.from(m[1], "base64").toString("utf-8"); } catch { return undefined; }
}
```

Both readers swallow their own errors and return `undefined`. That is correct behaviour here: a corrupted comment should downgrade the component one tier, not fail the whole parse and take the wiki down with it.

The committed fixture at `fixtures/vendor-ui/scan-snapshot.md` carries four of each comment, one per component.

### 5.4 Why this design, and its cost

The upside is a single artifact. One `.md` file is simultaneously the human document, the wiki source, the upload payload, the sync payload, and the codegen input. Nothing can drift, because there is nothing to drift from.

The cost is real and you should know it:

- Scan documents get large. Four components at up to 8KB each, base64 encoded at a 4/3 expansion, adds tens of kilobytes.
- Raw markdown becomes unpleasant to read or diff by hand.
- The 8000 character cap is a product decision hiding in a constant. Raise it and documents bloat; lower it and more components drop to tier 2.

If the output plane grows a second consumer that needs richer structure than markdown comments can carry comfortably, this is the seam to revisit.

---

## 6. `verify:pulse`, the anti-regression guard

### 6.1 Why a faithfulness guard was necessary

Look again at `emitComponent()`. Every fallback is a `??` or a ternary. **Every degradation is silent.** If the extractor stops recognising a shape, or the scanner stops carrying source, or a regex stops matching, the generator does not throw. It quietly emits a div, exits zero, and prints "Pulse codegen complete".

That is exactly the failure mode that produced the original problem, and it would have produced it again. Type checking does not catch it, because a stub is perfectly well-typed. A build check does not catch it, because a stub builds fine. Only an assertion about *content* catches it.

### 6.2 What it actually does

`scripts/verify-pulse.ts` (82 lines), run by `npm run verify:pulse`:

1. Sets `BLOCKSMITH_DOC` to `upload:scan-acme-ui-kit.md` unless already set, and sets `AI_LAB_SCAN_CURATE=0` so AI curation cannot perturb the fixture.
2. Runs `npm run codegen:pulse`.
3. Runs `npm install --ignore-scripts` so the new workspace package is linked.
4. Builds `@blocksmith/pulse-runtime`, then `@blocksmith/acme-ui-kit`. Both use `tsc` against the generated `tsconfig.json`, so this is a real typecheck of generated code.
5. Asserts `packages/generated/acme-ui-kit/dist/index.js` exists.
6. Asserts `packages/generated/acme-ui-kit/src/tokens.css` exists and contains `--acme-accent`.
7. Asserts `dist/index.js` contains `Button`.
8. Runs the four faithfulness assertions.

The four assertions, verbatim from the script:

```ts
const faithful: [string, RegExp, string][] = [
  ["Card.tsx", /title\s*[:?]/, "Card lost its real `title` prop (stub regression)"],
  ["Card.tsx", /<section/, "Card no longer renders <section> (stub regression)"],
  ["Input.tsx", /<input/, "Input no longer renders <input> (stub regression)"],
  ["Badge.tsx", /label\s*[:?]/, "Badge lost its real `label` prop (stub regression)"],
];
```

These are chosen well. Each one is a fact that is **impossible for any stub to satisfy**:

- A generic stub's props type is only `{ children?, style? }`, so it can never contain `title:` or `label:`.
- A generic stub's root is always `<div>`, so it can never contain `<section` or `<input`.

So the assertions cannot be accidentally satisfied by a degraded path. They probe both halves of faithfulness (the prop surface and the rendered element) across three different components. A tier 2 synthesis would pass the prop assertions and the root element assertions too, which is correct: tier 2 *is* faithful in interface. The guard is a floor against tier 3, not a lock to tier 1.

`verify:pulse` and `verify:component-interface` are both in the `verify:software` chain in `package.json`, so they run on every full verification pass.

### 6.3 The gotcha: local uploads shadow the fixture

This one has cost real debugging time, so it gets its own subsection.

`loadUploadMarkdown()` in `src/lib/codegen/run.ts` resolves a doc reference in this order:

```ts
const fileName = uploadFileNameFromRef(docRef);
const localPath = resolveUploadPath(fileName);
if (existsSync(localPath)) {
  return { markdown: readFileSync(localPath, "utf-8"), resolvedFrom: docRef };
}

const fixtureMarkdown = readFixtureScanMarkdown();
if (fixtureMarkdown && fileName === "scan-acme-ui-kit.md") { /* fixture */ }

// then Supabase hydration, then fixture fallback, then throw
```

**The local upload wins.** `data/uploads/scan-acme-ui-kit.md` is checked before `fixtures/vendor-ui/scan-snapshot.md`, and `data/uploads/` is gitignored, so it exists only on your machine and its contents are whatever your last local scan wrote.

The trap: you change the scanner or the extractor, run `npm run verify:pulse`, and nothing changes in the generated output. Because codegen never read your new code path. It read a stale markdown file produced by the *old* scanner, sitting in `data/uploads/`, which already contains the old `blocksmith:interface` comments.

**The fix is always the same: re-run the scan after changing the scanner.** `npm run scan:vendor` regenerates against `fixtures/vendor-ui`. Or delete the stale local upload and let the committed fixture answer. CI does not hit this, because `data/uploads/` is not in the repo, which is precisely why it is a local-only footgun and why it is documented here.

The ordering itself is correct, incidentally. A real user who just scanned their repo must get *their* scan, not a fixture. The gotcha is a consequence of a right decision, not a wrong one.

### 6.4 `ensure-pulse.mjs` and the install hook

`scripts/ensure-pulse.mjs` runs as `postinstall`. It exists because `packages/generated/` is gitignored (line 12 of `.gitignore`) while `packages/generated/*` is a declared npm workspace. A fresh clone therefore has a workspace glob pointing at nothing, and `next build` would fail on the missing `@blocksmith/acme-ui-kit` import in `src/components/demo/PulseDemo.tsx`.

```js
const generatedPkg = join(root, "packages/generated/acme-ui-kit/dist/index.js");

if (existsSync(generatedPkg) || process.env.BLOCKSMITH_ENSURE_PULSE === "1") {
  process.exit(0);
}

process.env.BLOCKSMITH_ENSURE_PULSE = "1";
console.log("[ensure-pulse] Generating @blocksmith/acme-ui-kit…");
execSync("npm run build:pulse", { stdio: "inherit", cwd: root, env: process.env });
```

The environment variable is a **recursion guard**, not a feature flag. `build:pulse` itself runs `npm install --ignore-scripts --include=dev`, which would re-trigger `postinstall` without it. Do not remove it.

`npm run build` chains `guard-build.mjs` (refuses a production build while `next dev` is running, because that corrupts `.next`), then `ensure-pulse.mjs`, then `next build`.

---

## 7. The package artifact

### 7.1 Naming and scope

`generatePulsePackage(system, outRoot)` derives the package name from `packageSlug(system)`. That function prefers `system.id` when it is set to anything other than the placeholder `"workspace-scan"`. Failing that it slugifies `system.name` after stripping the trailing "workspace scan" suffix the scanner appends, lowercasing, collapsing every run of non-alphanumeric characters to a single hyphen, and truncating to 48 characters. If both paths yield nothing it falls back to the literal `"design-system"`.

The name is `@blocksmith/<slug>` and the output directory is `packages/generated/<slug>/`.

The governing rule, from `docs/TEAM-NORTH-STAR.md`:

> One team = one design system = one package. Not one package per user. One released artifact per product the team owns.

That is a deliberate product decision with real consequences. Every engineer on the Acme team, every agent with an Acme API key, and Acme's CI all pull the same `@blocksmith/acme-mobile-app`. Roles (owner, admin, viewer) control **who may promote**, not who gets which package. There is no per-user variant, no personal fork, no "my version of the design system". If two engineers see different components, that is a bug, not a feature.

### 7.2 What is in the package

```
packages/generated/acme-ui-kit/
  package.json          name, exports map, workspace dep on pulse-runtime
  tsconfig.json         ES2020, ESNext modules, bundler resolution, strict, react-jsx
  src/
    tokens.css          :root { ... } block of every scanned CSS variable
    tokens.ts           typed cssVars object, colors array, CssVarName type
    index.ts            re-exports tokens, pulse-runtime primitives, and each component
    components/
      Badge.tsx
      Button.tsx
      Card.tsx
      Input.tsx
  dist/                 tsc output: .js and .d.ts
```

The generated `src/index.ts` for the fixture:

```ts
/** Auto-generated @blocksmith pulse package: import "@blocksmith/acme-ui-kit/tokens.css" in your app */
export { cssVars, colors, type CssVarName } from "./tokens.js";
export { Surface, Text } from "@blocksmith/pulse-runtime";
export { Badge } from "./components/Badge.js";
export { Button } from "./components/Button.js";
export { Card } from "./components/Card.js";
export { Input } from "./components/Input.js";
```

Only components whose title starts with an uppercase letter are emitted or exported (`/^[A-Z]/`), because a lowercase name cannot be a JSX component.

`src/tokens.css` for the fixture is the whole design system's variable surface:

```css
:root {
  --acme-accent: #e85d4a;
  --acme-accent-muted: #f4a99a;
  --acme-radius-md: 8px;
  --acme-space-4: 16px;
  --acme-surface-1: #faf8f6;
  --acme-surface-2: #efeae4;
  --acme-text: #1a1a1a;
  --acme-text-muted: #6b6b6b;
}
```

`src/tokens.ts` gives the same values a typed shape:

```ts
export const cssVars = { "--acme-accent": "#e85d4a", /* ... */ } as const;
export const colors = [ { name, hex, cssVar }, /* ... */ ] as const;
export type CssVarName = keyof typeof cssVars;
```

`CssVarName` is the interesting one. It means an agent or an engineer writing `var(--acme-acccent)` with a typo gets a compile error rather than a silently transparent background.

### 7.3 `@blocksmith/pulse-runtime`

`packages/pulse-runtime/` is small on purpose: two components and nothing else.

```ts
export { Surface, type SurfaceProps } from "./Surface.js";
export { Text, type TextProps, type TextVariant } from "./Text.js";
```

`Surface` takes `level?: 0 | 1 | 2` and maps it to a background through a two-deep CSS variable fallback chain:

```ts
const DEFAULT_LEVEL_BG: Record<0 | 1 | 2, string> = {
  0: "var(--pulse-surface-0, var(--acme-surface-1, #faf8f6))",
  1: "var(--pulse-surface-1, var(--acme-surface-2, #efeae4))",
  2: "var(--pulse-surface-2, var(--acme-accent-muted, #f4a99a))",
};
```

Read that chain from left to right: prefer a `--pulse-*` variable if the host app defines one, otherwise use the generated `--acme-*` token, otherwise use a hard-coded hex so the component never renders invisible. `Text` does the same for `body`, `muted` and `heading` variants and picks its own tag (`h2` for headings, `p` otherwise) unless overridden with `as`.

These two live in a shared runtime rather than being generated per package because they are genuinely the same for every customer. They carry no customer-specific values, only variable references. The customer-specific values arrive through `tokens.css`.

### 7.4 The rule: the AI imports tokens, it does not write CSS

From `docs/00-thesis.md`, phase 2:

> `.md` to `@blocksmith/<project>`: `Surface`, `Text`, `Button`; AI imports tokens, does not write CSS.

This is the whole point of the package, and it is worth being precise about why.

An agent asked to build a settings page has two options. It can write `background: #faf8f6` because it saw that hex in the design doc, or it can write `<Surface level={0}>`. The first is a fork: the moment the design system changes its surface color, that page is wrong and nothing detects it. The second is a reference: the value is resolved at render time from `tokens.css`, which was generated from the scan, which came from the repo.

The package exists to make the second option the *easy* one. That is why `tokens.ts` is typed, why `tokens.css` is a separate export path, and why the primitives take semantic props (`level`, `variant`) rather than style props.

There is a matching enforcement half in the control plane, which is not this chapter's subject but is worth naming: the MCP `validate_ui_code` tool and `npm run validate:ui` check generated UI code for raw hex that should have been a token. The package makes the right thing easy; the validator makes the wrong thing loud.

### 7.5 Every surface that triggers codegen

The same `runPulseCodegen()` entry point is reachable five ways:

| Surface | Path | Notes |
|---------|------|-------|
| npm script | `npm run codegen:pulse` | `scripts/codegen-pulse.ts`, reads `BLOCKSMITH_DOC` |
| HTTP API | `POST /api/v1/codegen/pulse` | `src/app/api/v1/codegen/pulse/route.ts`, behind `requireApiKey` |
| SDK | `client.codegen.pulse({ doc })` | `packages/sdk/src/client.ts` |
| CLI | `blocksmith codegen [--doc <ref>]` | `packages/cli/src/cli.ts`, `cmdCodegen` |
| MCP tool | `pulse_codegen` | `src/lib/mcp/blocksmith-server.ts`, handler in `src/mcp/handlers.ts` |

Plus the demo route `/demo/pulse` (`src/app/demo/pulse/page.tsx`, rendering `src/components/demo/PulseDemo.tsx`), which imports the generated package for real:

```tsx
import "@blocksmith/acme-ui-kit/tokens.css";
import { Surface, Text, Button, colors } from "@blocksmith/acme-ui-kit";
```

That import line is the proof. If codegen is broken, that page fails to build, and `npm run build` fails with it.

### 7.6 An honest gap: "built from the promoted graph"

`docs/TEAM-NORTH-STAR.md` states the doctrine clearly:

> Package is not a separate truth. It is a build artifact of the promoted graph.

The code does not do this yet. `runPulseCodegen()` calls `parseWorkspaceScanMarkdown()` on a scan markdown document. It does not call `getOfficialGraph()`, it does not consult block versions, and it does not check `blocksmith.lock`. The device compile target *does* read the official graph (section 8). Pulse does not.

In practice the gap is narrower than it sounds, because scan facts auto-promote on ingest, so the markdown and the official graph usually agree on tokens and components. But "usually agree" is not "is a build artifact of". Until `runPulseCodegen` reads the registry, the generated package can be built from a draft state that was never promoted, and it carries no graph hash to audit against. This is the largest doctrine-versus-code divergence in the output plane. Record it as **Partial**, not Shipped.

### 7.7 The Pretext spin-off

`packages/pretext-components/` is a separate, smaller output-plane experiment and should not be confused with Pulse. Its README opens with "Not part of AI Lab."

It uses Cheng Lou's Pretext (`@chenglou/pretext`) for canvas-accurate text measurement, and given a parsed component spec it lays out buttons, cards, nav bars and inputs with correctly sized text slots. The rationale in the README: DOM reflow is slow and `system-ui` drifts on macOS, whereas Pretext measures once per text run and then relayouts at any width in roughly 0.0002ms. That makes it suitable for component galleries, share previews and MCP block thumbnails.

- `src/measure.ts`: builds the CSS font shorthand (`pretextFontString`) and wraps `prepare` plus `layout`. It deliberately avoids `system-ui`.
- `src/classify.ts`: `classifyComponentKind()` maps component prose (title, role, description) onto one of nine frame kinds: `button`, `input`, `card`, `nav`, `tag`, `tab`, `hero`, `strip`, `generic`. Title and role are checked first with tighter patterns, then the full corpus with looser ones.
- `src/react/frames.tsx` (455 lines): the per-kind frame builders.
- `src/react/`: `PretextText`, `PretextComponentView`, `ComponentGallery`.
- Host wiring lives in `src/lib/pretext-components/adapter.ts`, which maps a `DesignIR` plus a `LoadedDesignSystem` into a `GalleryComposition`.
- Smoke test: `npm run pretext-components:test -- upload:design-dcd1a101.md` (`scripts/pretext-components/test-gallery.ts`), which prints each component with its classified kind and variant.

Note that it is a **renderer for prose-derived specs**, not a code generator. It reads descriptions ("Fill: #f0d7ff. Border-radius: 12px.") and draws a frame. Pulse reads structure and emits code. They sit on different rungs of the fidelity ladder, and the Pretext path is the one that works when there is no source code at all, for instance on a Figma import or an uploaded design document.

---

## 8. Compile targets and the device story

### 8.1 The framing, first

This is the claim that must not be overstated, and `docs/00-thesis.md` phase 3 states it correctly:

> Same IR to watch/HMI simulator to native/LVGL; same **contract**, not same JS `import` on chip.

Nobody is running JavaScript on a microcontroller. The promise is that the *semantic contract* survives the trip: the same block id, the same version, the same content hash, the same accent color, the same minimum touch target, the same governance rule. What changes is the emitter.

`docs/PITCH-AND-PRODUCT-MODEL.md` puts the guardrail next to the pitch line:

> Pitch line: One design package, multiple compile targets. We do not claim firmware on day one. We claim one IR, web today, device profile tomorrow.

If you find yourself in a conversation where "runs on hardware" is being implied, correct it in the room.

### 8.2 `device-sim.v1`

`src/lib/ir/targets/device-sim.ts` (200 lines) compiles a `BlocksmithGraphV1` into a `DeviceProfile`. Unlike Pulse, this target reads the **official promoted graph** through `getOfficialGraph(doc)`.

Three frames are defined:

| id | Label | Size | Shape | px per mm |
|----|-------|------|-------|-----------|
| `watch-240` | Watch 240x240 | 240x240 | round | 7.5 |
| `watch-396` | Watch 396x396 | 396x396 | round | 9.8 |
| `hmi-480` | HMI 480x320 | 480x320 | landscape | 6.3 |

`pxPerMm` is not decoration. It drives the touch-target math: `minTouchPx = ceil(MIN_TOUCH_MM * frame.pxPerMm)` with `MIN_TOUCH_MM = 9`, following embedded HIG conventions. On `watch-240` that is 68 pixels out of 240, which is more than a quarter of the display. That number is the whole reason a device profile is a different artifact from a CSS file: the physical constraint is real and it changes the design.

The compile walks the graph's blocks and sorts them into three buckets:

- **`token` blocks** become `DeviceToken` entries with `{ id, version, name, value, rgb, kind, contentHash }`. `kind` is derived from the id prefix (`token:color:`, `token:spacing:`, `token:surface:`, `token:typography:`, else `other`). Colors are converted to a `0xRRGGBB` integer by `hexToRgbInt`. The type comment is the important part: "Resolved literal: devices have no CSS variable indirection." There is no `var()` on a watch. Every value must be resolved at compile time.
- **`component` blocks** become `DeviceWidget` entries with a `snake_case` identifier safe for C and LVGL, plus `cornerRadiusPx`, `minTouchPx` and `labelMaxLines`.
- **`guideline` and `agent-rule` blocks** become `DeviceConstraint` entries. Severity is `enforce` when the block id contains `dont`, else `advise`. So a "don't" rule from the wiki arrives on the device as an enforce-level constraint.

The profile then stamps four invariants:

```ts
invariants: [
  `every interactive widget ≥ ${minTouchPx}px (${MIN_TOUCH_MM}mm) touch target`,
  "color values resolved from locked token blocks: no invented hex",
  "block id + version + contentHash preserved verbatim from the graph",
  "governance don'ts compiled as enforce-level constraints",
],
```

And it carries `graphHash: graph.contentHash`, with the field comment "must match `blocksmith.lock` for the build to be trusted."

### 8.3 Measuring what is lost

`deviceCompileLoss(graph, profile)` is a small function with an outsized point to make. It compares the set of block ids that made it into the profile against the full graph and returns everything that was dropped, with a reason:

```ts
reason: b.type === "page"
  ? "prose page: no device equivalent"
  : "no compilable payload for this target",
```

Most compilers hide their losses. This one reports them, and `scripts/compile-device.ts` prints the count and the first five dropped ids on every run. That is the right instinct for a system whose whole claim is semantic portability: if you claim meaning survives, you must be able to say exactly which meaning did not.

### 8.4 `tokens.h`

`src/lib/ir/targets/c-header.ts` (93 lines) emits a C header from the same graph. It is described in its own header comment as phase 2 of device honesty.

The generated file opens with a provenance block containing the schema, the doc ref, the graph content hash and a timestamp, then emits three sections:

```c
/* -- color tokens (0xRRGGBB) -- */
#define BS_COLOR_ACCENT 0xE85D4Au /* token:color:accent@v3 a1b2c3d4 */

/* -- spacing tokens (px) -- */
#define BS_SPACE_4 16 /* token:spacing:4@v1 */

/* -- surface levels (0xRRGGBB) -- */
#define BS_SURFACE_1 0xFAF8F6u /* token:surface:1@v2 */
```

Every `#define` carries a trailing comment with the block id, the version, and (for colors) the content hash. The header comment states why:

> Each define is traceable: block id at version (contentHash). Lock hash is stamped in the header so firmware builds can be audited against the design graph that produced them.

That is the actual product idea, and it is a good one. The embedded engineer's normal experience of design is a PDF, a screenshot, or a Slack message with a hex code in it. What they get here is a generated header where every constant can be traced back to a versioned, promoted, hashed block. If firmware ships the wrong accent color, you can prove which graph version it was built from.

### 8.5 The driver script

`npm run compile:device` runs `scripts/compile-device.ts`:

```bash
npm run compile:device                                    # default doc, watch-240
npm run compile:device -- --doc apollo.md --frame hmi-480
```

It validates the frame id against `DEVICE_FRAMES`, calls `ensureDocBlocks(doc)` and `getOfficialGraph(doc)`, refuses to proceed if there are no promoted blocks ("open the wiki and Finalize first"), then writes four artifacts into `.blocksmith/targets/<docKey>/`:

| File | Emitter |
|------|---------|
| `device-<frame>.json` | `compileDeviceSim` |
| `tokens.h` | `emitTokensHeader` |
| `tokens.css` | `buildStyleDictionaryTargets` |
| `tokens.json` | `buildStyleDictionaryTargets` |

The last two come from `src/lib/design-tokens/style-dictionary.ts`, which runs the promoted token blocks through Style Dictionary to produce portable CSS variables and nested JSON. That matters for credibility: Style Dictionary is the industry-standard token pipeline, so a design ops team recognises the output format immediately.

### 8.6 The simulator

`/demo/device` (`src/app/demo/device/page.tsx`) compiles all three frames server-side and hands them to `src/components/demo/DeviceSimDemo.tsx`, along with the `tokens.h` text so it can be shown in the UI. The component's header comment states the claim it is making:

> Renders the SAME promoted block graph the wiki and Pulse read, on watch/HMI frames. Every color and radius on screen is traceable to a block id at version pinned in `blocksmith.lock`.

It fails gracefully: if there are no promoted blocks it renders "No promoted blocks yet: open the wiki, Finalize a block, then reload" rather than an error.

### 8.7 Honest status

| Capability | Status | Honest reading |
|------------|--------|----------------|
| `device-sim.v1` profile compile | **Shipped** | Real code, real frames, real touch math, run by `compile:device` and by the demo route |
| `tokens.h` emit | **Shipped** | Generated, traceable, syntactically valid C |
| Style Dictionary CSS and JSON | **Shipped** | Runs as part of `compile:device` |
| Semantic loss reporting | **Shipped** | `deviceCompileLoss`, printed on every compile |
| Browser watch/HMI simulator | **Shipped** | `/demo/device`, three frames |
| `tokens.h` compiled into real firmware | **Not built yet** | No firmware project consumes it. Never been through a toolchain. |
| Native or LVGL widget emit | **Planned** | `DeviceWidget.widget` is a C-safe identifier, and that is the extent of it. No LVGL emitter exists. |
| Physical device, dev board, OTA | **Idea** | Named as stream E in `docs/TEAM-NORTH-STAR.md`. No code. |

The sentence to use out loud: **we compile the design graph to an embedded-shaped artifact, and we have never run it on hardware.** Everything before the comma is true and demonstrable. Everything after it is the honest qualifier.

---

## 9. `font-generator`: a separate proving ground

### 9.1 What it is and why it is here

`font-generator/` is a standalone Next.js 15 application living inside the BlockSmith repository, MIT licensed, that turns a plain-English prompt into a downloadable font file. Type a brief, get a typeface, adjust it, edit individual glyph outlines, download a real `.ttf` or `.otf`.

It is not part of the AI Lab pipeline. It shares no code with `src/`. It is here because it is the **most complete end-to-end proof the company has that "prompt goes in, real usable artifact comes out" is achievable**, and because it is a genuinely harder version of the same problem the output plane has: an AI decides parameters, deterministic code turns those parameters into a binary format with hard validity constraints, and the result either opens in Font Book or it does not. There is no partial credit and no way to fake it in a demo.

### 9.2 The pivot, and what was judged unusable

On 2026-06-17 the app was **pivoted away from a from-scratch parametric skeleton-stroke engine** to instancing real open-licensed variable fonts.

The original engine drew glyphs from scratch: define a skeleton (the centre line of each stroke), give it a width, generate outlines. It is the textbook approach and it produces a demo quickly, because capital letters are mostly straight lines and simple arcs.

The founder's verdict on the output was that it was **"not professional, can't be used anywhere."** The specific failure: uppercase looked passable, but lowercase, numerals and symbols did not. Lowercase is where real type design lives. The `a` with its bowl and stem relationship, the `g` with a descender that is a different construction in single-storey and double-storey forms, the `s` with its double reverse curve, the way `e` closes its aperture. Numerals need consistent width and consistent optical weight. Symbols need to sit correctly on the baseline and match the stroke contrast. A skeleton-stroke engine produces recognisable shapes for all of these and professional shapes for none of them, and a font that is 60 percent professional is a font nobody ships.

Two explicit choices were made at the pivot, and they reversed an earlier constraint:

1. Use **real OFL-licensed base fonts** rather than generating every glyph.
2. Offer **axis and transform editing** rather than per-node glyph construction.

This reversed the earlier "no Google Fonts, fully original" position. **Quality won over originality.** That is the judgement to internalise: a generator that produces professional output from professional source material beats a generator that produces original output nobody would use.

### 9.3 The catalog

`font-generator/lib/fontCatalog.ts` is the single source of truth. Eight bundled variable fonts in `public/fonts/`, each with real `fvar` axis ranges:

| id | Label | Category | Axes (with real ranges) | upm |
|----|-------|----------|--------------------------|-----|
| `inter` | Inter | Humanist sans | `wght` 100 to 900, `opsz` 14 to 32 | 2048 |
| `spacegrotesk` | Space Grotesk | Geometric sans | `wght` 300 to 700 | 1000 |
| `recursive` | Recursive | Expressive variable | `wght` 300 to 1000, `MONO` 0 to 1, `CASL` 0 to 1, `slnt` -15 to 0, `CRSV` 0 to 1 | 1000 |
| `nunito` | Nunito | Rounded sans | `wght` 200 to 1000 | 1000 |
| `fraunces` | Fraunces | Editorial serif | `wght` 100 to 900, `opsz` 9 to 144, `SOFT` 0 to 100, `WONK` 0 to 1 | 2000 |
| `playfairdisplay` | Playfair Display | Didone serif | `wght` 400 to 900 | 1000 |
| `robotoslab` | Roboto Slab | Slab serif | `wght` 100 to 900 | 2048 |
| `jetbrainsmono` | JetBrains Mono | Monospace | `wght` 100 to 800 | 1000 |

All are OFL 1.1 except Roboto Slab, which is Apache 2.0. `THIRD_PARTY_NOTICES.md` records this and states that exported instances inherit the base font's license.

**Recursive is the expressive workhorse.** Its five axes (`wght`, `MONO`, `CASL`, `slnt`, `CRSV`) are what give the app per-prompt variety, because they let one base font travel from a clean geometric sans to a casual warm slanted cursive without leaving the family. Every other font in the catalog is essentially a weight slider plus at most one extra dimension.

Each entry also carries `keywords`, used by the no-key fallback, and `blurb` plus `category`, injected into the model prompt.

### 9.4 The AI parameter contract

`app/api/generate/route.ts` (275 lines) is the only server-side code in the app. The model returns exactly this JSON:

```json
{
  "familyName": "string",
  "base": "one of the catalog ids",
  "axes": { "tag": 0 },
  "tracking": 0,
  "shape": { "slant": 0, "width": 1, "vstretch": 1, "distortion": 0, "roughen": 0 }
}
```

Route details worth knowing:

- Provider is NVIDIA's OpenAI-compatible endpoint, default base URL `https://integrate.api.nvidia.com/v1`, default model `nvidia/nemotron-3-super-120b-a12b`, overridable via `NVIDIA_MODEL`. Temperature 0.4, `top_p` 0.9, `max_tokens` 800, thinking disabled.
- The system prompt embeds the catalog with each font's category, blurb, and axis ranges, then gives explicit routing guidance ("professional/UI/Helvetica to `inter`", "quirky/expressive/distinctive/casual/handwritten to `recursive`") and a long shape table mapping brief adjectives to numeric ranges.
- One instruction in the prompt is doing heavy lifting: *use the FULL set of axes the base offers, not just weight; two different briefs on the same base should land on visibly different axis values; push axes toward the extremes the brief implies rather than safe middles.* Without it, models converge on the middle of every range and every prompt produces the same font.
- Up to 3 attempts, retrying only on 5xx and 429, with a 600ms then 1200ms backoff.
- **Every failure path returns 200 with heuristic parameters.** No key, placeholder key containing `xxxx`, bad base URL, upstream error, timeout, unparseable JSON: all fall through to `heuristicParams(prompt)`, a keyword scorer over the catalog's `keywords` arrays plus a set of adjective rules for weight, optical size, shape and tracking. The response carries a `source` field of `nemotron`, `heuristic`, or `heuristic-fallback`, so the UI knows which it got. `ARCHITECTURE.md` states the reason plainly: the fallback lets contributors develop, test and review without paid credentials.
- Safety rails: 600 character prompt cap, 2048 byte body cap (checked on both the `content-length` header and the decoded body), and an in-memory rate limiter defaulting to 30 requests per 60 seconds per client id, tunable via `GENERATE_RATE_LIMIT` and `GENERATE_RATE_WINDOW_MS`. `ARCHITECTURE.md` is explicit that the in-memory limiter is not sufficient for multi-region production.

Whatever comes back is passed through `sanitizeParams` in `lib/types.ts` before anything renders. This is the trust boundary:

```ts
const base = typeof p.base === "string" && FONT_BY_ID[p.base] ? p.base : DEFAULT_FONT_ID;
const def = FONT_BY_ID[base];

const axes: Record<string, number> = { ...def.defaults };
for (const axis of def.axes) {
  const raw = incoming[axis.tag];
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(n)) axes[axis.tag] = Math.min(axis.max, Math.max(axis.min, n));
}
```

An unknown `base` falls back to Inter. Axes start from the base's defaults and only accept tags the base actually declares, clamped to the base's real range. `familyName` is trimmed to 48 characters. `tracking` clamps to -40 through 160. Shape clamps to `slant` -20 to 20, `width` 0.7 to 1.4, `vstretch` 0.82 to 1.18, `distortion` 0 to 1, `roughen` 0 to 1.

The result: **a hallucinating model cannot produce an invalid font.** It can produce an ugly one, and that is the user's problem, but it cannot select a font that does not exist or pin an axis outside its `fvar` range, which would break instancing.

### 9.5 The generative geometry layer

The pivot to instancing solved quality but created a new problem: if the AI can only turn dials on eight fonts, prompts start to feel samey, and the founder's repeated ask was **"change the curves, not just the weight."**

`lib/genShape.ts` (121 lines) answers that. It reshapes the **actual curve points** of real glyph outlines:

```ts
export function applyShaping(commands: Cmd[], upm: number, sp: ShapeParams, char: string): Cmd[] {
  const out = commands.map((c) => ({ ...c }));
  const tan = Math.tan((sp.slant * Math.PI) / 180);
  const magBend = sp.distortion * upm * 0.08;
  const magGrain = (sp.roughen ?? 0) * upm * 0.02;
  // ... build warp fields, then:
  const tf = (x: number, y: number): [number, number] => {
    if (warp) [x, y] = warp(x, y);
    const ny = y * sp.vstretch;
    const nx = x * sp.width + ny * tan;
    return [nx, ny];
  };
  for (const c of out) {
    if (c.x !== undefined) [c.x, c.y] = tf(c.x, c.y as number);
    if (c.x1 !== undefined) [c.x1, c.y1] = tf(c.x1, c.y1 as number);
    if (c.x2 !== undefined) [c.x2, c.y2] = tf(c.x2, c.y2 as number);
  }
  return out;
}
```

Two layers compose:

1. **An organic warp.** `waveField(seed, freqScale)` builds a sum of four sine waves with pseudo-random directions, frequencies and phases from a `mulberry32` PRNG, normalised. Two independent fields drive x and y displacement. `distortion` uses the base frequency scale and a magnitude of 8 percent of the em; `roughen` uses a 3.5x frequency scale and 2 percent of the em, so `distortion` bends whole strokes while `roughen` adds fine edge grain. They combine.
2. **An affine transform.** `vstretch` scales y, `width` scales x, `slant` shears x by the tangent of the angle. Applied after the warp so the shear is not itself warped.

Every anchor and both control points of every cubic get transformed, so curves genuinely change shape rather than being scaled as a whole.

The seed matters. `hashSeed(str)` is FNV-1a over the prompt string, set client-side in `app/studio/page.tsx` (`sp.shape = { ...sp.shape, seed: hashSeed(text) }`). Inside `applyShaping` the per-glyph seed is `(sp.seed ^ hashSeed(char) ^ 0x9e3779b9) >>> 0`, so **every character gets a different warp but the same prompt always reproduces the same font**. Deterministic and varied at the same time.

`shapedAdvance()` scales the advance width by `width` so spacing stays consistent. And `glyphOutline.ts` adds an optical correction: horizontal scaling thins vertical stems, so `instanceParams()` compensates by pushing the `wght` axis by `wght * (1/width)^0.6`, clamped to the axis range.

The behaviour that falls out: "clean/professional/corporate" maps to the identity shape and you get a clean instanced font. "funky", "comic", "stupid", "grunge", "hand-drawn" map to progressively higher distortion and roughen, and you get visibly warped, wobbly, gritty geometry.

**The honest framing, which you should repeat rather than improve on:** this is not a from-scratch engine, because that was rejected as unusable. It warps real professional outlines, so the result stays legible and keeps a complete character set.

### 9.6 The live per-glyph editor

`components/GlyphEditor.tsx` (164 lines) is a plain SVG node editor operating on **real extracted outlines**, not on a synthetic skeleton.

The extraction path is: `instanceFont(params)` produces a static font binary via HarfBuzz, `opentype.parse()` reads it, `font.charToGlyph(char).path.commands` gives the actual curve commands, and `applyShaping` runs over them if the shape is not the identity. The result is a `GlyphOutline` of `{ commands, advance, upm }`.

The editor renders those commands as an SVG path inside a `translate(...) scale(1 -1)` group, because font coordinates have y increasing upward while SVG has y increasing downward. It draws the baseline and the advance width as guides. Every `M`, `L`, `C` and `Q` anchor becomes a draggable circle.

Two details show real care about outline correctness:

- **`moveAnchor` drags the correct handles with the point.** Moving a `C` anchor also moves its own second control point `(x2, y2)` and the *following* command's first control point `(x1, y1)`, because those two handles belong to the curves that meet at the anchor. Without that, dragging a node would tear the curve.
- **`companionOf` keeps closed contours closed.** In a closed contour the initial `M` and the final point are coincident. Dragging one without the other opens a hole in the glyph. `companionOf` finds the coincident partner (within 0.01 units) and moves both.

There is an important library constraint underneath all of this: **opentype.js can read these fonts but cannot re-serialize them.** Its GSUB writer throws on the tables these variable fonts carry. That is why edits do not round-trip through opentype. They are baked by building a *fresh* font from the outlines instead. `next.config.mjs` carries no `opentype.js: false` webpack alias, which is what allows opentype to run client-side at all.

Edited glyphs are frozen: `app/studio/page.tsx` keeps a `GlyphEdits` map of `char -> GlyphOutline`, and an edited glyph is used verbatim thereafter while unedited glyphs still receive the global shape transform. Changing the base font clears all edits (`setBase` calls `setEdits({})`), which is correct because outlines from one family have no meaning in another.

### 9.7 The two export paths

`app/studio/page.tsx` decides with one boolean:

```ts
const needsRebuild = Object.keys(edits).length > 0 || !isIdentityShape(params.shape);
```

**Path A, no edits and identity shape: HarfBuzz instancing to `.ttf`.**

`lib/instanceFont.ts` (96 lines) fetches `public/hb-subset.wasm`, instantiates it with `WebAssembly.instantiate`, copies the base font bytes into the wasm heap, creates a blob and face, calls `hb_subset_input_keep_everything`, then calls `hb_subset_input_pin_axis_location` once per axis to pin the chosen value, and finally `hb_subset_or_fail`. The result is a static TrueType font with all the original tables preserved: `cmap`, hinting, `GSUB`, `GPOS`, everything. Nonzero tracking is baked into the advance widths afterwards by patching the `hmtx` table (`lib/sfnt.ts`, `patchTrackingIntoHmtx`) so the download matches the CSS preview.

This path runs entirely in the browser. No server, no serverless function, no font binaries crossing the network in either direction. That is a real deployment advantage.

**Path B, edited or shaped: rebuild to `.otf`.**

`lib/glyphOutline.ts` `buildEditedFont(params, edits, shape, opts)` instances the font first, then walks a fixed `CHARSET` (space, A to Z, a to z, 0 to 9, and a symbol set). For each character it uses the edited outline if one exists, otherwise the source outline with `applyShaping` applied. It builds `opentype.Glyph` objects with correct names (`space`, the literal character for alphanumerics, `uniXXXX` otherwise), tracks the real y extents to set `ascender` and `descender`, and emits a fresh CFF font via `opentype.Font.toArrayBuffer()`.

Kerning is then recovered by brute force: for every ordered pair in the charset it calls `font.getKerningValue()` on the *instanced source* font, scales the value by the shape width, and re-emits the pairs as a legacy `kern` table through `buildKernTable` and `upsertTable` in `lib/sfnt.ts`. Kerning extraction is wrapped in a try/catch that logs and continues without kerning, because a font without kerning is much better than no font.

`lib/sfnt.ts` (150 lines) is the shared binary surgery for both paths: table directory rebuild, per-table checksums, and `head.checkSumAdjustment`.

`ARCHITECTURE.md` is honest about the tradeoff: the `.ttf` path preserves more of the original font behaviour, while the edited `.otf` path prioritises baking user geometry into a valid file. Ligatures, alternates and other `GSUB` features do not survive path B. Only pair kerning does.

The live preview mirrors path B: when `needsRebuild` is true the studio debounces 220ms, rebuilds the font in-browser, wraps the bytes in a `FontFace`, adds it to `document.fonts` under a timestamped family name, and swaps the previous one out. So the character map, the specimen and the hero all render the exact font that will be downloaded.

### 9.8 The standing rule

**Do not reintroduce the deleted skeleton engine.** The old `lib/glyphEngine.ts` and `lib/buildFont.ts` are gone and must stay gone. They are confirmed absent from the tree. If a future task sounds like "generate the glyphs ourselves so we own the output", that is the rejected direction, and the reason is recorded above: the output was judged unusable and unshippable.

There is one thing in the tree that could be mistaken for a violation, so know what it is. `lib/studio2/` (roughly 1900 lines across `skeleton.ts`, `masters.ts`, `operators.ts`, `properties.ts`, `extract.ts`, `geom.ts`, `raster.ts`, `edt.ts`, `charset.ts`, `build.ts`) does contain a `skeleton.ts` with `SkelPoint`, `Stroke` and `Terminal` types. But it works in the opposite direction from the deleted engine: it **rasterises real glyph outlines, runs a Euclidean distance transform, and extracts the medial axis from them**, using that skeleton to drive named type-design properties (weight, aperture, and so on) as local warps on the real curves. It derives structure from professional outlines rather than drawing glyphs from a skeleton.

That said: **`lib/studio2/` is currently unwired.** Nothing under `app/` or `components/` imports it. Treat it as an in-progress experiment, not as shipped behaviour, and do not describe it to anyone as a feature.

### 9.9 Build gotchas

Two of these have already broken the build once each.

**1. `font-generator/` is a git submodule.** `git ls-files -s font-generator` reports mode `160000`, meaning the parent repo tracks a commit pointer, not the files. Changes inside it must be committed and pushed in the submodule, then the pointer bump committed in the parent. A `git status` line reading just `M font-generator` means the pointer moved, not that a file changed.

**2. It must be excluded from the root `tsconfig.json`.** The root config's `include` is `["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]`, which would otherwise pull the entire nested app into the main typecheck. It has its own `tsconfig.json`, its own `@/*` path alias pointing at its own root rather than at `src/`, its own React 19 and Next 15 dependencies, and its own `next-env.d.ts`. Type checking it from the root produces a wall of unresolvable imports. Hence:

```json
"exclude": ["node_modules", "packages/cli", "packages/sdk", "font-generator"]
```

That exclusion is commit `60cdd31`, "fix(build): exclude nested font-generator app from root tsconfig". Do not remove it. If you need to typecheck the font app, do it from inside the directory with its own `npm run typecheck`, or `npm run check`, which is what its CI runs.

**3. It runs on port 3939**, not 3000, so it can run beside the main app during development. `next dev -p 3939`.

**4. Provider keys stay server-side.** `NVIDIA_API_KEY` lives in `font-generator/.env.local`, which is gitignored, and only `.env.example` with placeholders is committed. `SECURITY.md` and `README.md` both state the rule. Historical note worth acting on: an NVIDIA key was shared in plaintext once and should be treated as compromised and rotated.

### 9.10 What the output plane can learn from it

Three things transfer directly.

- **Constrain the AI to a validated parameter space.** The model does not emit a font, it emits parameters, and `sanitizeParams` guarantees those parameters are valid before anything downstream sees them. The Pulse equivalent would be: do not let a model write component code, let it select and parameterise from a validated space, and validate at the boundary.
- **Start from professional source material.** The pivot's whole lesson. `emitComponent` tier 1 is the same lesson applied to React: re-emitting the customer's real component beats generating an approximation of it, every time.
- **Always ship a working no-key path.** The heuristic fallback means a contributor with no credentials still gets a working app. Any AI-dependent feature in the main product should have the same property, and the ones that do not are fragile.

---

## 10. Status of the output plane

Per the vocabulary in [STYLE.md](./STYLE.md).

| Capability | Path | Status | Notes |
|------------|------|--------|-------|
| Structural interface extraction | `src/lib/scan/component-interface.ts` | **Shipped** | 5 shapes covered by `verify:component-interface`, in `verify:software` |
| Interface and source round trip through markdown | `to-markdown.ts`, `parse.ts`, `extract.ts` | **Shipped** | 4 of each comment in the committed fixture |
| Tier 1 verbatim emit | `sourceComponent` in `pulse.ts` | **Shipped** | All 4 fixture components hit it. Does not rewrite imports. |
| Tier 2 IR-synthesized emit | `synthesizedComponent` | **Built, unproven** | Code is complete and typechecks, but no committed fixture exercises it end to end |
| Tier 3 generic stub | `genericStub` | **Shipped** | Deliberate floor, not a defect |
| Generated token exports (`tokens.css`, `tokens.ts`) | `pulse.ts` | **Shipped** | Typed `CssVarName` guards typos |
| `@blocksmith/pulse-runtime` primitives | `packages/pulse-runtime/` | **Shipped** | Two components, `Surface` and `Text`, variable-driven with fallbacks |
| Generated package builds with `tsc` | `verify:pulse` | **Shipped** | Real typecheck of generated code in CI |
| Faithfulness anti-regression guard | `scripts/verify-pulse.ts` | **Shipped** | 4 assertions no stub can satisfy |
| Codegen surfaces (script, API, SDK, CLI, MCP) | 5 paths, section 7.5 | **Shipped** | All route to one `runPulseCodegen` |
| `/demo/pulse` | `src/app/demo/pulse/page.tsx` | **Shipped** | Imports the generated package for real, so a broken codegen fails the build |
| Codegen built from the promoted graph | `src/lib/codegen/run.ts` | **Partial** | Reads scan markdown, not `getOfficialGraph`. No graph hash on the artifact. Doctrine says otherwise. |
| Auto-codegen after scan or promote | not present | **Planned** | Listed as next step in `docs/PHASE2-PULSE.md` |
| Import rewriting for tier 1 sources | not present | **Not built yet** | Highest-value known bug: a component importing a local helper produces an unbuildable package |
| Published npm packages per customer | `scripts/publish-packages.mjs` | **Partial** | Publishes the SDK and CLI. Generated customer packages are `private: true` and never published. |
| `device-sim.v1` profile compile | `src/lib/ir/targets/device-sim.ts` | **Shipped** | 3 frames, real physical touch math, reads the official graph |
| `tokens.h` emit | `src/lib/ir/targets/c-header.ts` | **Shipped** | Every define traceable to block id, version, hash |
| Style Dictionary CSS and JSON | `src/lib/design-tokens/style-dictionary.ts` | **Shipped** | Runs inside `compile:device` |
| Semantic loss reporting | `deviceCompileLoss` | **Shipped** | Reports what did not survive, on every compile |
| Browser device simulator | `/demo/device` | **Shipped** | Watch 240, watch 396, HMI 480 |
| Firmware consuming `tokens.h` | none | **Not built yet** | Never been through a C toolchain |
| Native or LVGL widget emit | none | **Planned** | Only the snake_case identifier exists |
| Physical hardware, dev board, OTA | none | **Idea** | Stream E in `docs/TEAM-NORTH-STAR.md` |
| Pretext component frames | `packages/pretext-components/` | **Built, unproven** | Composes and classifies; smoke-tested by a script, not by `verify:software` |
| `font-generator` prompt to font | `font-generator/` | **Shipped** | Complete loop, downloadable `.ttf` and `.otf`, works with no API key |
| `font-generator` studio2 property engine | `font-generator/lib/studio2/` | **Idea** | Written but unwired. Nothing imports it. |

### The honest verdict

The output plane went from **fake to real, and stopped there.**

What changed is not small. It is now true that a customer scan produces a package containing the customer's actual components, that the promise cannot silently regress because CI asserts against the exact failure mode, and that the underlying reason for the original failure (a four-field IR) has been fixed at the source rather than patched at the emitter.

But measure it against the control plane and the gap is still wide.

The control plane has versioned append-only blocks, a lock file, a promote gate, rollback, drift detection, MCP enforcement, org RBAC, and something like twenty verify scripts covering it. The output plane has one generator, one guard with four assertions, one runtime package with two components, one device profile emitter that has never met a device, and a demo route.

Three specific gaps define how far there is left to go:

1. **The package is not yet an artifact of the promoted graph.** Until `runPulseCodegen` reads the registry and stamps a graph hash, the central claim in `docs/TEAM-NORTH-STAR.md` is aspirational. The device target already does this correctly, so the pattern exists to copy.
2. **Tier 1 does not rewrite imports.** The fixture is self-contained and real repositories are not. The first customer whose `Card.tsx` imports a `cn` helper gets a package that does not build. This will happen.
3. **Nothing on the device side has met hardware.** The compile target is real, the artifacts are real, and the loop is not closed. Until one `tokens.h` compiles into one firmware image on one dev board, phase 3 is a design, not a capability.

The output plane is now honest. It is not yet strong.

---

## Open questions

1. **Should Pulse read the official graph instead of scan markdown?** The device target already does. Doing the same for Pulse would make the "build artifact of the promoted graph" claim true, let the package carry a `graphHash` for auditing, and stop drafts leaking into generated packages. The cost is that the graph carries blocks, not verbatim component source, so the source-carrying path would need somewhere else to live. Possibly the graph should carry it.

2. **How do we rewrite or vendor imports for tier 1?** Options: inline the imported helper into the emitted file, copy the helper module into the generated package, rewrite the import to a peer dependency, or refuse tier 1 when the source has non-`react` relative imports and fall to tier 2. The fourth is the safest immediate fix and loses the most fidelity.

3. **Is the 8000 character source cap right?** It is a bare constant in `extract.ts` with a large effect on output quality. Nobody has measured what proportion of real components exceed it. That measurement should exist before the number is defended.

4. **Should tier 2 stop inventing styling?** The synthesized body applies four guessed CSS variables as inline styles. An alternative is to emit an unstyled element with the correct interface plus a visible marker, which is less impressive in a demo but does not put invented design decisions into a customer's package.

5. **Do we ever publish generated packages to npm?** Every generated `package.json` is `private: true`. `scripts/publish-packages.mjs` handles only the SDK and CLI. A hosted registry, scoped tokens, and per-customer versioning are all unsolved, and `docs/PHASE2-PULSE.md` explicitly defers it.

6. **What is the smallest honest hardware proof?** One `tokens.h` compiled into one LVGL sketch on one dev board, rendering one promoted accent color, with the graph hash printed on the device. That is a weekend of work and it would convert the entire phase 3 story from Planned to demonstrated. Nothing else in this chapter has a better ratio of effort to credibility.

7. **Does `font-generator` become a product, a proof, or a recruiting artifact?** It is currently the most complete prompt-to-artifact loop in the company and it is not connected to anything else. Left alone it will bit-rot. The choice should be deliberate rather than default.

8. **What happens to `lib/studio2/`?** Roughly 1900 lines of medial-axis property engine, unimported. Either wire it into the studio or delete it, because unreferenced code in a repository reads as a claim, and this one is not currently true.

9. **Should `pretext-components` join `verify:software`?** It has a smoke script and no verification. If it is going to render share previews and MCP thumbnails, its classifier is user-visible behaviour and should be guarded.

---

## Where to look in the code

**Codegen core**

- `src/lib/codegen/pulse.ts` (290 lines): `generatePulsePackage`, `emitComponent`, `sourceComponent`, `synthesizedComponent`, `genericStub`, `propsType`, `tokensTs`, `cssRootBlock`, `indexTs`, `packageJson`, `packageSlug`
- `src/lib/codegen/run.ts` (111 lines): `runPulseCodegen`, `loadScanMarkdownForCodegen`, `loadUploadMarkdown`, `CODEGEN_ROOT`, `FIXTURE_SCANS`. The upload-before-fixture resolution order lives here.

**Structural IR**

- `src/lib/scan/component-interface.ts` (363 lines): `extractComponentInterface`, `findComponentFn`, `resolveInitializer`, `resolvePropsType`, `literalUnion`, `destructuredDefaults`, `findRootElement`, `indexLocalTypes`, `propsFromFcAnnotation`
- `src/lib/scan/extract.ts`: `COMPONENT_SOURCE_CAP` (8000), the call site that populates `interface` and `source`
- `src/lib/scan/to-markdown.ts` around lines 210 to 228: the `blocksmith:interface` and `blocksmith:source` writers
- `src/lib/scan/parse.ts` around lines 96 to 118: `parseInterfaceComment`, `parseSourceComment`
- `src/lib/blocks/types.ts`: `ComponentScanMeta`, `ComponentDoc`, `DesignSystem`

**Scripts**

- `scripts/codegen-pulse.ts`: the CLI entry, reads `BLOCKSMITH_DOC`, loads `.env.local`
- `scripts/verify-pulse.ts`: the faithfulness guard and its four assertions
- `scripts/verify-component-interface.ts`: five extractor shape cases
- `scripts/ensure-pulse.mjs`: `postinstall` hook and its recursion guard
- `scripts/compile-device.ts`: the device and header driver, `--doc` and `--frame` flags
- `scripts/guard-build.mjs`: refuses a production build while `next dev` runs

**Packages**

- `packages/pulse-runtime/src/Surface.tsx`, `Text.tsx`, `index.ts`
- `packages/generated/acme-ui-kit/` (gitignored, rebuilt by `npm run build:pulse`)
- `packages/pretext-components/src/` and `src/react/`
- `src/lib/pretext-components/adapter.ts`, `scripts/pretext-components/test-gallery.ts`

**Compile targets**

- `src/lib/ir/targets/device-sim.ts`: `DEVICE_FRAMES`, `MIN_TOUCH_MM`, `compileDeviceSim`, `deviceCompileLoss`, `hexToRgbInt`
- `src/lib/ir/targets/c-header.ts`: `emitTokensHeader`, `cName`
- `src/lib/design-tokens/style-dictionary.ts`: `buildStyleDictionaryTargets`

**Demo routes**

- `src/app/demo/pulse/page.tsx` and `src/components/demo/PulseDemo.tsx`
- `src/app/demo/device/page.tsx` and `src/components/demo/DeviceSimDemo.tsx`
- `src/app/demo/investor/page.tsx` and `src/components/demo/InvestorDemo.tsx`

**Consumer surfaces**

- `src/app/api/v1/codegen/pulse/route.ts`
- `packages/sdk/src/client.ts` (`codegen.pulse`)
- `packages/cli/src/cli.ts` (`cmdCodegen`)
- `src/lib/mcp/blocksmith-server.ts` (the `pulse_codegen` tool) and `src/mcp/handlers.ts` (`handlePulseCodegen`)

**Fixtures**

- `fixtures/vendor-ui/src/components/ui/`: `Badge.tsx`, `Button.tsx`, `Card.tsx`, `Input.tsx`
- `fixtures/vendor-ui/scan-snapshot.md` and `fixtures/vendor-ui/.blocksmith/scan-snapshot.md`
- `data/uploads/scan-acme-ui-kit.md` (gitignored, local, shadows the fixture)

**Wiki font resolution (not `font-generator`)**

- `src/lib/fonts/font-resolve.ts`, `font-stack.ts`, `google-font-catalog.ts`, `google-map.ts`, `load-google-fonts.ts`, `resolve-wiki-fonts.ts`. This layer maps a scanned typography table onto loadable Google Fonts for the wiki. It shares nothing with the font generator.

**`font-generator/` (nested submodule, port 3939)**

- `ARCHITECTURE.md`, `README.md`, `THIRD_PARTY_NOTICES.md`
- `lib/fontCatalog.ts`: the eight bundled fonts with real `fvar` ranges, `clampAxis`, `fontFaceStyle`
- `lib/types.ts`: `FontParams`, `sanitizeParams`, `DEFAULT_PARAMS`
- `lib/genShape.ts`: `ShapeParams`, `applyShaping`, `hashSeed`, `waveField`, `shapedAdvance`, `isIdentityShape`
- `lib/instanceFont.ts`: HarfBuzz wasm bindings, `instanceFont`
- `lib/glyphOutline.ts`: `getGlyphOutline`, `buildEditedFont`, `instanceParams`, `CHARSET`
- `lib/sfnt.ts`: `upsertTable`, `buildKernTable`, `patchTrackingIntoHmtx`
- `lib/studio2/`: the unwired medial-axis property engine
- `components/GlyphEditor.tsx`, `components/GlyphInspector.tsx`, `components/DesignPanel.tsx`, `components/FontSpecimen.tsx`
- `app/api/generate/route.ts`: the model route, system prompt, retries, `heuristicParams`
- `app/studio/page.tsx`: `needsRebuild`, the live rebuild effect, the `download` handler
- `public/fonts/` (8 TTFs) and `public/hb-subset.wasm`
- Root `tsconfig.json` `exclude` array: the required build exclusion

**Docs**

- `docs/PHASE2-PULSE.md`: the original Pulse plan, v0 scope, non-goals
- `docs/00-thesis.md`: the three phases, including "AI imports tokens, does not write CSS"
- `docs/PITCH-AND-PRODUCT-MODEL.md`: "one design package, multiple compile targets" and the guardrail beside it
- `docs/TEAM-NORTH-STAR.md`: one team, one design system, one package; consumers of promoted blocks; stream C, compile targets
