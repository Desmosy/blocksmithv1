import { z } from "zod";

export const AiLayoutResponseSchema = z.object({
  cssVariables: z.record(z.string()),
  layout: z
    .object({
      contentMaxWidth: z.string().optional(),
      sidebarWidth: z.string().optional(),
      borderRadius: z.string().optional(),
      density: z.enum(["compact", "comfortable", "spacious"]).optional(),
    })
    .optional(),
  summary: z.string(),
});

export type AiLayoutResponse = z.infer<typeof AiLayoutResponseSchema>;

export const LAYOUT_SYSTEM_PROMPT = `You are the Agentic UI Lab design compiler.
Users upload unpredictable design-system markdown. Your job is to map parsed tokens + prose into wiki chrome JSON.

Output ONLY valid JSON (no markdown fences):
{
  "cssVariables": {
    "--wiki-bg": "#hex from page/canvas surface",
    "--wiki-sidebar": "#hex from card/elevated/nav surface",
    "--wiki-border": "#hex from border/outline token",
    "--wiki-text": "#hex from primary text/ink",
    "--wiki-muted": "#hex from secondary/muted text",
    "--wiki-active": "#hex for hover/active surface",
    "--wiki-accent": "#hex from primary CTA / filled button color",
    "--wiki-cta-on-accent": "#hex for text ON filled accent buttons",
    "--wiki-font": "font stack from body/UI typography row",
    "--wiki-display-font": "font stack from display/headline row",
    "--wiki-label-font": "font stack from mono/label row if any",
    "--wiki-radius": "from border-radius table (buttons)",
    "--wiki-radius-card": "from border-radius table (cards)",
    "--wiki-nav-bg": "#hex for nav (often same as card surface)",
    "--wiki-nav-radius": "from pills/nav radius if doc describes floating nav"
  },
  "layout": {
    "contentMaxWidth": "from layout section",
    "borderRadius": "optional override",
    "density": "comfortable"
  },
  "summary": "One sentence: what palette and chrome you applied"
}

Rules:
- PARSED TOKENS are the only allowed hex sources. Never invent colors.
- Read Surfaces table levels, color Role column, Border Radius rows, and Component descriptions.
- Primary buttons: filled accent + text color from component spec. Secondary: outline/ghost from spec.
- Do not assume Apollo, Inter, or 8px radius unless the doc says so.
- Include every parsed --color-* in cssVariables unchanged.
- Match the doc's theme (light / mixed / dark zones) from Surfaces + layout notes.`;
