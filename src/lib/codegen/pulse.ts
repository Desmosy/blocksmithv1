import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { ComponentDoc, DesignSystem } from "@/lib/blocks/types";

export type PulseCodegenResult = {
  outDir: string;
  packageName: string;
  slug: string;
  componentCount: number;
  cssVarCount: number;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function packageSlug(system: DesignSystem): string {
  const fromId = system.id?.trim();
  if (fromId && fromId !== "workspace-scan") return fromId;
  return slugify(system.name.replace(/— workspace scan/i, "").trim()) || "design-system";
}

function writeFile(dir: string, rel: string, content: string): void {
  const full = join(dir, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf-8");
}

function cssRootBlock(system: DesignSystem): string {
  const vars = system.scanCssVars ?? [];
  if (!vars.length) return ":root {}\n";
  const lines = vars.map((v) => `  ${v.name}: ${v.value};`);
  return `:root {\n${lines.join("\n")}\n}\n`;
}

function tokensTs(system: DesignSystem): string {
  const vars = system.scanCssVars ?? [];
  const entries = vars.map((v) => `  "${v.name}": ${JSON.stringify(v.value)},`).join("\n");
  const colors = system.colors
    .map(
      (c) =>
        `  { name: ${JSON.stringify(c.name)}, hex: ${JSON.stringify(c.value)}, cssVar: ${JSON.stringify(c.cssVar)} },`,
    )
    .join("\n");

  return `/** Auto-generated from BlockSmith scan — do not edit */
export const cssVars = {
${entries}
} as const;

export const colors = [
${colors}
] as const;

export type CssVarName = keyof typeof cssVars;
`;
}

/**
 * Faithful by construction: re-emit the component's verbatim scanned source.
 * Token `var(--…)` references resolve against the generated tokens.css. Only
 * used when the source exports the component by name (keeps index.ts valid).
 */
function sourceComponent(comp: ComponentDoc): string | null {
  const src = comp.scan?.source;
  if (!src) return null;
  const named =
    new RegExp(`export\\s+(?:async\\s+)?function\\s+${comp.title}\\b`).test(src) ||
    new RegExp(`export\\s+const\\s+${comp.title}\\b`).test(src);
  if (!named) return null;
  return `/** Auto-generated from scan: ${comp.scan?.sourceFile ?? comp.title} — verbatim source */\n${src.trimEnd()}\n`;
}

/** React attribute helper types we can safely import from "react". */
const REACT_ATTR_RE = /\b([A-Z]\w*(?:HTMLAttributes|SVGAttributes|HTMLProps))\b/g;

/** Base identifiers (for `import`), e.g. `ButtonHTMLAttributes`. */
function reactAttrTypes(extendsTypes: string[]): string[] {
  const found = new Set<string>();
  for (const ext of extendsTypes) {
    for (const m of ext.matchAll(REACT_ATTR_RE)) found.add(m[1]);
  }
  return [...found];
}

/** Full extends strings that reference importable React types (keep generics). */
function importableExtends(extendsTypes: string[]): string[] {
  return extendsTypes.filter((ext) => {
    REACT_ATTR_RE.lastIndex = 0;
    return REACT_ATTR_RE.test(ext);
  });
}

/** Render the props type from the structural IR (only importable extends kept). */
function propsType(comp: ComponentDoc, keepExtends: string[]): string {
  const iface = comp.scan!.interface!;
  const members = iface.props.map(
    (p) => `  ${p.name}${p.optional ? "?" : ""}: ${p.type};`,
  );
  if (iface.hasChildren) members.unshift("  children?: ReactNode;");
  const literal = `{\n${members.join("\n")}\n}`;
  const ext = keepExtends.length
    ? `${keepExtends.join(" & ")} & ${literal}`
    : literal;
  return `export type ${comp.title}Props = ${ext};`;
}

/**
 * Synthesize a real, prop-typed component from the structural IR when verbatim
 * source isn't available — faithful interface (props/variants/root element)
 * even if the body is a token-bound best effort.
 */
function synthesizedComponent(comp: ComponentDoc): string {
  const iface = comp.scan!.interface!;
  const vars = comp.scan?.cssVarsUsed ?? [];
  const surface = vars.find((v) => /surface-1/i.test(v)) ?? "--acme-surface-1";
  const radius = vars.find((v) => /radius/i.test(v)) ?? "--acme-radius-md";
  const space = vars.find((v) => /space/i.test(v)) ?? "--acme-space-4";
  const text = vars.find((v) => /text/i.test(v) && !/muted/i.test(v)) ?? "--acme-text";
  const root = iface.rootElement ?? "div";

  const params: string[] = [];
  if (iface.hasChildren) params.push("children");
  for (const p of iface.props) {
    params.push(p.default ? `${p.name} = ${p.default}` : p.name);
  }
  const destructure = params.length ? `{ ${params.join(", ")} }` : "props";

  // What to render inside: children, else the first string-ish text prop.
  const textProp = iface.props.find((p) =>
    /label|title|text|placeholder/i.test(p.name),
  );
  const inner = iface.hasChildren
    ? "{children}"
    : textProp
      ? `{${textProp.name}}`
      : `${JSON.stringify(comp.title)}`;
  const selfClosing = root === "input" || root === "img" || root === "br";
  const body = selfClosing
    ? `<${root} data-blocksmith-component="${comp.id}" style={style} />`
    : `<${root} data-blocksmith-component="${comp.id}" style={style}>${inner}</${root}>`;

  // Keep extends we can import (full generic form); import their base ids.
  const keepExtends = importableExtends(iface.extendsTypes);
  const reactImports = [
    ...(iface.hasChildren ? ["ReactNode"] : []),
    "CSSProperties",
    ...reactAttrTypes(iface.extendsTypes),
  ];

  return `/** Auto-generated from scan: ${comp.scan?.sourceFile ?? comp.title} — IR-synthesized */
import type { ${reactImports.join(", ")} } from "react";

${propsType(comp, keepExtends)}

export function ${comp.title}(${destructure}: ${comp.title}Props) {
  const style: CSSProperties = {
    backgroundColor: "var(${surface})",
    color: "var(${text})",
    borderRadius: "var(${radius})",
    padding: "var(${space})",
  };
  return (
    ${body}
  );
}
`;
}

function indexTs(components: ComponentDoc[], packageName: string): string {
  const exports = components
    .filter((c) => /^[A-Z]/.test(c.title))
    .map((c) => `export { ${c.title} } from "./components/${c.title}.js";`)
    .join("\n");

  return `/** Auto-generated @blocksmith pulse package — import "${packageName}/tokens.css" in your app */
export { cssVars, colors, type CssVarName } from "./tokens.js";
export { Surface, Text } from "@blocksmith/pulse-runtime";
${exports}
`;
}

function packageJson(packageName: string, slug: string): string {
  return JSON.stringify(
    {
      name: packageName,
      version: "0.1.0",
      description: `BlockSmith pulse codegen — ${slug} (generated from workspace scan)`,
      type: "module",
      main: "./dist/index.js",
      types: "./dist/index.d.ts",
      exports: {
        ".": {
          types: "./dist/index.d.ts",
          import: "./dist/index.js",
        },
        "./tokens.css": "./src/tokens.css",
      },
      files: ["dist", "src/tokens.css"],
      scripts: { build: "tsc" },
      dependencies: {
        "@blocksmith/pulse-runtime": "file:../../pulse-runtime",
      },
      peerDependencies: {
        react: "^18.0.0 || ^19.0.0",
      },
      private: true,
      blocksmith: { generated: true, source: "pulse-codegen" },
    },
    null,
    2,
  );
}

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
`;

/**
 * Emit a component, most-faithful path first:
 *   1. verbatim scanned source (faithful by construction)
 *   2. IR-synthesized real prop signature (faithful interface)
 *   3. generic stub (no IR available — legacy/un-parseable source)
 */
function emitComponent(comp: ComponentDoc): string {
  return (
    sourceComponent(comp) ??
    (comp.scan?.interface ? synthesizedComponent(comp) : genericStub(comp))
  );
}

function genericStub(comp: ComponentDoc): string {
  return `/** Auto-generated stub for ${comp.title} — no structural IR captured */
import type { ReactNode, CSSProperties } from "react";

export type ${comp.title}Props = { children?: ReactNode; style?: CSSProperties };

export function ${comp.title}({ children, style }: ${comp.title}Props) {
  return (
    <div data-blocksmith-component="${comp.id}" style={{ padding: "var(--acme-space-4, 8px)", ...style }}>
      {children ?? "${comp.title}"}
    </div>
  );
}
`;
}

export function generatePulsePackage(
  system: DesignSystem,
  outRoot: string,
): PulseCodegenResult {
  const slug = packageSlug(system);
  const packageName = `@blocksmith/${slug}`;
  const outDir = join(outRoot, slug);

  writeFile(outDir, "package.json", packageJson(packageName, slug));
  writeFile(outDir, "tsconfig.json", TSCONFIG);
  writeFile(outDir, "src/tokens.css", cssRootBlock(system));
  writeFile(outDir, "src/tokens.ts", tokensTs(system));
  writeFile(outDir, "src/index.ts", indexTs(system.components, packageName));

  for (const comp of system.components) {
    if (!/^[A-Z]/.test(comp.title)) continue;
    writeFile(outDir, `src/components/${comp.title}.tsx`, emitComponent(comp));
  }

  return {
    outDir,
    packageName,
    slug,
    componentCount: system.components.length,
    cssVarCount: system.scanCssVars?.length ?? 0,
  };
}
