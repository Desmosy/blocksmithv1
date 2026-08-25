import type { DocLifecycle } from "@/lib/wiki/doc-lifecycle";
import type { NavItem, NavSection } from "@/lib/blocks/types";

const WORKFLOW_IDS = new Set(["pipeline", "releases", "sync", "governance"]);

const WORKFLOW_ORDER = ["pipeline", "governance", "sync", "releases"] as const;

const SECTION_LABELS: Record<string, string> = {
  preview: "Explore",
  guidelines: "Reference",
  codebase: "For developers",
};

/** Sidebar labels that ship on workflow items in the top nav — hide duplicates. */
const SIDEBAR_WORKFLOW_IDS = new Set(["pipeline", "governance", "sync"]);

function lockPreviewReleases(item: NavItem, lifecycle: DocLifecycle): NavItem {
  const locked =
    lifecycle === "preview" &&
    (item.id === "pipeline" || item.id === "releases");
  return locked ? { ...item, locked: true } : item;
}

/**
 * One consistent sidebar across apollo, workspace-scan, and generic parsers:
 * Introduction → Workflow (Pipeline, Sync) → Explore / Foundation / Components.
 */
export function normalizeWikiNav(
  nav: NavSection[],
  lifecycle: DocLifecycle,
): NavSection[] {
  const workflowById = new Map<string, NavItem>();

  const otherSections: NavSection[] = [];

  for (const section of nav) {
    if (section.id === "sync" || section.id === "guidelines") {
      for (const item of section.items) {
        if (WORKFLOW_IDS.has(item.id)) {
          workflowById.set(item.id, lockPreviewReleases(item, lifecycle));
        }
      }
      continue;
    }

    const remaining: NavItem[] = [];
    for (const item of section.items) {
      if (WORKFLOW_IDS.has(item.id)) {
        workflowById.set(item.id, lockPreviewReleases(item, lifecycle));
      } else {
        remaining.push(item);
      }
    }

    if (remaining.length === 0) continue;

    const label =
      SECTION_LABELS[section.id] ??
      (section.id === "intro" ? "" : section.label);

    otherSections.push({
      ...section,
      label,
      items: remaining,
    });
  }

  const workflowItems = WORKFLOW_ORDER.map((id) => workflowById.get(id)).filter(
    (item): item is NavItem =>
      item != null && SIDEBAR_WORKFLOW_IDS.has(item.id),
  );

  const workflowSection: NavSection | null =
    workflowItems.length > 0
      ? { id: "workflow", label: "Workflow", items: workflowItems }
      : null;

  const intro = otherSections.filter((s) => s.id === "intro");
  const rest = otherSections.filter((s) => s.id !== "intro");

  return [
    ...intro,
    ...(workflowSection ? [workflowSection] : []),
    ...rest,
  ];
}
