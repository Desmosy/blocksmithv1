import type { Metadata } from "next";
import { listDocSources, loadDesignSystem } from "@/lib/clients/registry";
import { WEBMCP_TOOLS } from "@/lib/webmcp/registry";
import { LabShell } from "@/components/lab/LabShell";
import type { PresetSummary } from "@/components/lab/types";
import "./lab.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lab — BlockSmith",
  description:
    "Write UI with an agent while a design system judges every change. Open in a WebMCP browser to give your agent the tools.",
};

const PREFERRED_ORDER = ["portfolio.md", "saas.md", "apollo.md"];

const STARTER = `export function PricingCard() {
  return (
    <div className="p-5 rounded-xl shadow-lg bg-gradient-to-br from-slate-900 to-black">
      <h3 className="text-2xl font-bold text-blue-600">Pro</h3>
      <p className="text-sm mt-3">$29 / month</p>
      <button className="rounded-lg px-6 py-3 bg-blue-500">Start trial</button>
    </div>
  );
}`;

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
