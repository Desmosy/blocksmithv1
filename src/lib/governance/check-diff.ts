import type { ComponentDoc } from "@/lib/blocks/types";
import { loadDesignSystem } from "@/lib/clients/registry";
import { findOffTokenColors, nearestToken, paletteFromColors } from "./color-lint";
import { compileProseRules, scanProseViolations } from "./prose-lint";
import type { GovernanceFinding } from "./types";

export function resolveComponentInSystem(
  system: ReturnType<typeof loadDesignSystem>,
  query: string,
): ComponentDoc | null {
  const q = query.toLowerCase().trim();
  const slug = q.replace(/\s+/g, "-");
  return (
    system.components.find(
      (c) =>
        c.id === q ||
        c.id === slug ||
        c.id.endsWith(`-${slug}`) ||
        c.id.includes(slug) ||
        c.title.toLowerCase().includes(q),
    ) ?? null
  );
}

function inferComponentFromPath(
  system: ReturnType<typeof loadDesignSystem>,
  filePath: string,
): ComponentDoc | null {
  const path = filePath.toLowerCase().replace(/\\/g, "/");
  for (const comp of system.components) {
    const id = comp.id.toLowerCase();
    const slug = comp.title.toLowerCase().replace(/\s+/g, "");
    if (path.includes(`/${id}.`) || path.includes(`/${id}/`) || path.includes(slug)) {
      return comp;
    }
  }
  if (path.includes("footer")) {
    return resolveComponentInSystem(system, "footer");
  }
  return null;
}

export function checkGovernanceDiff(args: {
  docRef: string;
  code: string;
  component?: string;
  filePath?: string;
}): {
  docRef: string;
  component: ComponentDoc | null;
  findings: GovernanceFinding[];
  blockCount: number;
  warnCount: number;
  /** True when no block-tier findings (warn-tier may remain). */
  governed: boolean;
} {
  const system = loadDesignSystem(args.docRef);
  let component: ComponentDoc | null = null;

  if (args.component?.trim()) {
    component = resolveComponentInSystem(system, args.component);
  }
  if (!component && args.filePath?.trim()) {
    component = inferComponentFromPath(system, args.filePath);
  }

  const findings: GovernanceFinding[] = [];

  const palette = paletteFromColors(system.colors);
  for (const v of findOffTokenColors(args.code, palette)) {
    const near = nearestToken(v.hex, system.colors);
    const suggestion = near
      ? `Replace ${v.hex} with ${near.cssVar ? `\`${near.cssVar}\` (${near.name}, ${near.hex})` : `${near.name} (${near.hex})`}${near.distance === 0 ? " — exact token match" : ""}.`
      : undefined;
    findings.push({
      ruleId: "off-token-color",
      tier: "block",
      message: `${v.hex} is not a defined design token.`,
      file: args.filePath,
      line: v.line,
      snippet: v.snippet,
      suggestion,
    });
  }

  if (component) {
    const rules = compileProseRules(component);
    findings.push(
      ...scanProseViolations(args.code, rules, { file: args.filePath }),
    );
  }

  const blockCount = findings.filter((f) => f.tier === "block").length;
  const warnCount = findings.filter((f) => f.tier === "warn").length;

  return {
    docRef: args.docRef,
    component,
    findings,
    blockCount,
    warnCount,
    governed: blockCount === 0,
  };
}
