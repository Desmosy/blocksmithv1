/**
 * Full wiki shell chrome from Design IR — generic selectors, no brand lists.
 */

export type WikiChromeCssOptions = {
  /** When true, prefix rules with html.design-wiki-applied for document-level overrides */
  documentLevel?: boolean;
};

export function buildWikiChromeCss(
  properties: Record<string, string>,
  options: WikiChromeCssOptions = {},
): string {
  const radius = properties["--wiki-radius"] ?? "8px";
  const cardRadius = properties["--wiki-radius-card"] ?? radius;
  const root = options.documentLevel ? "html.design-wiki-applied" : "html";
  const shell = `${root} .apollo-tokens-root`;

  return `
${root} {
  --font-sans: var(--wiki-font);
}
${root},
${root} body,
${root} body.font-sans {
  font-family: var(--wiki-font) !important;
  background-color: var(--wiki-bg) !important;
  color: var(--wiki-text) !important;
}
${shell} {
  background-color: var(--wiki-bg) !important;
  color: var(--wiki-text) !important;
}
${shell} > div.border-b {
  border-color: var(--wiki-border) !important;
}
${shell} aside {
  background-color: var(--wiki-sidebar) !important;
  border-color: var(--wiki-border) !important;
}
${shell} main {
  background-color: var(--wiki-bg) !important;
}
${shell} p,
${shell} li,
${shell} span,
${shell} label,
${shell} dd,
${shell} dt,
${shell} td,
${shell} th,
${shell} input,
${shell} select,
${shell} textarea,
${shell} a:not([class*="text-red"]):not([class*="bg-red"]) {
  font-family: var(--wiki-font) !important;
  letter-spacing: var(--wiki-body-tracking, normal);
  font-feature-settings: var(--wiki-font-features, normal);
}
${shell} h1,
${shell} h2,
${shell} h3,
${shell} h4,
${shell} h5,
${shell} h6,
${shell} .text-3xl,
${shell} .text-2xl,
${shell} article h1,
${shell} article h2 {
  font-family: var(--wiki-display-font, var(--wiki-font)) !important;
  color: var(--wiki-text) !important;
  letter-spacing: var(--wiki-heading-tracking, -0.02em);
  font-feature-settings: var(--wiki-font-features, normal);
}
${shell} button,
${shell} .wiki-cta-primary,
${shell} .wiki-cta-secondary {
  font-family: var(--wiki-font) !important;
}
${shell} .font-mono,
${shell} [class*="font-mono"] {
  font-family: var(--wiki-label-font, var(--wiki-font)) !important;
}
${shell} [class*="text-\\[var\\(--wiki-muted\\)\\]"],
${shell} .text-\\[var\\(--wiki-muted\\)\\] {
  color: var(--wiki-muted) !important;
}
${shell} [class*="rounded-2xl"],
${shell} [class*="rounded-xl"],
${shell} [class*="rounded-lg"],
${shell} [class*="rounded-md"],
${shell} .design-preview,
${shell} .apollo-preview {
  border-radius: ${cardRadius} !important;
}
${shell} button[class*="rounded-full"],
${shell} input[class*="rounded-full"] {
  border-radius: ${radius} !important;
}
${shell} input:not([type="checkbox"]):not([type="radio"]),
${shell} textarea,
${shell} select {
  background-color: var(--wiki-bg) !important;
  color: var(--wiki-text) !important;
  border-color: var(--wiki-border) !important;
  border-radius: ${radius} !important;
}
${shell} input::placeholder,
${shell} textarea::placeholder {
  color: var(--wiki-muted) !important;
}
${shell} a {
  color: var(--wiki-text);
}
${shell} a:hover {
  color: var(--wiki-accent);
}
${shell} hr,
${shell} [class*="divide-"] {
  border-color: var(--wiki-border) !important;
}
${shell} table {
  border-color: var(--wiki-border) !important;
}
${shell} [class*="border-\\[var\\(--wiki-border\\)\\]"],
${shell} [class*="border-[var(--wiki-border)]"] {
  border-color: var(--wiki-border) !important;
}
${shell} [class*="bg-\\[var\\(--wiki-sidebar\\)\\]"],
${shell} [class*="bg-[var(--wiki-sidebar)]"] {
  background-color: var(--wiki-sidebar) !important;
}
${shell} [class*="bg-\\[var\\(--wiki-bg\\)\\]"],
${shell} [class*="bg-[var(--wiki-bg)]"] {
  background-color: var(--wiki-bg) !important;
}
${shell} [class*="bg-\\[var\\(--wiki-active\\)\\]"],
${shell} [class*="bg-[var(--wiki-active)]"] {
  background-color: var(--wiki-active) !important;
}
${shell} [class*="hover\\:bg-\\[var\\(--wiki-active\\)\\]"]:hover {
  background-color: var(--wiki-active) !important;
}
${shell} [class*="text-emerald"],
${shell} .text-emerald-600,
${shell} .text-emerald-700 {
  color: var(--wiki-accent) !important;
}
${shell} [class*="bg-green-600"],
${shell} button.bg-green-600 {
  background-color: var(--wiki-accent) !important;
  color: var(--wiki-cta-on-accent, var(--wiki-text)) !important;
}
.wiki-cta-primary {
  display: inline-flex;
  align-items: center;
  font-weight: 500;
  padding: 12px 24px;
  border-radius: ${radius};
  border: 1px solid var(--wiki-border);
  color: var(--wiki-text);
  background: transparent;
}
${shell} .wiki-cta-primary,
${root} .wiki-cta-primary {
  background-color: var(--wiki-cta-fill, var(--wiki-accent)) !important;
  color: var(--wiki-cta-on-accent, var(--wiki-text)) !important;
  border: var(--wiki-cta-border, none) !important;
  border-radius: ${radius} !important;
  box-shadow: var(--wiki-card-shadow, none) !important;
}
${shell} .wiki-cta-primary:hover,
${root} .wiki-cta-primary:hover {
  filter: brightness(0.95);
}
${shell} .wiki-cta-secondary,
${root} .wiki-cta-secondary {
  display: inline-flex;
  align-items: center;
  background: transparent !important;
  color: var(--wiki-text) !important;
  border: 1px solid var(--wiki-border) !important;
  border-radius: ${radius} !important;
  font-weight: 500;
  padding: 12px 24px;
  box-shadow: none !important;
}
${shell} .wiki-surface-card,
${root} .wiki-surface-card,
${shell} .wiki-surface-swatch {
  background-color: var(--wiki-sidebar) !important;
  border: var(--wiki-card-border, none) !important;
  border-radius: ${cardRadius} !important;
  box-shadow: var(--wiki-card-shadow, none) !important;
}
/*
 * The top nav (> header) is intentionally NOT styled here. It is frozen product
 * chrome driven by --chrome-nav-* in TopNav.tsx, so Visualize / AI layout can
 * never restyle or reshape the global header. See blocksmith-chrome.css.
 */
${shell} aside {
  border-right: 1px solid color-mix(in srgb, var(--wiki-border) 20%, transparent) !important;
}
${shell} aside a.rounded-md:hover,
${shell} aside a:hover {
  background-color: color-mix(in srgb, var(--wiki-sidebar) 78%, var(--wiki-border) 22%) !important;
  color: var(--wiki-text) !important;
}
${shell} button:not([class*="bg-red"]):not([class*="text-red"]):not([disabled]):not(.wiki-cta-primary):not(.wiki-cta-secondary) {
  border-radius: ${radius};
}
${shell} .apollo-preview button[type="button"]:not(.wiki-cta-primary):not(.wiki-cta-secondary) {
  font-family: var(--wiki-font) !important;
}
`.trim();
}
