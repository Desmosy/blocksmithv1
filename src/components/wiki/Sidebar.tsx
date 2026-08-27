"use client";

import {
  memo,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem, NavSection } from "@/lib/blocks/types";
import { hrefWithDoc } from "@/lib/wiki/doc-param";
import { IconArrowUp, IconLock } from "@/components/icons";

/** v2 — prior version accumulated `open: true` for every visited section */
const STORAGE_KEY = "blocksmith-wiki-sidebar-v2";

interface SidebarProps {
  sections: NavSection[];
  currentFileName: string;
  forceExpand?: boolean;
}

/** User overrides only — undefined = follow route (auto open active branch) */
type Prefs = {
  sections: Record<string, boolean>;
  items: Record<string, boolean>;
};

function isActive(pathname: string, href: string): boolean {
  const path = href.split("?")[0];
  if (path === "/wiki") return pathname === "/wiki";
  return pathname === path || pathname.startsWith(`${path}/`);
}

function itemBranchActive(pathname: string, item: NavItem): boolean {
  return (
    isActive(pathname, item.href) ||
    (item.children?.some((c) => isActive(pathname, c.href)) ?? false)
  );
}

function sectionOpen(
  section: NavSection,
  pathname: string,
  prefs: Prefs,
  forceExpand: boolean,
): boolean {
  if (forceExpand) return true;
  const pref = prefs.sections[section.id];
  if (pref === false) return false;
  if (pref === true) return true;
  // Open by default. Opening only the section containing the current route
  // meant every section collapsed on the introduction page — the first screen
  // of a design system showed a sidebar with nothing in it. A reader who wants
  // it quiet can collapse a section, and that preference is remembered.
  return true;
}

function itemOpen(
  item: NavItem,
  pathname: string,
  prefs: Prefs,
  forceExpand: boolean,
): boolean {
  if (forceExpand) return true;
  const pref = prefs.items[item.id];
  if (pref === false) return false;
  if (pref === true) return true;
  return itemBranchActive(pathname, item);
}

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return { sections: {}, items: {} };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { sections: {}, items: {} };
    const parsed = JSON.parse(raw) as Prefs;
    return { sections: parsed.sections ?? {}, items: parsed.items ?? {} };
  } catch {
    return { sections: {}, items: {} };
  }
}

function savePrefs(prefs: Prefs): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

function CollapsePanel({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <IconArrowUp
      size={12}
      className={`shrink-0 text-[var(--wiki-muted)] transition-transform duration-150 motion-reduce:transition-none ${
        open ? "rotate-180" : "rotate-90"
      }`}
      aria-hidden
    />
  );
}

const NavLeaf = memo(function NavLeaf({
  href,
  label,
  active,
  nested,
  locked,
  currentFileName,
}: {
  href: string;
  label: string;
  active: boolean;
  nested?: boolean;
  locked?: boolean;
  currentFileName: string;
}) {
  const dest = hrefWithDoc(href.split("?")[0], currentFileName);
  return (
    <Link
      href={dest}
      title={locked ? "Connect a repo and scan to enable releases" : undefined}
      className={`flex min-h-[32px] items-center justify-between gap-2 rounded-md py-1.5 text-sm ${
        nested ? "pl-9 pr-3 text-[13px]" : "px-3"
      } ${
        active
          ? "bg-[var(--wiki-active)] font-medium text-[var(--wiki-text)]"
          : `text-[var(--wiki-muted)] hover:bg-[var(--wiki-active)] hover:text-[var(--wiki-text)]${
              locked ? " opacity-60" : ""
            }`
      }`}
    >
      <span className="truncate">{label}</span>
      {locked ? (
        <IconLock
          size={12}
          className="shrink-0 opacity-50"
          aria-label="Locked until repo is connected"
        />
      ) : null}
    </Link>
  );
});

const NavBranch = memo(function NavBranch({
  item,
  pathname,
  currentFileName,
  expanded,
  onToggle,
}: {
  item: NavItem;
  pathname: string;
  currentFileName: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const active = isActive(pathname, item.href);
  const branchActive = itemBranchActive(pathname, item);
  const dest = hrefWithDoc(item.href.split("?")[0], currentFileName);

  return (
    <div>
      <div
        className={`flex min-h-[32px] items-stretch rounded-md ${
          branchActive && !active
            ? "text-[var(--wiki-text)]"
            : "text-[var(--wiki-muted)]"
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
          className="flex w-8 shrink-0 items-center justify-center rounded-l-md hover:bg-[var(--wiki-active)]"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label}`}
        >
          <Chevron open={expanded} />
        </button>
        <Link
          href={dest}
          className={`flex min-w-0 flex-1 items-center truncate rounded-r-md py-1.5 pr-3 text-sm hover:bg-[var(--wiki-active)] hover:text-[var(--wiki-text)] ${
            active
              ? "bg-[var(--wiki-active)] font-medium text-[var(--wiki-text)]"
              : ""
          }`}
        >
          {item.label}
        </Link>
      </div>
      <CollapsePanel open={expanded}>
        <ul className="mt-0.5 space-y-0.5 pb-1">
          {item.children?.map((child) => (
            <li key={child.id}>
              <NavLeaf
                href={child.href}
                label={child.label}
                active={isActive(pathname, child.href)}
                nested
                currentFileName={currentFileName}
              />
            </li>
          ))}
        </ul>
      </CollapsePanel>
    </div>
  );
});

const SidebarSection = memo(function SidebarSection({
  section,
  pathname,
  currentFileName,
  expanded,
  onToggleSection,
  prefs,
  onToggleItem,
  forceExpand,
}: {
  section: NavSection;
  pathname: string;
  currentFileName: string;
  expanded: boolean;
  onToggleSection: () => void;
  prefs: Prefs;
  onToggleItem: (itemId: string) => void;
  forceExpand: boolean;
}) {
  const hasLabel = Boolean(section.label?.trim());

  const items = (
    <ul className="space-y-0.5">
      {section.items.map((item) => (
        <li key={item.id}>
          {item.children && item.children.length > 0 ? (
            <NavBranch
              item={item}
              pathname={pathname}
              currentFileName={currentFileName}
              expanded={itemOpen(item, pathname, prefs, forceExpand)}
              onToggle={() => onToggleItem(item.id)}
            />
          ) : (
            <NavLeaf
              href={item.href}
              label={item.label}
              active={isActive(pathname, item.href)}
              locked={item.locked}
              currentFileName={currentFileName}
            />
          )}
        </li>
      ))}
    </ul>
  );

  if (!hasLabel) {
    return <div className="pb-4">{items}</div>;
  }

  return (
    <div className="pb-1">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onToggleSection();
        }}
        className="mb-1 flex w-full min-h-[28px] items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--wiki-muted)] hover:bg-[var(--wiki-active)] hover:text-[var(--wiki-text)]"
        aria-expanded={expanded}
      >
        <Chevron open={expanded} />
        <span className="truncate">{section.label}</span>
      </button>
      <CollapsePanel open={expanded}>{items}</CollapsePanel>
    </div>
  );
});

export const Sidebar = memo(function Sidebar({
  sections,
  currentFileName,
  forceExpand = false,
}: SidebarProps) {
  const pathname = usePathname();
  const [prefs, setPrefs] = useState<Prefs>({ sections: {}, items: {} });

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const toggleSection = useCallback(
    (section: NavSection) => {
      setPrefs((prev) => {
        const currentlyOpen = sectionOpen(section, pathname, prev, forceExpand);
        return {
          ...prev,
          sections: { ...prev.sections, [section.id]: !currentlyOpen },
        };
      });
    },
    [pathname, forceExpand],
  );

  const toggleItem = useCallback(
    (itemId: string, item: NavItem) => {
      setPrefs((prev) => {
        const currentlyOpen = itemOpen(item, pathname, prev, forceExpand);
        return {
          ...prev,
          items: { ...prev.items, [itemId]: !currentlyOpen },
        };
      });
    },
    [pathname, forceExpand],
  );

  return (
    <aside
      className="wiki-sidebar min-h-0 shrink-0 overflow-y-auto overflow-x-hidden border-r py-4 pl-3 pr-2"
      style={{
        width: "var(--wiki-sidebar-width, 15rem)",
        borderColor: "var(--wiki-border)",
        backgroundColor: "var(--wiki-sidebar)",
        contain: "layout style paint",
      }}
    >
      <nav className="space-y-1" aria-label="Design system">
        {sections.map((section) => (
          <SidebarSection
            key={section.id}
            section={section}
            pathname={pathname}
            currentFileName={currentFileName}
            expanded={sectionOpen(section, pathname, prefs, forceExpand)}
            onToggleSection={() => toggleSection(section)}
            prefs={prefs}
            onToggleItem={(itemId) => {
              const item = section.items.find((i) => i.id === itemId);
              if (item) toggleItem(itemId, item);
            }}
            forceExpand={forceExpand}
          />
        ))}
      </nav>
    </aside>
  );
});
