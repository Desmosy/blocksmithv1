import type { ShareBlockKind } from "./types";

export function surfaceBlockId(level: string, name: string): string {
  return `level-${level}-${slugify(name)}`;
}

export function colorBlockId(cssVar: string): string {
  return cssVar.replace(/^--/, "").replace(/\//g, "-");
}

export function isShareBlockKind(value: string): value is ShareBlockKind {
  return value === "component" || value === "surface" || value === "color";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
