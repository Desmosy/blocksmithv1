import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { generatePulsePackage, type PulseCodegenResult } from "./pulse";
import { parseWorkspaceScanMarkdown } from "@/lib/scan/parse";
import { loadDesignSystem, prepareDesignSystemDoc } from "@/lib/clients/registry";
import type { DesignSystem } from "@/lib/blocks/types";
import {
  isUploadDocRef,
  resolveUploadPath,
  uploadFileNameFromRef,
} from "@/lib/uploads/paths";

export const CODEGEN_ROOT = join(process.cwd(), "packages", "generated");

/** Committed for CI/Vercel — `data/uploads/*.md` is gitignored. */
const FIXTURE_SCANS = [
  join(process.cwd(), "fixtures/vendor-ui/scan-snapshot.md"),
  join(process.cwd(), "fixtures/vendor-ui/.blocksmith/scan-snapshot.md"),
];

function readFixtureScanMarkdown(): string | null {
  for (const path of FIXTURE_SCANS) {
    if (existsSync(path)) return readFileSync(path, "utf-8");
  }
  return null;
}

export type PulseCodegenOutput = PulseCodegenResult & {
  docRef: string;
  resolvedFrom: string;
  importExample: string;
  demoUrl: string;
};

async function loadUploadMarkdown(docRef: string): Promise<{
  markdown: string;
  resolvedFrom: string;
}> {
  const fileName = uploadFileNameFromRef(docRef);
  const localPath = resolveUploadPath(fileName);
  if (existsSync(localPath)) {
    return { markdown: readFileSync(localPath, "utf-8"), resolvedFrom: docRef };
  }

  const fixtureMarkdown = readFixtureScanMarkdown();
  if (fixtureMarkdown && fileName === "scan-acme-ui-kit.md") {
    return {
      markdown: fixtureMarkdown,
      resolvedFrom: FIXTURE_SCANS.find((p) => existsSync(p)) ?? FIXTURE_SCANS[0],
    };
  }

  try {
    const { hydrateUploadMarkdown, readUploadMarkdownContent } = await import(
      "@/lib/uploads/persist"
    );
    await hydrateUploadMarkdown(fileName);
    const markdown = await readUploadMarkdownContent(fileName);
    return { markdown, resolvedFrom: docRef };
  } catch {
    const fallback = readFixtureScanMarkdown();
    if (fallback) {
      return {
        markdown: fallback,
        resolvedFrom:
          FIXTURE_SCANS.find((p) => existsSync(p)) ?? FIXTURE_SCANS[0],
      };
    }
    throw new Error(
      `Scan doc not found: ${docRef}. Run scan first or commit fixture snapshot.`,
    );
  }
}

export async function loadScanMarkdownForCodegen(
  docRef: string,
): Promise<{ markdown: string; resolvedFrom: string }> {
  if (isUploadDocRef(docRef)) {
    return loadUploadMarkdown(docRef);
  }

  const path = join(process.cwd(), docRef);
  if (!existsSync(path)) {
    throw new Error(`Doc not found: ${docRef}`);
  }
  return { markdown: readFileSync(path, "utf-8"), resolvedFrom: path };
}

/**
 * Build the CSS custom properties a bundled design system declares.
 *
 * The scan parser fills `scanCssVars` from a repo's real stylesheet; a Style
 * Reference doc instead declares its tokens across the colour, spacing, type
 * and radius tables. Codegen emits `tokens.css` from `scanCssVars`, so without
 * this the generated package ships `:root {}` and every component references
 * variables that do not exist.
 */
function cssVarsFromDesignSystem(
  system: DesignSystem,
): { name: string; value: string; source: string }[] {
  const out: { name: string; value: string; source: string }[] = [];
  const seen = new Set<string>();
  const push = (name: string | undefined, value: string, source: string) => {
    const varName = name?.trim();
    if (!varName?.startsWith("--") || !value?.trim() || seen.has(varName)) return;
    seen.add(varName);
    out.push({ name: varName, value: value.trim(), source });
  };

  for (const c of system.colors) push(c.cssVar, c.value, "color");
  for (const sp of system.spacing) push(sp.token, sp.value, "spacing");
  for (const t of system.typeScale) push(t.token, t.size, "type");
  for (const r of system.borderRadius) {
    const slug = r.element.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    push(`--radius-${slug}`, r.value, "radius");
  }
  for (const f of system.typography) push(f.cssVar, `"${f.name}", ${f.substitute || "sans-serif"}`, "font");
  return out;
}

/**
 * A captured or pasted system is written in the Style Reference format too.
 *
 * Only a workspace scan produces scan markdown; everything else — a bundled
 * sample, a paste, an upload, a design system read off a live website — is a
 * Style Reference and must go through the same parser the wiki uses. Sending
 * one to the scan parser yields a package with no tokens and no components,
 * and no error to say why.
 *
 * This is what makes "read a website, then install it as a package" true
 * rather than nearly true.
 */
function isStyleReferenceDoc(ref: string): boolean {
  return !/^upload:scan-/.test(ref.trim());
}

/**
 * A bundled design system in `docs/designs.md/` is written in the Style
 * Reference format, not the workspace-scan format. Running the scan parser
 * over one silently yields a package with no tokens and no components, so
 * pick the parser by what the doc actually is.
 */
function isBundledDesignDoc(ref: string): boolean {
  const name = ref.replace(/^docs\/designs\.md\//, "");
  if (name.includes("/") || name.includes("\\")) return false;
  return existsSync(join(process.cwd(), "docs", "designs.md", name));
}

export async function runPulseCodegen(
  docRef?: string,
): Promise<PulseCodegenOutput> {
  const ref =
    docRef?.trim() ||
    process.env.BLOCKSMITH_DOC?.trim() ||
    "upload:scan-acme-ui-kit.md";

  let system: DesignSystem;
  let resolvedFrom: string;

  if (isBundledDesignDoc(ref)) {
    const fileName = ref.replace(/^docs\/designs\.md\//, "");
    const loadedSystem = loadDesignSystem(fileName);
    system = { ...loadedSystem, scanCssVars: cssVarsFromDesignSystem(loadedSystem) };
    resolvedFrom = join(process.cwd(), "docs", "designs.md", fileName);
  } else if (isStyleReferenceDoc(ref)) {
    // A capture, an upload or a paste: the wiki's own parser, and the tokens
    // derived the same way the bundled branch derives them.
    await prepareDesignSystemDoc(ref);
    const loadedSystem = loadDesignSystem(ref);
    system = { ...loadedSystem, scanCssVars: cssVarsFromDesignSystem(loadedSystem) };
    resolvedFrom = ref;
  } else {
    const loaded = await loadScanMarkdownForCodegen(ref);
    system = parseWorkspaceScanMarkdown(loaded.markdown, ref);
    resolvedFrom = loaded.resolvedFrom;
  }

  const result = generatePulsePackage(system, CODEGEN_ROOT);

  const importExample = [
    `import { Surface, Text, Button } from "${result.packageName}";`,
    `import "${result.packageName}/tokens.css";`,
  ].join("\n");

  return {
    ...result,
    docRef: ref,
    resolvedFrom,
    importExample,
    demoUrl: "/demo/pulse",
  };
}
