import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { generatePulsePackage, type PulseCodegenResult } from "./pulse";
import { parseWorkspaceScanMarkdown } from "@/lib/scan/parse";
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

export async function runPulseCodegen(
  docRef?: string,
): Promise<PulseCodegenOutput> {
  const ref =
    docRef?.trim() ||
    process.env.BLOCKSMITH_DOC?.trim() ||
    "upload:scan-acme-ui-kit.md";

  const { markdown, resolvedFrom } = await loadScanMarkdownForCodegen(ref);
  const system = parseWorkspaceScanMarkdown(markdown, ref);
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
