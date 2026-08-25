/**
 * c-header compile target — Phase 2 of device honesty (research doc §5.7).
 *
 * Emits a generated tokens.h from the SAME official graph the wiki renders.
 * The embedded engineer gets a token table traceable to block versions —
 * not a screenshot or a PDF. Lock hash is stamped in the header so firmware
 * builds can be audited against the design graph that produced them.
 */
import type { BlocksmithGraphV1 } from "../types";
import { hexToRgbInt } from "./device-sim";

function cName(id: string): string {
  return id
    .replace(/^token:/, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export function emitTokensHeader(graph: BlocksmithGraphV1): string {
  const lines: string[] = [
    "/*",
    " * BlockSmith generated design tokens — DO NOT EDIT BY HAND.",
    ` * schema:    ${graph.schema}`,
    ` * docRef:    ${graph.docRef}`,
    ` * graphHash: ${graph.contentHash}`,
    ` * generated: ${new Date().toISOString()}`,
    " *",
    " * Each define is traceable: block id @ version (contentHash).",
    " */",
    "#ifndef BLOCKSMITH_TOKENS_H",
    "#define BLOCKSMITH_TOKENS_H",
    "",
  ];

  const colors = graph.blocks.filter(
    (b) => b.type === "token" && b.id.startsWith("token:color:"),
  );
  if (colors.length) {
    lines.push("/* -- color tokens (0xRRGGBB) -- */");
    for (const b of colors) {
      const hex = (b.content.value as string | undefined) ?? "";
      const rgb = hexToRgbInt(hex);
      if (rgb === undefined) continue;
      lines.push(
        `#define BS_COLOR_${cName(b.id)} 0x${rgb
          .toString(16)
          .toUpperCase()
          .padStart(6, "0")}u /* ${b.id}@v${b.version} ${b.contentHash} */`,
      );
    }
    lines.push("");
  }

  const spacing = graph.blocks.filter(
    (b) => b.type === "token" && b.id.startsWith("token:spacing:"),
  );
  if (spacing.length) {
    lines.push("/* -- spacing tokens (px) -- */");
    for (const b of spacing) {
      const value = (b.content.value as string | undefined) ?? "";
      const px = value.match(/([\d.]+)\s*px/);
      if (!px) continue;
      lines.push(
        `#define BS_SPACE_${cName(b.id)} ${Math.round(
          Number(px[1]),
        )} /* ${b.id}@v${b.version} */`,
      );
    }
    lines.push("");
  }

  const surfaces = graph.blocks.filter(
    (b) => b.type === "token" && b.id.startsWith("token:surface:"),
  );
  if (surfaces.length) {
    lines.push("/* -- surface levels (0xRRGGBB) -- */");
    for (const b of surfaces) {
      const rgb = hexToRgbInt((b.content.value as string | undefined) ?? "");
      if (rgb === undefined) continue;
      lines.push(
        `#define BS_SURFACE_${cName(b.id)} 0x${rgb
          .toString(16)
          .toUpperCase()
          .padStart(6, "0")}u /* ${b.id}@v${b.version} */`,
      );
    }
    lines.push("");
  }

  lines.push("#endif /* BLOCKSMITH_TOKENS_H */", "");
  return lines.join("\n");
}
