import { z } from "zod";

export const FONT_RESOLVE_REV = 1;

export const fontResolutionSchema = z.object({
  googleFamily: z.string(),
  weights: z.array(z.number()),
  sourceName: z.string(),
  reason: z.string().optional(),
  model: z.string().optional(),
});

export const fontResolveResponseSchema = z.object({
  resolutions: z.array(
    z.object({
      sourceName: z.string(),
      googleFamily: z.string(),
      weights: z.array(z.number()).optional(),
      reason: z.string().optional(),
    }),
  ),
});

export type FontResolveResponse = z.infer<typeof fontResolveResponseSchema>;
