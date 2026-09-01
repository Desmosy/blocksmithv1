import type { DesignSystem } from "@/lib/blocks/types";

/**
 * Turning an agent's component into something a browser will render.
 *
 * Shared by the inline preview on the Governance page and by the standalone
 * frame route, so the small version a reviewer glances at and the full-page
 * version they open are the same document at two sizes — not two renderers
 * that can disagree about what the agent actually built.
 *
 * No scripts, in either. A proposal is third-party output; the inline preview
 * withholds `allow-scripts` and the route's own CSP says `script-src 'none'`.
 * Markup and CSS render, which covers inline SVG; canvas and WebGL do not run,
 * and that is the intended trade.
 */

/** JSX an agent wrote → HTML a browser will accept. */
export function toRenderableHtml(code: string): string {
  return code
    .replace(/className=/g, "class=")
    // style={{ a: 1, b: "x" }} → style="a: 1; b: x"
    .replace(/style=\{\{([\s\S]*?)\}\}/g, (_m, body: string) => {
      const decls = String(body)
        .split(",")
        .map((pair) => {
          const [rawKey, ...rest] = pair.split(":");
          const key = rawKey?.trim().replace(/["']/g, "");
          const value = rest.join(":").trim().replace(/["']/g, "");
          if (!key || !value) return "";
          const prop = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
          const needsPx =
            /^\d+(\.\d+)?$/.test(value) &&
            !/^(flex|order|z-index|opacity|line-height|font-weight)$/.test(prop);
          return `${prop}: ${value}${needsPx ? "px" : ""}`;
        })
        .filter(Boolean);
      return `style="${decls.join("; ")}"`;
    })
    // Drop an export/function wrapper and a bare `return (`.
    .replace(/^[\s\S]*?return\s*\(/, "")
    .replace(/\);?\s*\}?\s*$/, "")
    .trim();
}

/** The system's tokens as custom properties, so the proposal renders in them. */
export function tokenCss(system: DesignSystem): string {
  const lines: string[] = [];
  for (const c of system.colors) {
    if (c.cssVar?.startsWith("--")) lines.push(`${c.cssVar}: ${c.value};`);
  }
  for (const s of system.spacing) {
    if (s.token?.startsWith("--")) lines.push(`${s.token}: ${s.value};`);
  }
  for (const t of system.typeScale) {
    if (t.token?.startsWith("--")) lines.push(`${t.token}: ${t.size};`);
  }
  return `:root { ${lines.join(" ")} }`;
}

/** Ground, ink and body face, read from the system's own declared roles. */
export function chromeOf(system: DesignSystem): {
  ground: string;
  ink: string;
  family: string;
} {
  const ground =
    system.colors.find((c) =>
      /background|canvas|page|ground|paper|sheet/i.test(c.role || ""),
    )?.value ?? "#ffffff";
  const ink =
    system.colors.find((c) => /primary text|body|ink/i.test(c.role || ""))?.value ??
    "#111111";
  const family =
    system.typography[1]?.name ?? system.typography[0]?.name ?? "sans-serif";
  return { ground, ink, family };
}

/**
 * The full document.
 *
 * `standalone` is the difference between a card on a review page and the thing
 * itself: the inline preview is measured by its parent and must not scroll, so
 * it hides overflow and carries its own padding. A full page scrolls, fills the
 * viewport, and has no padding of its own — a landing page with a 24px inset on
 * every side is not what the agent built.
 */
export function buildProposalDocument(
  code: string,
  system: DesignSystem,
  opts: { standalone?: boolean } = {},
): string {
  const body = toRenderableHtml(code);
  const { ground, ink, family } = chromeOf(system);
  const standalone = opts.standalone === true;

  const frameCss = standalone
    ? `html,body { margin:0; padding:0; min-height:100%; background:${ground}; color:${ink};
    font-family:"${family}", ui-sans-serif, system-ui, sans-serif; }`
    : `html,body { margin:0; padding:24px; overflow:hidden; background:${ground}; color:${ink};
    font-family:"${family}", ui-sans-serif, system-ui, sans-serif; }`;

  return `<!doctype html><html><head><meta charset="utf-8">${
    standalone
      ? '\n<meta name="viewport" content="width=device-width, initial-scale=1">'
      : ""
  }
<style>
  ${tokenCss(system)}
  ${frameCss}
  * { box-sizing:border-box; }
  img,svg { max-width:100%; }
</style></head><body>${body}</body></html>`;
}
