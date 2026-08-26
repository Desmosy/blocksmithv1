/**
 * Numbers for the dashboard, counted rather than invented.
 *
 * These widgets shipped as template placeholders — "12 design systems",
 * "1,248 components", "94% governance score", "Acme UI Kit synced 2 hours
 * ago". None of it was real, and a fabricated number on a governance product
 * is worse than an empty one: the whole claim is that what you see is what is
 * actually true.
 *
 * Anything that cannot be counted from real state is returned as null so the
 * UI can say "nothing yet" instead of filling the gap.
 */

import { listAllDocSources, loadDesignSystem } from "@/lib/clients/registry";
import { listUploads } from "@/lib/uploads/store";

export type RealStat = {
  label: string;
  /** null when there is genuinely nothing to count. */
  value: number | null;
  hint: string;
};

export type RecentItem = {
  title: string;
  /** ISO timestamp, formatted by the client in the reader's locale. */
  at: string | null;
  kind: "capture" | "upload" | "bundled";
};

export type DashboardFacts = {
  stats: RealStat[];
  recent: RecentItem[];
};

export async function getDashboardFacts(): Promise<DashboardFacts> {
  let sources: { fileName: string; label: string }[] = [];
  try {
    sources = await listAllDocSources();
  } catch {
    sources = [];
  }

  let components = 0;
  let tokens = 0;
  let readable = 0;
  for (const s of sources) {
    try {
      const system = loadDesignSystem(s.fileName);
      components += system.components.length;
      tokens += system.colors.length;
      readable += 1;
    } catch {
      // A doc that will not parse is not counted rather than guessed at.
    }
  }

  let uploads: Awaited<ReturnType<typeof listUploads>> = [];
  try {
    uploads = await listUploads();
  } catch {
    uploads = [];
  }

  const recent: RecentItem[] = uploads
    .slice()
    .sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""))
    .slice(0, 5)
    .map((u) => {
      const isCapture = u.fileName.startsWith("capture-");
      // The stored label is a slug of how the doc was created — "capture
      // linear" — which is plumbing, not a name. The kind is already shown
      // beneath it, so strip the prefix and present the system.
      const raw = (u.label || u.fileName.replace(/\.md$/, "")).replace(/^capture[-\s]+/i, "");
      const title = raw
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
      return {
        title: title || u.fileName,
        at: u.savedAt ?? null,
        kind: isCapture ? ("capture" as const) : ("upload" as const),
      };
    });

  return {
    stats: [
      {
        label: "Design systems",
        value: readable || null,
        hint: readable ? "parsed and governable" : "none yet",
      },
      {
        label: "Components",
        value: components || null,
        hint: "across every system",
      },
      {
        label: "Colour tokens",
        value: tokens || null,
        hint: "across every system",
      },
      {
        label: "Captured sites",
        value: recent.filter((r) => r.kind === "capture").length || null,
        hint: "read from a live page",
      },
    ],
    recent,
  };
}
