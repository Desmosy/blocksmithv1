import type { LoadedDesignSystem } from "@/lib/clients/registry";
import { buildWikiThemeStyle } from "@/lib/apollo/wiki-theme";

/** Structured token summary for the layout model — must match parsed .md, not defaults. */
export function buildDesignContext(system: LoadedDesignSystem) {
  const wikiDefaults = buildWikiThemeStyle(system);

  return {
    systemId: system.id,
    systemName: system.name,
    mode: system.mode,
    contentHash: system.contentHash,
    sourcePath: system.sourcePath,
    tagline: system.tagline,
    overview: system.overview?.slice(0, 800),
    currentWikiChrome: wikiDefaults,
    colors: system.colors.map((c) => ({
      name: c.name,
      cssVar: c.cssVar.startsWith("--") ? c.cssVar : `--color-${c.cssVar}`,
      hex: c.value,
      role: c.role,
    })),
    typography: system.typography.map((t) => ({
      name: t.name,
      role: t.role,
      substitute: t.substitute,
      cssVar: t.cssVar,
    })),
    components: system.components.slice(0, 24).map((c) => ({
      id: c.id,
      title: c.title,
      role: c.role,
      description: c.description?.slice(0, 200),
    })),
    surfaces: system.surfaces?.slice(0, 8).map((s) => ({
      level: s.level,
      name: s.name,
      value: s.value,
      purpose: s.purpose,
    })),
    guidelines: {
      dos: system.dos?.slice(0, 6) ?? [],
      donts: system.donts?.slice(0, 6) ?? [],
    },
    agentGuideExcerpt: system.agentGuide?.slice(0, 1200) ?? "",
  };
}

export function formatDesignContextForPrompt(
  system: LoadedDesignSystem,
): string {
  const ctx = buildDesignContext(system);
  return JSON.stringify(ctx, null, 2);
}
