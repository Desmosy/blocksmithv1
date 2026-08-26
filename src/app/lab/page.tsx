import type { Metadata } from "next";
import { listDocSources, loadDesignSystem } from "@/lib/clients/registry";
import { WEBMCP_TOOLS } from "@/lib/webmcp/registry";
import { LabShell } from "@/components/lab/LabShell";
import type { PresetSummary, Specimen } from "@/components/lab/types";
import { wikiFontsStylesheetHref } from "@/lib/fonts/load-google-fonts";
import type { DesignSystem } from "@/lib/blocks/types";
import "./lab.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lab — BlockSmith",
  description:
    "Write UI with an agent while a design system judges every change. Open in a WebMCP browser to give your agent the tools.",
};

const PREFERRED_ORDER = ["portfolio.md", "saas.md", "docs.md", "apollo.md"];

const STARTER = `export function PricingCard() {
  return (
    <div className="p-5 rounded-xl shadow-lg bg-gradient-to-br from-slate-900 to-black">
      <h3 className="text-2xl font-bold text-blue-600">Pro</h3>
      <p className="text-sm mt-3">$29 / month</p>
      <button className="rounded-lg px-6 py-3 bg-blue-500">Start trial</button>
    </div>
  );
}`;

/** px value out of a scale row like "16px", tolerating a bare number. */
function px(raw: string | undefined, fallback: number): number {
  const n = Number(String(raw ?? "").replace(/px$/i, "").trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Pick a type-scale row by role name, falling back to position in the scale. */
function sizeFor(system: DesignSystem, role: string, index: number, fallback: number): number {
  const byRole = system.typeScale.find((t) =>
    t.role.toLowerCase().includes(role),
  );
  return px(byRole?.size ?? system.typeScale[index]?.size, fallback);
}

/** A font stack for a typography role, with the declared substitute behind it. */
function stackFor(system: DesignSystem, index: number, generic: string): string {
  const fam = system.typography[index];
  if (!fam) return generic;
  const names = [fam.name, fam.substitute].filter(Boolean).map((n) => `"${n}"`);
  return [...new Set(names), generic].join(", ");
}

function buildSpecimen(system: DesignSystem): Specimen {
  const hexes = system.colors.filter((c) => c.value.startsWith("#"));
  const space = system.spacing
    .map((s) => px(s.value, 0))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const radii = system.borderRadius
    .map((r) => px(r.value, 0))
    .filter((n) => n > 0 && n < 100)
    .sort((a, b) => a - b);

  let fontsHref: string | null = null;
  try {
    fontsHref = wikiFontsStylesheetHref(system.typography);
  } catch {
    // A system whose fonts can't be resolved still renders — in the
    // substitute stack — rather than failing the whole page.
    fontsHref = null;
  }

  return {
    name: system.name,
    tagline: system.tagline,
    colors: hexes.map((c) => ({ name: c.name, value: c.value, role: c.role ?? "" })),
    display: stackFor(system, 0, "serif"),
    body: stackFor(system, 1, "sans-serif"),
    mono: stackFor(system, system.typography.length - 1, "monospace"),
    sizes: {
      meta: sizeFor(system, "meta", 0, 12),
      body: sizeFor(system, "body", 2, 16),
      subheading: sizeFor(system, "subheading", 4, 22),
      heading: sizeFor(system, "heading", 6, 34),
    },
    space,
    radii,
    fontsHref,
  };
}

function summarize(fileName: string): PresetSummary | null {
  try {
    const s = loadDesignSystem(fileName);
    return {
      fileName,
      name: s.name,
      tagline: s.tagline,
      componentCount: s.components.length,
      tokenCount: s.colors.length,
      swatches: s.colors
        .filter((c) => c.value.startsWith("#"))
        .slice(0, 5)
        .map((c) => c.value),
      components: s.components.map((c) => c.title),
      specimen: buildSpecimen(s),
    };
  } catch {
    // A doc that fails to parse must not take the whole page down with it.
    return null;
  }
}

export default function LabPage() {
  const presets = listDocSources()
    .map((s) => summarize(s.fileName))
    .filter((p): p is PresetSummary => p !== null)
    .sort((a, b) => {
      const ai = PREFERRED_ORDER.indexOf(a.fileName);
      const bi = PREFERRED_ORDER.indexOf(b.fileName);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  const tools = WEBMCP_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema as unknown as Record<string, unknown>,
    annotations: t.annotations,
  }));

  if (!presets.length) {
    return (
      <main className="lab-fallback">
        <h1>No design systems installed</h1>
        <p>
          Add a <code>.md</code> design system under <code>docs/designs.md/</code>{" "}
          and reload.
        </p>
      </main>
    );
  }

  return (
    <main>
      <LabShell
        tools={tools}
        presets={presets}
        initialDoc={presets[0].fileName}
        initialCode={STARTER}
      />
    </main>
  );
}
