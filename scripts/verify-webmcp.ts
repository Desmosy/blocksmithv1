/**
 * Verify the WebMCP surface and the governance engine behind it.
 *
 * Guards three things that are easy to break silently:
 *  1. Chrome's character budgets. Exceed the tool-output cap and a fix
 *     instruction gets truncated mid-sentence, which is worse than no answer.
 *  2. Per-preset governance. Every preset must accept its own compliant code
 *     and reject the classic AI-generated card — a linter that passes
 *     everything looks identical to one that works.
 *  3. Auto-fix safety. A repair pass must reduce violations and never
 *     introduce one.
 *
 * Run: npm run verify:webmcp
 */
import {
  WEBMCP_LIMITS,
  WEBMCP_TOOLS,
  clampOutput,
} from "../src/lib/webmcp/registry";
import { loadDesignSystem } from "../src/lib/clients/registry";
import { applyFixes } from "../src/lib/governance/autofix";
import { findScaleViolations } from "../src/lib/governance/scale-lint";
import { findRuleViolations } from "../src/lib/governance/rule-lint";
import { findTailwindViolations } from "../src/lib/governance/tailwind-lint";
import {
  findOffTokenColors,
  paletteFromColors,
} from "../src/lib/governance/color-lint";

const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);
const ok = (msg: string) => console.log(`  ok   ${msg}`);

/** Total violations of every class, which is what check_governance reports. */
function violationCount(code: string, doc: string): number {
  const system = loadDesignSystem(doc);
  return (
    findOffTokenColors(code, paletteFromColors(system.colors)).length +
    findScaleViolations(code, system).length +
    findRuleViolations(code, system).length +
    findTailwindViolations(code, system).length
  );
}

/* ---------------------------------------------------------------- budgets */

console.log("\nTool budgets");

const seen = new Set<string>();
for (const tool of WEBMCP_TOOLS) {
  if (seen.has(tool.name)) fail(`duplicate tool name: ${tool.name}`);
  seen.add(tool.name);

  if (tool.name.length > WEBMCP_LIMITS.toolName) {
    fail(`${tool.name}: name is ${tool.name.length} chars (max ${WEBMCP_LIMITS.toolName})`);
  }
  if (tool.description.length > WEBMCP_LIMITS.toolDescription) {
    fail(
      `${tool.name}: description is ${tool.description.length} chars (max ${WEBMCP_LIMITS.toolDescription})`,
    );
  }
  if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) {
    fail(`${tool.name}: name should be lower_snake_case`);
  }
  // Every tool must declare read-only-ness so the agent knows what needs
  // confirmation. Silence reads as "unknown", which is the wrong default.
  if (typeof tool.annotations.readOnlyHint !== "boolean") {
    fail(`${tool.name}: missing readOnlyHint`);
  }
  for (const [param, schema] of Object.entries(tool.inputSchema.properties)) {
    if (param.length > WEBMCP_LIMITS.paramName) {
      fail(`${tool.name}.${param}: parameter name too long`);
    }
    const d = schema.description ?? "";
    if (d.length > WEBMCP_LIMITS.paramDescription) {
      fail(
        `${tool.name}.${param}: description is ${d.length} chars (max ${WEBMCP_LIMITS.paramDescription})`,
      );
    }
  }
}
ok(`${WEBMCP_TOOLS.length} tools within name/description/parameter budgets`);

// capture_site_design returns third-party content and must say so.
const capture = WEBMCP_TOOLS.find((t) => t.name === "capture_site_design");
if (!capture) {
  fail("capture_site_design is missing");
} else if (capture.annotations.untrustedContentHint !== true) {
  fail("capture_site_design must set untrustedContentHint — it returns remote content");
} else {
  ok("capture_site_design carries untrustedContentHint");
}

/* ------------------------------------------------------------ clampOutput */

console.log("\nOutput clamping");
{
  const long = Array.from({ length: 200 }, (_, i) => `- line ${i}`).join("\n");
  const clamped = clampOutput(long);
  if (clamped.length > WEBMCP_LIMITS.output) {
    fail(`clampOutput returned ${clamped.length} chars, over the ${WEBMCP_LIMITS.output} budget`);
  } else if (!clamped.includes("truncated")) {
    fail("clampOutput dropped content without saying so");
  } else {
    ok(`clamps ${long.length} chars to ${clamped.length}, and says it truncated`);
  }

  const short = "PASS — nothing to report.";
  if (clampOutput(short) !== short) fail("clampOutput altered a short string");
}

/* ------------------------------------------------------------- governance */

type PresetCase = {
  doc: string;
  /** Uses only this system's tokens and scale values. */
  compliant: string;
  /** At least one violation of every class the system declares. */
  offending: string;
};

const PRESETS: PresetCase[] = [
  {
    doc: "portfolio.md",
    compliant: `export function Card() {
  return (
    <div className="p-4 rounded-[10px]" style={{ background: "#fcfcfd", color: "#14161c" }}>
      <h3 style={{ fontSize: 32 }}>Selected work</h3>
    </div>
  );
}`,
    offending: `export function Card() {
  return (
    <div className="p-5 rounded-xl shadow-lg bg-gradient-to-br from-slate-900 to-black">
      <h3 className="text-2xl text-blue-600" style={{ fontSize: 42 }}>Pro</h3>
    </div>
  );
}`,
  },
  {
    doc: "saas.md",
    compliant: `export function Metric() {
  return <div style={{ padding: 16, borderRadius: 8 }}>Revenue</div>;
}`,
    offending: `export function Metric() {
  return (
    <div className="shadow-lg bg-gradient-to-r from-blue-500 to-black" style={{ padding: 18, borderRadius: 10 }}>
      <span style={{ color: "#7c3aed" }}>Revenue</span>
    </div>
  );
}`,
  },
];

console.log("\nGovernance per preset");
for (const p of PRESETS) {
  let system;
  try {
    system = loadDesignSystem(p.doc);
  } catch (err) {
    fail(`${p.doc}: failed to load — ${(err as Error).message}`);
    continue;
  }

  if (!system.components.length) fail(`${p.doc}: parsed with zero components`);
  if (!system.colors.length) fail(`${p.doc}: parsed with zero colours`);

  const clean = violationCount(p.compliant, p.doc);
  if (clean !== 0) {
    fail(`${p.doc}: compliant snippet produced ${clean} violation(s) — false positive`);
  } else {
    ok(`${p.doc}: compliant code passes (${system.components.length} components, ${system.colors.length} tokens)`);
  }

  const dirty = violationCount(p.offending, p.doc);
  if (dirty < 4) {
    fail(`${p.doc}: offending snippet only produced ${dirty} violation(s) — checks may be no-ops`);
  } else {
    ok(`${p.doc}: offending code rejected with ${dirty} violations`);
  }
}

/* ---------------------------------------------------------------- autofix */

console.log("\nAuto-fix");
for (const p of PRESETS) {
  const system = loadDesignSystem(p.doc);
  const before = violationCount(p.offending, p.doc);
  const result = applyFixes(p.offending, system);
  const after = violationCount(result.code, p.doc);

  if (after > before) {
    fail(`${p.doc}: auto-fix increased violations ${before} → ${after}`);
  } else if (after === before && result.applied.length > 0) {
    fail(`${p.doc}: auto-fix reported ${result.applied.length} fixes but nothing improved`);
  } else {
    ok(`${p.doc}: ${before} → ${after} violations, ${result.applied.length} applied, ${result.skipped.length} left for a human`);
  }

  // Fixing already-clean code must be a no-op, not a rewrite.
  const noop = applyFixes(p.compliant, system);
  if (noop.code !== p.compliant) {
    fail(`${p.doc}: auto-fix modified already-compliant code`);
  }

  // A second pass must be stable — otherwise the agent loops forever.
  const twice = applyFixes(result.code, system);
  if (twice.code !== result.code) {
    fail(`${p.doc}: auto-fix is not idempotent — a second pass changed the code again`);
  }
}

/* ----------------------------------------------------------------- result */

console.log("");
if (failures.length) {
  console.error(`FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("verify:webmcp — all checks passed\n");
