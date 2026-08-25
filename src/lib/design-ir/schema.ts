import { z } from "zod";
import type {
  ColorToken,
  ComponentDoc,
  DesignSystem,
  SpacingToken,
  SurfaceRow,
  TypographyFamily,
  TypeScaleRow,
} from "@/lib/blocks/types";

export const DESIGN_IR_VERSION = 1 as const;
/** Bump when compileWikiChrome / token resolution logic changes */
export const DESIGN_IR_COMPILER_REV = 12;

const colorTokenSchema = z.object({
  name: z.string(),
  value: z.string(),
  cssVar: z.string(),
  role: z.string(),
  group: z.string(),
});

const typographySchema = z.object({
  name: z.string(),
  cssVar: z.string(),
  substitute: z.string(),
  weights: z.string(),
  sizes: z.string(),
  lineHeight: z.string(),
  letterSpacing: z.string(),
  role: z.string(),
});

export const wikiChromeSchema = z.object({
  cssVariables: z.record(z.string()),
});

export const previewTokensSchema = z.object({
  accent: z.string(),
  pageBackground: z.string(),
  cardBackground: z.string(),
  border: z.string(),
  text: z.string(),
  buttonRadius: z.string(),
  cardRadius: z.string(),
  ctaOnAccent: z.string().optional(),
  navFloatingPill: z.boolean().optional(),
  navRadius: z.string().optional(),
});

export const designIRSchema = z.object({
  version: z.literal(1),
  compilerRev: z.number().optional(),
  docRef: z.string(),
  systemId: z.string(),
  systemName: z.string(),
  contentHash: z.string(),
  updatedAt: z.string(),
  sourcePath: z.string(),
  mode: z.enum(["apollo", "generic", "workspace-scan"]),
  theme: z.string(),
  tokens: z.object({
    colors: z.array(colorTokenSchema),
    typography: z.array(typographySchema),
    typeScale: z.array(
      z.object({
        role: z.string(),
        size: z.string(),
        lineHeight: z.string(),
        letterSpacing: z.string(),
        token: z.string(),
      }),
    ),
    spacing: z.array(
      z.object({
        name: z.string(),
        value: z.string(),
        token: z.string(),
      }),
    ),
    borderRadius: z.array(
      z.object({ element: z.string(), value: z.string() }),
    ),
    layout: z.array(z.object({ label: z.string(), value: z.string() })),
    surfaces: z.array(
      z.object({
        level: z.string(),
        name: z.string(),
        value: z.string(),
        purpose: z.string(),
      }),
    ),
    components: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        role: z.string(),
        description: z.string(),
      }),
    ),
  }),
  wikiChrome: wikiChromeSchema,
  preview: previewTokensSchema,
  fontStacks: z.record(z.string()),
  colorVariables: z.record(z.string()),
  fontResolutions: z
    .record(
      z.object({
        googleFamily: z.string(),
        weights: z.array(z.number()),
        sourceName: z.string(),
        reason: z.string().optional(),
        model: z.string().optional(),
      }),
    )
    .optional(),
  fontResolveRev: z.number().optional(),
});

export type DesignIR = z.infer<typeof designIRSchema>;

export type DesignIRTokens = DesignIR["tokens"];

/** Subset of DesignSystem fields stored in IR */
export function tokensFromSystem(
  system: DesignSystem & { mode?: string },
): DesignIRTokens {
  return {
    colors: system.colors,
    typography: system.typography,
    typeScale: system.typeScale,
    spacing: system.spacing,
    borderRadius: system.borderRadius,
    layout: system.layout,
    surfaces: system.surfaces,
    components: system.components,
  };
}

export type { ColorToken, TypographyFamily, SpacingToken, SurfaceRow, TypeScaleRow, ComponentDoc };
