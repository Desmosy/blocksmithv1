/**
 * The judgement layer over a captured design system.
 *
 * Everything else in capture is measurement: which colours cover the page,
 * what a button is made of, how many times a card appears. A person writing
 * the same system adds the part measurement cannot — why the pill is the
 * signature, why the card sits flat, what never to do. That needs a model.
 *
 * The model is given only the measured facts and asked only for judgement.
 * Every line it returns is checked against the fact sheet: a do, a don't or
 * a component note that cites no value from this document is dropped. The
 * model can be wrong about taste; it cannot introduce a colour the page does
 * not have.
 *
 * Best-effort throughout. No key, a timeout, bad JSON — the document is
 * returned exactly as it was, which is what capture produced before this
 * layer existed.
 */

import { createNvidiaClient, getNvidiaProfile } from "@/ai-lab/shared/nvidia-profiles";

export type CaptureFacts = {
  title: string;
  host: string;
  colors: { name: string; value: string; role: string }[];
  typefaces: { name: string; substitute: string }[];
  spacing: number[];
  radii: number[];
  components: { name: string; role: string; spec: string; count: number }[];
};

export type RationaleResult = {
  markdown: string;
  applied: boolean;
  model: string | null;
  /** Why nothing was applied, for the caller's diagnostics. */
  reason?: string;
};

type Draft = {
  tagline?: string;
  overview?: string;
  componentNotes?: Record<string, string>;
  dos?: string[];
  donts?: string[];
  similarBrands?: { name: string; note: string }[];
};

const TIMEOUT_MS = Number(process.env.BLOCKSMITH_RATIONALE_TIMEOUT_MS ?? 25_000);

function apiKey(): string | null {
  return process.env.NVIDIA_API_KEY?.trim() || process.env.NVIDIA_API_KEY_FALLBACK?.trim() || null;
}

export function rationaleModel(): string {
  // A text model, fast enough to sit inside a capture. The "parser" profile
  // is that already; override per deployment without touching code.
  return process.env.NVIDIA_MODEL_RATIONALE?.trim() || getNvidiaProfile("parser").model;
}

export function isRationaleEnabled(): boolean {
  return process.env.BLOCKSMITH_CAPTURE_RATIONALE !== "0" && apiKey() !== null;
}

const SYSTEM = `You write design-system documentation in the voice of a senior product designer describing a system they built: specific, declarative, no marketing language.

You are given measured facts about one website: its colours, typefaces, spacing, radii and components, with exact values. Your job is judgement, not description — say what the choices mean and how to use them.

Rules, all strict:
- Cite only values that appear in the facts (hex colours, px values, typeface names, component names). Never introduce a colour, size or font that is not listed.
- Every "do" and "don't" must name at least one concrete value or component from the facts.
- Component notes: one sentence each, keyed by the exact component name, saying when to reach for it or what makes it distinctive. Only for components that are listed.
- Prefer the concrete over the general: "Use #0d1738 only for headings" beats "keep text readable".
- Return JSON only, no prose around it, matching:
{"tagline": "<= 12 words", "overview": "2-3 sentences", "componentNotes": {"<name>": "<sentence>"}, "dos": ["..."], "donts": ["..."], "similarBrands": [{"name": "...", "note": "..."}]}
- 5 to 7 dos, 5 to 7 donts, up to 3 similar brands (real, well-known products whose design reads similarly, with one clause on why).`;

function factSheet(f: CaptureFacts): string {
  return JSON.stringify(
    {
      title: f.title,
      site: f.host,
      colours: f.colors.map((c) => ({ name: c.name, value: c.value, role: c.role })),
      typefaces: f.typefaces.map((t) => ({ name: t.name, fallback: t.substitute })),
      spacingPx: f.spacing,
      radiiPx: f.radii,
      components: f.components.map((c) => ({
        name: c.name,
        role: c.role,
        spec: c.spec.slice(0, 220),
        seen: c.count,
      })),
    },
    null,
    0,
  );
}

/** Tokens a sentence may legitimately cite: anything measured. */
function groundingTerms(f: CaptureFacts): string[] {
  const terms = new Set<string>();
  for (const c of f.colors) { terms.add(c.value.toLowerCase()); terms.add(c.name.toLowerCase()); }
  for (const t of f.typefaces) terms.add(t.name.toLowerCase());
  for (const n of f.spacing) terms.add(`${n}px`);
  for (const n of f.radii) terms.add(`${n}px`);
  for (const c of f.components) terms.add(c.name.toLowerCase());
  return [...terms].filter((t) => t.length >= 3);
}

function grounded(line: string, terms: string[]): boolean {
  const l = line.toLowerCase();
  return terms.some((t) => {
    // Values like "#f5f3f1" and "16px" can be matched as substrings; a name
    // like "Ink" must be a whole word, or "think" counts as citing a colour.
    if (/^[#\d]/.test(t)) return l.includes(t);
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${esc}(?![a-z0-9])`).test(l);
  });
}

function parseDraft(raw: string): Draft | null {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Draft;
  } catch {
    return null;
  }
}

/** Keep only what the facts support. */
function validate(draft: Draft, facts: CaptureFacts): Draft {
  const terms = groundingTerms(facts);
  const names = new Set(facts.components.map((c) => c.name));
  const clean = (arr?: string[]) =>
    (arr ?? []).map((s) => String(s).trim()).filter((s) => s.length >= 20 && s.length <= 320 && grounded(s, terms)).slice(0, 7);
  const notes: Record<string, string> = {};
  for (const [k, v] of Object.entries(draft.componentNotes ?? {})) {
    const s = String(v).trim();
    if (names.has(k) && s.length >= 20 && s.length <= 320) notes[k] = s;
  }
  const brands = (draft.similarBrands ?? [])
    .filter((b) => b && typeof b.name === "string" && typeof b.note === "string")
    .map((b) => ({ name: b.name.trim().slice(0, 40), note: b.note.trim().slice(0, 200) }))
    .filter((b) => b.name && b.note)
    .slice(0, 3);
  const tagline = typeof draft.tagline === "string" && draft.tagline.trim().length <= 90 ? draft.tagline.trim() : undefined;
  const overview =
    typeof draft.overview === "string" && draft.overview.trim().length >= 60 && draft.overview.trim().length <= 700 && grounded(draft.overview, terms)
      ? draft.overview.trim()
      : undefined;
  return { tagline, overview, componentNotes: notes, dos: clean(draft.dos), donts: clean(draft.donts), similarBrands: brands };
}

/** Weave the validated judgement into the measured document. */
export function mergeRationale(markdown: string, draft: Draft, provenance?: string): { markdown: string; changed: boolean } {
  let md = markdown;
  let changed = false;

  // Tagline: a blockquote directly under the H1, replacing one if present.
  if (draft.tagline) {
    const h1 = md.match(/^# .+\n/m);
    if (h1) {
      const after = md.slice(h1.index! + h1[0].length);
      if (/^\s*> /.test(after)) {
        md = md.replace(/^(# .+\n\s*)> .*$/m, `$1> ${draft.tagline}`);
      } else {
        md = md.slice(0, h1.index! + h1[0].length) + `\n> ${draft.tagline}\n` + after;
      }
      changed = true;
    }
  }

  // Overview: last paragraph of the intro, before the first section.
  if (draft.overview) {
    const firstSection = md.search(/^## /m);
    if (firstSection > 0) {
      md = md.slice(0, firstSection).replace(/\s*$/, "\n\n") + draft.overview + "\n\n" + md.slice(firstSection);
      changed = true;
    }
  }

  // Component notes: one sentence after each component's spec.
  for (const [name, note] of Object.entries(draft.componentNotes ?? {})) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^### ${esc}\\n(?:\\*\\*Role:\\*\\* [^\\n]*\\n)?\\n?[^\\n]+\\n)`, "m");
    if (re.test(md)) {
      md = md.replace(re, `$1\n${note}\n`);
      changed = true;
    }
  }

  // Do / Don't: replace the lists when the model produced enough grounded ones.
  const swapList = (heading: "Do" | "Don't", items?: string[]) => {
    if (!items || items.length < 3) return;
    const re = new RegExp(`(^### ${heading.replace("'", "'")}\\n)((?:- .*\\n?)+)`, "m");
    if (re.test(md)) {
      md = md.replace(re, `$1${items.map((i) => `- ${i}`).join("\n")}\n`);
      changed = true;
    }
  };
  swapList("Do", draft.dos);
  swapList("Don't", draft.donts);

  // Similar brands: replace the section body.
  if (draft.similarBrands && draft.similarBrands.length) {
    const re = /(^## Similar Brands\n)([\s\S]*?)(?=^## |(?![\s\S]))/m;
    if (re.test(md)) {
      const body = "\n" + draft.similarBrands.map((b) => `- **${b.name}** — ${b.note}`).join("\n") + "\n\n";
      md = md.replace(re, `$1${body}`);
      changed = true;
    }
  }

  if (changed && provenance) {
    const re = /(^## Similar Brands\n[\s\S]*?)(?=^## |(?![\s\S]))/m;
    md = re.test(md) ? md.replace(re, `$1_${provenance}_\n\n`) : md + `\n_${provenance}_\n`;
  }
  return { markdown: md, changed };
}

/**
 * Add judgement to a captured document.
 *
 * `complete` can be injected for tests; in production it is the NVIDIA client.
 */
export async function addRationale(
  markdown: string,
  facts: CaptureFacts,
  complete?: (system: string, user: string) => Promise<string>,
): Promise<RationaleResult> {
  if (!complete) {
    if (!isRationaleEnabled()) return { markdown, applied: false, model: null, reason: "not configured" };
    const key = apiKey()!;
    const model = rationaleModel();
    const client = createNvidiaClient(key);
    complete = async (system, user) => {
      const res = await client.chat.completions.create(
        {
          model,
          temperature: 0.3,
          top_p: 0.9,
          max_tokens: 1800,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
        { timeout: TIMEOUT_MS },
      );
      return res.choices[0]?.message?.content ?? "";
    };
  }

  const model = process.env.NVIDIA_MODEL_RATIONALE?.trim() || (isRationaleEnabled() ? rationaleModel() : "injected");
  try {
    const raw = await complete(SYSTEM, `Facts:\n${factSheet(facts)}\n\nReturn the JSON.`);
    const draft = parseDraft(raw);
    if (!draft) return { markdown, applied: false, model, reason: "unparseable response" };
    const safe = validate(draft, facts);
    const { markdown: out, changed } = mergeRationale(
      markdown,
      safe,
      `Rationale drafted by ${model} from the measured values above; every claim cites a value in this document.`,
    );
    return changed
      ? { markdown: out, applied: true, model }
      : { markdown, applied: false, model, reason: "nothing grounded to add" };
  } catch (err) {
    return { markdown, applied: false, model, reason: err instanceof Error ? err.message : "failed" };
  }
}
