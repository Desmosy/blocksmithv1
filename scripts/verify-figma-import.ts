/**
 * Verifies the Figma-fit wedge (idea 1):
 *   1. Figma variables → design.md round-trips through the scan parser.
 *   2. Imported tokens render as colors/spacing in the parsed design system.
 *   3. Drift reconciliation flags mismatch / figma-only / code-only correctly.
 *
 * Pure + deterministic — no live Figma credentials needed. Run:
 *   npm run verify:figma-import
 */
import {
  importFigmaVariables,
  computeTokenDrift,
  driftFigmaAgainstScan,
  normalizeFigmaComponents,
  driftFigmaComponentsAgainstScan,
  computeComponentDrift,
  figmaComponentSurface,
  codeComponentSurfacesFromMarkdown,
  assembleFigmaImport,
  flattenFigmaVariableDefs,
  figmaRgbaToHex,
  figmaDesignContextToTokens,
  parseFigmaFileKey,
  extractFigmaFile,
  type FigmaVariableDefs,
  type FigmaComponentInput,
  type RawFigmaVariableDefs,
  type FigmaRestFile,
} from "@/lib/figma";
import {
  isWorkspaceScanMarkdown,
  parseWorkspaceScanMarkdown,
} from "@/lib/scan/parse";
import type { ScannedCssVar } from "@/lib/scan/types";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// A representative Figma `get_variable_defs` payload (flat map shape).
const FIGMA_DEFS: FigmaVariableDefs = {
  "Color/Background/Default": "#FFFFFF",
  "Color/Text/Primary": "#1A1A1A",
  "Color/Brand/Primary": "rgb(59, 130, 246)",
  "Radius/Medium": "8",
  "Spacing/Small": "8",
  "Spacing/Large": "24px",
  "Opacity/Disabled": "0.5", // non-color, non-dimension-ish → still a dimension? no unit; treated as px
  Untitled: "", // empty value → skipped
};

console.log("Figma import → design.md");
const imported = importFigmaVariables({
  variables: FIGMA_DEFS,
  fileKey: "AbC123",
  fileName: "Acme DS",
});

check(
  "emits workspace-scan markdown",
  isWorkspaceScanMarkdown(imported.markdown),
);
check(
  "skips the empty-value variable",
  imported.summary.skipped >= 1,
  `skipped=${imported.summary.skipped}`,
);
check(
  "tokens carry a figma: source",
  imported.cssVars.every((v) => v.source === "figma:AbC123"),
);
check(
  "brand rgb() converted to hex",
  imported.cssVars.some(
    (v) => v.name === "--color-brand-primary" && v.value === "#3b82f6",
  ),
  JSON.stringify(imported.cssVars.find((v) => v.name === "--color-brand-primary")),
);
check(
  "bare radius number became px",
  imported.cssVars.some(
    (v) => v.name === "--radius-medium" && v.value === "8px",
  ),
);

console.log("\nParsed design system from imported markdown");
const ds = parseWorkspaceScanMarkdown(imported.markdown, "upload:figma.md");
check("colors parsed", ds.colors.length >= 3, `colors=${ds.colors.length}`);
check(
  "spacing parsed from Figma dims",
  ds.spacing.some((s) => s.token === "--spacing-small"),
  JSON.stringify(ds.spacing.map((s) => s.token)),
);
check(
  "border radius parsed",
  ds.borderRadius.some((r) => /radius/i.test(r.element.toLowerCase()) || /8px/.test(r.value)),
  JSON.stringify(ds.borderRadius),
);

console.log("\nDrift: Figma vs code");
const codeVars: ScannedCssVar[] = [
  { name: "--color-text-primary", value: "#1A1A1A", source: "app/globals.css" }, // match
  { name: "--color-brand-primary", value: "#2563eb", source: "app/globals.css" }, // mismatch (Figma #3b82f6)
  { name: "--spacing-small", value: "8px", source: "app/globals.css" }, // match
  { name: "--color-legacy", value: "#cccccc", source: "app/legacy.css" }, // code-only
];
const drift = computeTokenDrift(imported.cssVars, codeVars);
check(
  "mismatch detected (brand differs)",
  drift.rows.some(
    (r) => r.cssVar === "--color-brand-primary" && r.status === "mismatch",
  ),
);
check(
  "match detected (text primary, case-insensitive hex)",
  drift.rows.some(
    (r) => r.cssVar === "--color-text-primary" && r.status === "match",
  ),
);
check(
  "code-only detected (legacy token)",
  drift.rows.some(
    (r) => r.cssVar === "--color-legacy" && r.status === "code-only",
  ),
);
check(
  "figma-only detected (background not in code)",
  drift.rows.some(
    (r) => r.cssVar === "--color-background-default" && r.status === "figma-only",
  ),
);
check("report not in sync", drift.inSync === false);

console.log("\nDrift against scan markdown");
const driftFromMd = driftFigmaAgainstScan(imported.cssVars, imported.markdown);
check(
  "identical Figma-derived scan is fully in sync",
  driftFromMd.mismatched === 0,
  `mismatched=${driftFromMd.mismatched}`,
);

// A representative Figma published-component payload (raw componentPropertyDefinitions).
const FIGMA_COMPONENTS: FigmaComponentInput = [
  {
    name: "Button",
    description: "Primary action button",
    key: "btn-key",
    componentPropertyDefinitions: {
      Size: { type: "VARIANT", defaultValue: "Medium", variantOptions: ["Small", "Medium", "Large"] },
      Variant: { type: "VARIANT", defaultValue: "Primary", variantOptions: ["Primary", "Secondary"] },
      "Disabled#1:0": { type: "BOOLEAN", defaultValue: false },
      "Label#2:0": { type: "TEXT", defaultValue: "Button" },
    },
  },
  {
    name: "Card",
    componentPropertyDefinitions: {
      Elevation: { type: "VARIANT", defaultValue: "Flat", variantOptions: ["Flat", "Raised"] },
    },
  },
];

console.log("\nFigma component ingestion");
const withComps = importFigmaVariables({
  variables: FIGMA_DEFS,
  components: FIGMA_COMPONENTS,
  fileKey: "AbC123",
  fileName: "Acme DS",
});
check(
  "components imported into the library",
  withComps.summary.components === 2,
  `components=${withComps.summary.components}`,
);
const dsComps = parseWorkspaceScanMarkdown(withComps.markdown, "upload:figma.md");
check(
  "Button renders in the Component Library",
  dsComps.components.some((c) => c.title === "Button"),
  JSON.stringify(dsComps.components.map((c) => c.title)),
);

const normComps = normalizeFigmaComponents(FIGMA_COMPONENTS);
const buttonSurface = figmaComponentSurface(normComps[0]);
check(
  "variant property names normalized + stripped of #id",
  "size" in buttonSurface.variants && buttonSurface.props.includes("label"),
  JSON.stringify(buttonSurface),
);

console.log("\nComponent drift: Figma vs code");
// Synthesize a code-scan markdown whose Button lacks the Large size + has an extra Variant.
const codeScanMd = [
  "---",
  "blocksmith-source: workspace-scan",
  "---",
  "",
  "## 2. Component Library",
  "",
  "### Button",
  "**Role:** Button",
  "",
  `<!-- blocksmith:interface ${JSON.stringify({
    name: "Button",
    props: [
      { name: "size", type: '"sm" | "md"', optional: true, variants: ["sm", "md"] },
      { name: "variant", type: '"primary" | "secondary" | "ghost"', optional: true, variants: ["primary", "secondary", "ghost"] },
    ],
    extendsTypes: [],
    hasChildren: true,
  })} -->`,
  "",
  "### Tooltip",
  "**Role:** Tooltip",
  "",
].join("\n");

const compDrift = driftFigmaComponentsAgainstScan(normComps, codeScanMd);
check(
  "Button flagged as mismatch (variant differences)",
  compDrift.rows.some((r) => r.component === "Button" && r.status === "mismatch"),
  JSON.stringify(compDrift.rows.find((r) => r.component === "Button")),
);
check(
  "Card flagged figma-only (not in code)",
  compDrift.rows.some((r) => r.component === "Card" && r.status === "figma-only"),
);
check(
  "Tooltip flagged code-only (not in Figma)",
  compDrift.rows.some((r) => r.component === "Tooltip" && r.status === "code-only"),
);
const buttonRow = compDrift.rows.find((r) => r.component === "Button");
check(
  "drift names the missing Large size difference",
  !!buttonRow?.differences.some((d) => /large/i.test(d) || /size/i.test(d)),
  JSON.stringify(buttonRow?.differences),
);
check(
  "identical component surfaces are in sync",
  computeComponentDrift(
    [buttonSurface],
    codeComponentSurfacesFromMarkdown(withComps.markdown),
  ).rows.some((r) => r.component === "Button" && r.status === "match"),
);

console.log("\nLive adapter: real Figma payload shapes");
check(
  "RGBA float object → hex",
  figmaRgbaToHex({ r: 0.0509, g: 0.6, b: 1, a: 1 }) === "#0d99ff",
  figmaRgbaToHex({ r: 0.0509, g: 0.6, b: 1, a: 1 }),
);

// Nested-by-collection payload with RGBA objects, numbers, and an alias.
const RAW_NESTED: RawFigmaVariableDefs = {
  Primitives: {
    "Color/Brand": { r: 0.0509, g: 0.6, b: 1, a: 1 },
    "Radius/md": 8,
  },
  Semantic: {
    "Color/Text/Primary": "#1A1A1A",
    "Color/Alias": { type: "VARIABLE_ALIAS", id: "VariableID:1:2" },
  },
};
const flat = flattenFigmaVariableDefs(RAW_NESTED);
check(
  "nested collections flattened with / paths",
  flat["Primitives/Color/Brand"] === "#0d99ff" &&
    flat["Semantic/Color/Text/Primary"] === "#1A1A1A",
  JSON.stringify(flat),
);
check(
  "numeric value stringified",
  flat["Primitives/Radius/md"] === "8",
  flat["Primitives/Radius/md"],
);
check(
  "unresolved alias skipped",
  !("Semantic/Color/Alias" in flat),
  JSON.stringify(Object.keys(flat)),
);

// Array shape (REST-style) also flattens.
const flatArr = flattenFigmaVariableDefs([
  { name: "Color/Primary", value: { r: 1, g: 0, b: 0 } },
  { name: "Spacing/lg", value: 24 },
]);
check(
  "array payload flattens (rgba + number)",
  flatArr["Color/Primary"] === "#ff0000" && flatArr["Spacing/lg"] === "24",
  JSON.stringify(flatArr),
);

// assembleFigmaImport → importable input that round-trips through the pipeline.
const assembled = assembleFigmaImport({
  variableDefs: RAW_NESTED,
  components: FIGMA_COMPONENTS,
  fileKey: "Live123",
  fileName: "Live DS",
});
const liveImported = importFigmaVariables(assembled);
check(
  "assembled live import yields tokens + components",
  liveImported.summary.cssVars >= 3 && liveImported.summary.components === 2,
  JSON.stringify(liveImported.summary),
);

console.log("\nDesign-context extraction (files with NO variables)");
// A representative slice of real get_design_context output (DashStack).
const DESIGN_CONTEXT = `
  <div className="bg-[#f5f6fa] inset-0" data-name="Main Bg" />
  <div className="bg-[#00b69b] rounded-[13.5px]" data-name="Delivered">
    <p className="text-[14px] text-white">Delivered</p>
  </div>
  <div className="bg-[#fcbe2d] rounded-[13.5px]"><p className="text-white text-[14px]">Pending</p></div>
  <div className="bg-[#fd5454] rounded-[13.5px]"><p className="text-white">Rejected</p></div>
  <div className="bg-white rounded-[14px] shadow-[6px_6px_54px_0px_rgba(0,0,0,0.05)]" />
  <p className="text-[#202224] text-[24px]">Deals Details</p>
  <p className="text-[#202224] text-[32px]">Dashboard</p>
  <p className="text-[rgba(43,48,52,0.4)] text-[12px]">October</p>
  <div className="bg-[#fcfdfd] border-[#d5d5d5] border-[0.6px] rounded-[4px]" />
  <div className="bg-[#4880ff] rounded-[1px]" data-name="Active" />
`;
const ctxTokens = figmaDesignContextToTokens(DESIGN_CONTEXT);
check(
  "extracts background colors",
  Object.values(ctxTokens).includes("#f5f6fa") &&
    Object.values(ctxTokens).includes("#4880ff"),
  JSON.stringify(ctxTokens),
);
check(
  "extracts status accent colors (green/yellow/red)",
  ["#00b69b", "#fcbe2d", "#fd5454"].every((h) =>
    Object.values(ctxTokens).includes(h),
  ),
);
check(
  "converts rgba shadow/text to hex",
  Object.values(ctxTokens).includes("#000000") &&
    Object.values(ctxTokens).includes("#2b3034"),
  JSON.stringify(ctxTokens),
);
check(
  "extracts radii as px dimensions",
  ctxTokens["Radius/4"] === "4px" &&
    ctxTokens["Radius/13.5"] === "13.5px" &&
    ctxTokens["Radius/14"] === "14px",
  JSON.stringify(Object.entries(ctxTokens).filter(([k]) => k.startsWith("Radius"))),
);
check(
  "extracts type scale",
  ctxTokens["Font Size/24"] === "24px" && ctxTokens["Font Size/32"] === "32px",
);

// End-to-end: a no-variable file imports purely from design context.
const ctxImport = importFigmaVariables({
  designContextCode: DESIGN_CONTEXT,
  fileKey: "noVars1",
  fileName: "No-Variable Kit",
});
check(
  "no-variable file still produces a populated design.md",
  ctxImport.summary.colors >= 6 && ctxImport.summary.cssVars >= 9,
  JSON.stringify(ctxImport.summary),
);

// Merge: real variables win over inferred on collision.
const merged = assembleFigmaImport({
  variableDefs: { "Color/Brand/Primary": "#123456" },
  designContextCode: 'bg-[#4880ff] text-[#999999]',
  fileKey: "merge1",
});
const mergedImport = importFigmaVariables(merged);
check(
  "merge keeps both real + inferred tokens",
  mergedImport.cssVars.some((v) => v.value === "#123456") &&
    mergedImport.cssVars.some((v) => v.value === "#999999"),
  JSON.stringify(mergedImport.cssVars.map((v) => v.value)),
);

console.log("\nUI connector: Figma REST extraction");
check(
  "parses file key from a design URL",
  parseFigmaFileKey("https://www.figma.com/design/AbC123xyz/Name?node-id=0-1") ===
    "AbC123xyz",
);
check(
  "parses file key from a file URL and bare key",
  parseFigmaFileKey("https://figma.com/file/KEY999abcd/X") === "KEY999abcd" &&
    parseFigmaFileKey("PlainKey12345") === "PlainKey12345",
);
check("rejects a non-figma URL", parseFigmaFileKey("https://example.com/x") === null);

// A representative Figma REST file: named color style, text style, raw fill,
// and a component set with variant props.
const REST_FILE: FigmaRestFile = {
  name: "Acme REST DS",
  styles: {
    "S1": { name: "Brand/Primary", styleType: "FILL" },
    "S2": { name: "Body", styleType: "TEXT" },
  },
  document: {
    id: "0:0",
    type: "DOCUMENT",
    children: [
      {
        id: "0:1",
        type: "CANVAS",
        name: "Page 1",
        measurements: [{
          id: "measure:1",
          start: { nodeId: "1:1", side: "RIGHT" },
          end: { nodeId: "1:2", side: "LEFT" },
          offset: { type: "OUTER", fixed: 24 },
          freeText: "Content gap",
        }],
        children: [
          {
            id: "1:1",
            type: "RECTANGLE",
            name: "Brand swatch",
            annotations: [{ label: "Use for primary actions", properties: [{ type: "fills" }] }],
            fills: [{ type: "SOLID", color: { r: 0.0509, g: 0.6, b: 1 } }],
            styles: { fill: "S1" },
          },
          {
            id: "1:2",
            type: "TEXT",
            name: "Body text",
            style: { fontSize: 16 },
            styles: { text: "S2" },
          },
          {
            id: "1:3",
            type: "RECTANGLE",
            name: "Loose fill",
            fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }],
          },
          {
            id: "1:4",
            type: "COMPONENT_SET",
            name: "Button",
            absoluteBoundingBox: { x: 0, y: 0, width: 640, height: 480 },
            componentPropertyDefinitions: {
              Size: { type: "VARIANT", variantOptions: ["sm", "md", "lg"] },
            },
          },
        ],
      },
    ],
  },
};
const rest = extractFigmaFile(REST_FILE);
check(
  "named color style → token",
  rest.variables["Color/Brand/Primary"] === "#0d99ff",
  JSON.stringify(rest.variables),
);
check(
  "text style → font-size token",
  rest.variables["Font Size/Body"] === "16px",
);
check(
  "component set extracted with variants",
  rest.components.length === 1 && rest.stats.componentSets === 1,
);
check("stats report named styles + raw fills", rest.stats.namedColorStyles === 1 && rest.stats.rawFills >= 2);
check(
  "annotations retain node provenance and pinned properties",
  rest.annotations[0]?.nodeId === "1:1" && rest.annotations[0]?.pinnedProperties[0] === "fills",
  JSON.stringify(rest.annotations),
);
check(
  "render candidates retain node dimensions",
  rest.frames.some((frame) => frame.nodeId === "1:4" && frame.width === 640),
  JSON.stringify(rest.frames),
);
check(
  "saved measurements retain endpoints and custom text",
  rest.measurements[0]?.value === 24 && rest.measurements[0]?.text === "Content gap" && rest.measurements[0]?.startNodeId === "1:1",
  JSON.stringify(rest.measurements),
);

// End-to-end through the import pipeline.
const restImport = importFigmaVariables({
  variables: rest.variables,
  components: rest.components,
  fileKey: "rest1",
  fileName: REST_FILE.name,
});
check(
  "REST extract imports tokens + component",
  restImport.summary.colors >= 1 && restImport.summary.components === 1,
  JSON.stringify(restImport.summary),
);

// Integration: the MCP/API handler path (import → persist → drift), with cleanup.
async function verifyHandlers() {
  const { handleImportFigmaVariables, handleFigmaTokenDrift } = await import(
    "@/mcp/handlers"
  );
  const { unlink } = await import("fs/promises");
  const { join } = await import("path");

  console.log("\nMCP handler path (import → persist → drift)");
  const res = await handleImportFigmaVariables({
    variables: FIGMA_DEFS,
    fileKey: "AbC123",
    fileName: "Acme DS",
    markdownAppendix: "## Visual Language & Intent\nNode-linked enrichment for `1:1`.",
  });
  check("import handler returns an upload doc ref", res.docRef.startsWith("upload:"));
  check(
    "import summary counts tokens",
    res.summary.cssVars >= 5,
    `cssVars=${res.summary.cssVars}`,
  );
  const { readUploadMarkdown } = await import("@/lib/uploads/store");
  check(
    "fusion appendix persists in the same design.md",
    (await readUploadMarkdown(res.docRef)).includes("Node-linked enrichment for `1:1`"),
  );

  // Drift the same Figma vars against the doc we just persisted → fully in sync.
  const driftSelf = await handleFigmaTokenDrift({
    variables: FIGMA_DEFS,
    doc: res.docRef,
    fileKey: "AbC123",
  });
  check(
    "drift handler reads the persisted scan",
    !driftSelf.error,
    driftSelf.error,
  );
  check(
    "self-drift is in sync",
    driftSelf.report.mismatched === 0 && driftSelf.report.figmaOnly === 0,
    JSON.stringify({
      mismatched: driftSelf.report.mismatched,
      figmaOnly: driftSelf.report.figmaOnly,
    }),
  );

  // Drift handler rejects a non-scan doc ref cleanly.
  const driftBad = await handleFigmaTokenDrift({
    variables: FIGMA_DEFS,
    doc: "apollo.md",
  });
  check("drift rejects non-upload doc", !!driftBad.error);

  // Clean up the test upload so we don't leave artifacts behind.
  try {
    await unlink(join(process.cwd(), "data/uploads", res.fileName));
  } catch {
    /* supabase-only or already gone */
  }
}

async function main() {
  await verifyHandlers();
  if (failures) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll Figma import checks passed.");
}

void main();
