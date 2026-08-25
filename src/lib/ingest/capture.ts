/**
 * Design capture ingest — image(s) of a design → Style Reference design.md.
 *
 * The design-first entry point: many teams' truth is born in Figma/Canva/Adobe,
 * not a GitHub repo. The browser extension (extension/) captures what the
 * designer sees; a vision model extracts the design system into the same
 * "Style Reference" markdown the wiki already renders (data/uploads/design-*.md
 * format), so captured designs flow through the existing upload → wiki →
 * staging pipeline with zero new UI.
 *
 * Truth precedence: vision-extracted values are VISUAL ESTIMATES. Capture docs
 * ingest like any upload (preview lifecycle — never auto-promoted into a lock),
 * and every generated doc carries a provenance footer saying so.
 */
import { createNvidiaClient } from "@/ai-lab/shared/nvidia-profiles";

export interface CaptureRequest {
  /** PNG/JPEG data URLs (or raw base64) — popup caps at 4 screenshots. */
  images: string[];
  /** URL of the tab the design was captured from (provenance). */
  sourceUrl?: string;
  /** Optional human title, e.g. the Canva document name. */
  title?: string;
}

export interface CaptureResult {
  markdown: string;
  model: string;
}

export interface FigmaVisualEnrichmentRequest {
  images: string[];
  fileName: string;
  fileKey: string;
  frameRefs: Array<{ nodeId: string; name: string }>;
  annotations: Array<{ nodeId: string; nodeName: string; label: string; pinnedProperties: string[] }>;
  structuredSummary: string;
}

export type FigmaAnnotationProposal = {
  nodeId: string;
  category: "Development" | "Interaction" | "Accessibility" | "Content";
  labelMarkdown: string;
  properties: string[];
  confidence: "high" | "medium" | "low";
};

export interface FigmaAnnotationProposalRequest {
  nodes: Array<{ id: string; name: string; type: string; existingAnnotations?: string[] }>;
  images?: string[];
  projectContext?: string;
}

/**
 * Machine-readable draft marker — present until a human reviews the capture
 * and clicks Confirm (which strips it via the source editor API). While the
 * marker is present, the wiki shows the review banner: the capture is a
 * DRAFT PROJECT, not confirmed design truth.
 */
export const CAPTURE_DRAFT_MARKER = "<!-- blocksmith:capture-draft -->";

export function isCaptureDraft(markdown: string): boolean {
  return markdown.includes(CAPTURE_DRAFT_MARKER);
}

/** Remove the draft marker + draft status line (human confirmed the doc). */
export function stripCaptureDraftMarker(markdown: string): string {
  return markdown
    .split("\n")
    .filter(
      (line) =>
        !line.includes(CAPTURE_DRAFT_MARKER) &&
        !/^- Status: \*\*Draft/.test(line.trim()),
    )
    .join("\n")
    .replace(/\n{3,}$/, "\n");
}

const MAX_IMAGES = 4;
/** ~6MB base64 ≈ 4.5MB image — enough for a 2x full-page screenshot. */
const MAX_IMAGE_CHARS = 6 * 1024 * 1024;

function visionModels(): string[] {
  const fromEnv = process.env.NVIDIA_MODEL_VISION?.trim();
  const defaults = [
    "meta/llama-4-maverick-17b-128e-instruct",
    "meta/llama-3.2-90b-vision-instruct",
    "microsoft/phi-3.5-vision-instruct",
  ];
  return fromEnv ? [fromEnv, ...defaults.filter((m) => m !== fromEnv)] : defaults;
}

function apiKeys(): string[] {
  return [
    process.env.NVIDIA_API_KEY?.trim(),
    process.env.NVIDIA_API_KEY_FALLBACK?.trim(),
  ].filter((k, i, a): k is string => Boolean(k) && a.indexOf(k) === i);
}

export function isCaptureConfigured(): boolean {
  return apiKeys().length > 0;
}

export function validateCaptureImages(images: unknown): string[] {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("At least one captured image is required.");
  }
  if (images.length > MAX_IMAGES) {
    throw new Error(`At most ${MAX_IMAGES} captures per design.md.`);
  }
  return images.map((img, i) => {
    if (typeof img !== "string" || !img.trim()) {
      throw new Error(`Capture ${i + 1} is not a valid image.`);
    }
    if (img.length > MAX_IMAGE_CHARS) {
      throw new Error(`Capture ${i + 1} is too large — try a smaller window.`);
    }
    return img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
  });
}

const SYSTEM_PROMPT = `You are BlockSmith's design-system extractor. You are given screenshot(s) of a UI design (from Figma, Canva, Adobe XD, a live website, or any design tool). Extract the design system into a "Style Reference" markdown document.

Rules:
- Output ONLY the markdown document. No preamble, no code fences around the whole document.
- Values you read from pixels are ESTIMATES — give your best single value (e.g. "#1a1a2e"), never ranges.
- Name colors and components by their ROLE in the design (e.g. "Primary CTA", "Card Surface"), never "Color 1".
- Only describe what is visible. Do not invent components that are not in the screenshots.
- The narrative paragraph must capture what makes this design distinctive (shape language, contrast strategy, elevation, density) — write like a senior design engineer, not a caption bot.

Output format (follow exactly):

# <Design Name> — Style Reference
> <one-line design essence>

**Theme:** <light | dark | mixed>

<One rich paragraph describing the design language: palette strategy, typography behavior, shape language, elevation/shadow approach, spacing rhythm.>

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| <Role-based name> | \`#hex\` | \`--color-<slug>\` | <where it is used and why> |

## Tokens — Typography

### <Family or closest match> — <role summary> · \`--font-<slug>\`
- **Substitute:** <widely available fallback fonts>
- **Weights:** <e.g. 400, 600>
- **Sizes:** <observed sizes>
- **Line height:** <observed>
- **Role:** <how type is used across the design>

## Tokens — Spacing & Shape

| Property | Value | Token | Role |
|----------|-------|-------|------|
| Radius | <e.g. 12px> | \`--radius-md\` | <where> |
| Gap | <e.g. 24px> | \`--space-6\` | <where> |

## Components

### <Component name>
- **Role:** <what it is for>
- **Anatomy:** <parts you can see>
- **States observed:** <default / hover / active if visible>
- **Style:** <background, border, radius, padding as estimated values>

## Guidelines

### Do
- <observed convention worth keeping>

### Don't
- <anti-pattern this design clearly avoids>`;

/** Strip an accidental single wrapping code fence; keep inner fences intact. */
function unwrapMarkdown(raw: string): string {
  const t = raw.trim();
  const fenced = t.match(/^```(?:markdown|md)?\n([\s\S]*)\n```$/);
  return (fenced ? fenced[1] : t).trim();
}

export async function extractDesignMarkdownFromImages(
  req: CaptureRequest,
): Promise<CaptureResult> {
  const keys = apiKeys();
  if (keys.length === 0) {
    throw new Error(
      "Capture ingest needs NVIDIA_API_KEY — vision extraction is not configured on this deployment.",
    );
  }
  const images = validateCaptureImages(req.images);

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: [
        `Extract the design system from ${images.length === 1 ? "this screenshot" : `these ${images.length} screenshots (same design, multiple views)`}.`,
        req.title ? `The design is titled "${req.title}".` : "",
        req.sourceUrl ? `It was captured from: ${req.sourceUrl}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
    ...images.map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    })),
  ];

  let lastErr: unknown;
  for (const apiKey of keys) {
    const client = createNvidiaClient(apiKey);
    for (const model of visionModels()) {
      try {
        const completion = await client.chat.completions.create({
          model,
          temperature: 0.3,
          top_p: 0.95,
          max_tokens: 4096,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            // Content parts (multimodal) — cast keeps the OpenAI SDK types happy
            // across the NIM-hosted VLM variants.
            { role: "user", content: userContent as never },
          ],
        });
        const raw = completion.choices[0]?.message?.content ?? "";
        if (!raw.trim()) throw new Error(`Empty response from ${model}`);

        let markdown = unwrapMarkdown(raw);
        if (!markdown.startsWith("# ")) {
          markdown = `# ${req.title || "Captured Design"} — Style Reference\n\n${markdown}`;
        }
        markdown += [
          "\n\n---\n",
          "**Provenance**",
          `- Source: ${req.sourceUrl || "browser capture"}`,
          `- Captured: ${new Date().toISOString()}`,
          `- Extraction: BlockSmith Capture (vision model \`${model}\`)`,
          "- Status: **Draft — pending human review** (values are visual estimates)",
          "",
          CAPTURE_DRAFT_MARKER,
        ].join("\n");

        return { markdown, model };
      } catch (err) {
        lastErr = err;
        console.warn(`[capture] vision model ${model} failed, trying next…`);
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("All vision models failed for capture extraction.");
}

const FIGMA_FUSION_PROMPT = `You are enriching exact structured Figma facts with visual meaning. Output ONLY a markdown appendix beginning with "## Visual Language & Intent".

Rules:
- Do not emit token tables or claim exact numeric values; the structured Figma tree is authoritative for those.
- Describe hierarchy, composition, density, imagery, interaction cues, component roles, and reusable conventions visible across frames.
- Every observation must cite one or more provided Figma node ids in backticks.
- Treat supplied Figma annotations as explicit designer intent and reproduce their meaning under "### Designer annotations" with node ids.
- Separate observed conventions into "### Do" and "### Don't". Do not invent unsupported states or behavior.
- End with "### Evidence" listing each rendered frame name and node id.`;

/** Vision supplies semantics while the Figma tree remains authoritative for values. */
export async function extractFigmaVisualEnrichment(
  req: FigmaVisualEnrichmentRequest,
): Promise<CaptureResult> {
  const keys = apiKeys();
  if (!keys.length) throw new Error("Figma visual fusion needs NVIDIA_API_KEY.");
  const images = validateCaptureImages(req.images);
  const annotationText = req.annotations.length
    ? req.annotations.map((a) => `- ${a.nodeName} (${a.nodeId}): ${a.label}${a.pinnedProperties.length ? ` [pins: ${a.pinnedProperties.join(", ")}]` : ""}`).join("\n")
    : "- None";
  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{
    type: "text",
    text: `File: ${req.fileName} (${req.fileKey})\nRendered frames:\n${req.frameRefs.map((f) => `- ${f.name}: ${f.nodeId}`).join("\n")}\n\nExact structured summary (do not contradict):\n${req.structuredSummary}\n\nDesigner annotations:\n${annotationText}`,
  }, ...images.map((url) => ({ type: "image_url" as const, image_url: { url } }))];

  let lastErr: unknown;
  for (const apiKey of keys) {
    const client = createNvidiaClient(apiKey);
    for (const model of visionModels()) {
      try {
        const completion = await client.chat.completions.create({
          model,
          temperature: 0.2,
          top_p: 0.9,
          max_tokens: 2500,
          messages: [
            { role: "system", content: FIGMA_FUSION_PROMPT },
            { role: "user", content: userContent as never },
          ],
        });
        const markdown = unwrapMarkdown(completion.choices[0]?.message?.content ?? "");
        if (!markdown.startsWith("## Visual Language & Intent")) throw new Error(`Invalid fusion response from ${model}`);
        return { markdown, model };
      } catch (error) {
        lastErr = error;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All vision models failed for Figma fusion.");
}

const ANNOTATION_PROPOSAL_PROMPT = `You create concise, implementation-useful native Figma annotations. Return ONLY a JSON array.
Each item must be: {"nodeId":string,"category":"Development"|"Interaction"|"Accessibility"|"Content","labelMarkdown":string,"properties":string[],"confidence":"high"|"medium"|"low"}.

Rules:
- Use only provided node ids. Produce at most 3 annotations per node and at most 40 total.
- Do not repeat existing annotations.
- Development covers layout, responsive behavior, tokens and implementation constraints.
- Interaction covers states, transitions, triggers and feedback that are visually supported.
- Accessibility covers labels, focus, target size, contrast, reading order and reduced motion.
- Content covers copy behavior, truncation, localization and empty/error states.
- Never invent exact values not present in evidence. Phrase uncertainty explicitly.
- properties may only contain: width, height, fills, strokes, effects, layoutMode, itemSpacing, padding, cornerRadius, opacity, fontSize, lineHeight, letterSpacing.
- labelMarkdown should be actionable and under 280 characters.`;

/** Generate reviewable, node-specific proposals for Figma's native annotations. */
export async function proposeFigmaAnnotations(
  req: FigmaAnnotationProposalRequest,
): Promise<{ proposals: FigmaAnnotationProposal[]; model: string }> {
  const keys = apiKeys();
  if (!keys.length) throw new Error("Annotation proposals need NVIDIA_API_KEY.");
  const nodes = req.nodes.slice(0, 50);
  if (!nodes.length) throw new Error("At least one Figma node is required.");
  const images = req.images?.length ? validateCaptureImages(req.images.slice(0, 4)) : [];
  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    {
      type: "text",
      text: `${req.projectContext ? `Project context: ${req.projectContext}\n` : ""}Nodes:\n${JSON.stringify(nodes, null, 2)}`,
    },
    ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];
  let lastErr: unknown;
  for (const apiKey of keys) {
    const client = createNvidiaClient(apiKey);
    for (const model of visionModels()) {
      try {
        const completion = await client.chat.completions.create({
          model,
          temperature: 0.15,
          max_tokens: 3500,
          messages: [
            { role: "system", content: ANNOTATION_PROPOSAL_PROMPT },
            { role: "user", content: content as never },
          ],
        });
        const raw = completion.choices[0]?.message?.content ?? "";
        const json = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        const parsed = JSON.parse(json) as unknown;
        if (!Array.isArray(parsed)) throw new Error("Proposal response is not an array");
        const ids = new Set(nodes.map((n) => n.id));
        const categories = new Set(["Development", "Interaction", "Accessibility", "Content"]);
        const allowedProperties = new Set(["width", "height", "fills", "strokes", "effects", "layoutMode", "itemSpacing", "padding", "cornerRadius", "opacity", "fontSize", "lineHeight", "letterSpacing"]);
        const proposals = parsed.flatMap((value): FigmaAnnotationProposal[] => {
          if (!value || typeof value !== "object") return [];
          const item = value as Record<string, unknown>;
          if (typeof item.nodeId !== "string" || !ids.has(item.nodeId)) return [];
          if (typeof item.category !== "string" || !categories.has(item.category)) return [];
          if (typeof item.labelMarkdown !== "string" || !item.labelMarkdown.trim()) return [];
          return [{
            nodeId: item.nodeId,
            category: item.category as FigmaAnnotationProposal["category"],
            labelMarkdown: item.labelMarkdown.trim().slice(0, 500),
            properties: Array.isArray(item.properties) ? item.properties.filter((p): p is string => typeof p === "string" && allowedProperties.has(p)) : [],
            confidence: item.confidence === "high" || item.confidence === "low" ? item.confidence : "medium",
          }];
        }).slice(0, 40);
        return { proposals, model };
      } catch (error) {
        lastErr = error;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All annotation proposal models failed.");
}
