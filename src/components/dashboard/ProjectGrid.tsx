"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DashboardProject, ProjectKind } from "@/lib/dashboard/projects";
import {
  IconColorPalette,
  IconLink,
  IconModuleAlt,
  IconLayout,
  IconCheck,
  IconSearch,
} from "@/components/icons";
import {
  CutoutCard,
  CutoutCardAction,
  CutoutCardContent,
  CutoutCardMedia,
  CutoutCardOverlay,
  CutoutCardInsetLabel,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "@/components/ui/cutout-card";

const KIND_META: Record<
  ProjectKind,
  { label: string; Icon: typeof IconColorPalette }
> = {
  Figma: { label: "Figma", Icon: IconLink },
  Scan: { label: "Code scan", Icon: IconModuleAlt },
  Design: { label: "Design", Icon: IconColorPalette },
  Sample: { label: "Sample", Icon: IconLayout },
};

const UNDO_MS = 5000;

const GRADIENTS = [
  "bg-gradient-to-br from-rose-400 to-orange-300",
  "bg-gradient-to-br from-fuchsia-500 to-cyan-500",
  "bg-gradient-to-br from-violet-500 to-purple-500",
  "bg-gradient-to-br from-emerald-400 to-cyan-400",
  "bg-gradient-to-br from-blue-500 to-teal-400",
  "bg-gradient-to-br from-indigo-500 to-blue-500",
];

function getGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function sortByUpdated(list: DashboardProject[]): DashboardProject[] {
  return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function ProjectCard({
  project,
  selected,
  selectionActive,
  onToggleSelect,
  onRequestDelete,
  onRenamed,
}: {
  project: DashboardProject;
  selected: boolean;
  selectionActive: boolean;
  onToggleSelect: (docRef: string) => void;
  onRequestDelete: (docRef: string) => void;
  onRenamed: (docRef: string, name: string) => void;
}) {
  const { Icon, label } = KIND_META[project.kind];
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const submitRename = async () => {
    const name = draft.trim();
    if (!name || name === project.name) {
      setRenaming(false);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/projects/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docRef: project.docRef, name }),
      });
      const data = (await res.json()) as { name?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Rename failed");
      onRenamed(project.docRef, data.name || name);
      setRenaming(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <CutoutCard
      className={`group relative flex flex-col transition-colors ${cutoutCardSurfaceClassName} ${
        selected ? "border-[var(--dash-primary)] ring-1 ring-[var(--dash-primary)]" : "border-[var(--dash-border)] hover:border-[var(--dash-border-strong)]"
      }`}
    >
      {!renaming && (
        <Link
          href={`/wiki?doc=${encodeURIComponent(project.docRef)}`}
          className="absolute inset-0 z-0"
          aria-label={`Open ${project.name}`}
        />
      )}

      {/* Select checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={selected ? "Deselect project" : "Select project"}
        onClick={() => onToggleSelect(project.docRef)}
        className={`absolute left-4 top-4 z-20 flex h-6 w-6 items-center justify-center rounded-[8px] border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-ring)] ${
          selected
            ? "border-[var(--dash-primary)] bg-[var(--dash-primary)] text-[var(--dash-primary-foreground)]"
            : `border-[var(--dash-border)] bg-[var(--dash-surface)] text-transparent hover:border-[var(--dash-border-strong)] ${
                selectionActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`
        }`}
      >
        <IconCheck size={14} />
      </button>

      <CutoutCardMedia className={`flex h-32 items-center justify-center border-b border-[var(--dash-border)] ${getGradient(project.name)}`}>
        <Icon size={32} className="pointer-events-none text-white/90 drop-shadow-md z-10 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-110" />
        <CutoutCardOverlay />
        
        <CutoutCardInsetLabel className="bottom-0 left-0 rounded-tr-[20px] bg-[var(--dash-surface)] px-4 py-2">
          <span className="font-gtstandardmono text-[10px] uppercase tracking-wider text-[var(--dash-muted-fg)]/70">
            {label}
          </span>
          <CutoutCorner className="absolute -right-[31.5px] -bottom-px rotate-90 text-[var(--dash-surface)]" />
          <CutoutCorner className="absolute -top-[31.5px] -left-px rotate-90 text-[var(--dash-surface)]" />
        </CutoutCardInsetLabel>
      </CutoutCardMedia>

      <CutoutCardContent className="flex flex-1 flex-col p-4 bg-[var(--dash-surface)] rounded-b-[28px]">
        <div className="pointer-events-none mb-1 flex items-center gap-2">
          <span className="font-gtstandardmono text-[10px] uppercase tracking-wider text-[var(--dash-muted-fg)]/50">
            Updated {relativeTime(project.updatedAt)}
          </span>
        </div>

        {renaming ? (
          <div className="relative z-10">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              disabled={busy}
              className="mb-2 w-full rounded-md border border-[var(--dash-border-strong)] px-2 py-1 text-[14px] outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void submitRename()}
                disabled={busy}
                className="rounded-md bg-[var(--dash-foreground)] px-3 py-1 text-[12px] font-medium text-[var(--dash-surface)] disabled:opacity-40"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(project.name);
                  setRenaming(false);
                }}
                className="rounded-md border border-[var(--dash-border)] px-3 py-1 text-[12px] text-[var(--dash-muted-fg)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <h3 className="pointer-events-none mb-3 line-clamp-2 text-[16px] font-sans tracking-tight font-medium leading-snug text-[var(--dash-foreground)]">
            {project.name}
          </h3>
        )}

        {!renaming && (
          <div className="pointer-events-none mt-auto flex items-center gap-4 text-[12px] text-[var(--dash-muted-fg)]">
            {project.tokens + project.components > 0 ? (
              <>
                {project.tokens > 0 && (
                  <span>
                    {project.tokens} token{project.tokens === 1 ? "" : "s"}
                  </span>
                )}
                {project.components > 0 && (
                  <span>
                    {project.components} component
                    {project.components === 1 ? "" : "s"}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[var(--dash-subtle-fg)] transition-colors group-hover:text-[var(--dash-foreground)]">
                Open →
              </span>
            )}
          </div>
        )}

        {err && <p className="relative z-10 mt-2 text-[12px] text-[var(--dash-destructive)]">{err}</p>}
      </CutoutCardContent>

      <CutoutCardAction className="right-2 top-2 z-20">
        {!renaming && (
          <button
            type="button"
            aria-label="Project actions"
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex h-7 w-7 items-center justify-center rounded-md text-[var(--dash-muted-fg)] transition-colors hover:bg-[var(--dash-muted)] hover:text-[var(--dash-foreground)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-ring)] ${
              menuOpen ? "bg-[var(--dash-muted)] text-[var(--dash-foreground)]" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <span className="text-[18px] leading-none">⋯</span>
          </button>
        )}
      </CutoutCardAction>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-2 top-10 z-30 w-40 overflow-hidden rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] py-1 shadow-md">
            <button
              type="button"
              onClick={() => {
                setRenaming(true);
                setDraft(project.name);
                setMenuOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-[13px] text-[var(--dash-foreground)] hover:bg-[var(--dash-muted)]"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onRequestDelete(project.docRef);
              }}
              className="block w-full px-3 py-2 text-left text-[13px] text-[var(--dash-destructive)] hover:bg-[var(--dash-muted)]"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </CutoutCard>
  );
}

export function ProjectGrid({ projects }: { projects: DashboardProject[] }) {
  const [items, setItems] = useState(projects);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ text: string; onUndo: () => void } | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"All" | ProjectKind>("All");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const pending = useRef<{
    removed: DashboardProject[];
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const finalize = async (removed: DashboardProject[]) => {
    await Promise.all(
      removed.map((p) =>
        fetch("/api/projects/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docRef: p.docRef }),
        }).catch(() => {}),
      ),
    );
  };

  // Commit any in-flight (undo-able) delete immediately.
  const flushPending = () => {
    if (!pending.current) return;
    clearTimeout(pending.current.timer);
    const { removed } = pending.current;
    pending.current = null;
    void finalize(removed);
  };

  const requestDelete = (docRefs: string[]) => {
    flushPending();
    const removed = items.filter((p) => docRefs.includes(p.docRef));
    if (removed.length === 0) return;

    setItems((cur) => cur.filter((p) => !docRefs.includes(p.docRef)));
    setSelected(new Set());

    const timer = setTimeout(() => {
      const batch = pending.current?.removed ?? removed;
      pending.current = null;
      setToast(null);
      void finalize(batch);
    }, UNDO_MS);
    pending.current = { removed, timer };

    setToast({
      text: `${removed.length} project${removed.length > 1 ? "s" : ""} deleted`,
      onUndo: () => {
        if (pending.current) clearTimeout(pending.current.timer);
        const restore = pending.current?.removed ?? removed;
        pending.current = null;
        setItems((cur) => sortByUpdated([...cur, ...restore]));
        setToast(null);
      },
    });
  };

  const toggleSelect = (docRef: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(docRef)) next.delete(docRef);
      else next.add(docRef);
      return next;
    });

  const onRenamed = (docRef: string, name: string) =>
    setItems((cur) => cur.map((p) => (p.docRef === docRef ? { ...p, name } : p)));

  const availableKinds = (
    ["Figma", "Scan", "Design", "Sample"] as ProjectKind[]
  ).filter((k) => items.some((p) => p.kind === k));

  const q = query.trim().toLowerCase();
  const visible = items
    .filter((p) => kind === "All" || p.kind === kind)
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : b.updatedAt.localeCompare(a.updatedAt),
    );

  const chip = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-[13px] transition-colors ${
      active
        ? "bg-[var(--dash-foreground)] text-[var(--dash-surface)]"
        : "border border-[var(--dash-border)] text-[var(--dash-muted-fg)] hover:text-[var(--dash-foreground)]"
    }`;

  return (
    <>
      {items.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-sm flex-1">
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dash-muted-fg)]/60"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] py-2 pl-9 pr-3 text-[14px] outline-none placeholder:text-[var(--dash-muted-fg)]/60 focus:border-[var(--dash-primary)]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setKind("All")}
              className={chip(kind === "All")}
            >
              All
            </button>
            {availableKinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={chip(kind === k)}
              >
                {KIND_META[k].label}
              </button>
            ))}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "recent" | "name")}
              aria-label="Sort projects"
              className="rounded-md border border-[var(--dash-border)] bg-[var(--dash-surface)] px-2 py-1.5 text-[13px] text-[var(--dash-muted-fg)] outline-none focus:border-[var(--dash-primary)]"
            >
              <option value="recent">Recent</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--dash-border-strong)] bg-[var(--dash-surface)] px-4 py-2.5">
          <span className="text-[14px] text-[var(--dash-foreground)]">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => requestDelete([...selected])}
              className="rounded-md bg-[var(--dash-destructive)] px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-[13px] text-[var(--dash-muted-fg)] hover:text-[var(--dash-foreground)]"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--dash-border)] bg-[var(--dash-surface)] p-12 text-center">
          <p className="text-[15px] text-[var(--dash-muted-fg)]">No projects yet.</p>
          <p className="mt-1 text-[13px] text-[var(--dash-subtle-fg)]">
            Name one above, paste a design.md, upload a file, or import from Figma /
            scan a repo to get started.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--dash-border)] bg-[var(--dash-surface)] p-10 text-center">
          <p className="text-[14px] text-[var(--dash-muted-fg)]">
            No projects match{query ? ` “${query.trim()}”` : " this filter"}.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setKind("All");
            }}
            className="mt-2 text-[13px] text-[var(--dash-foreground)] underline underline-offset-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <ProjectCard
              key={p.docRef}
              project={p}
              selected={selected.has(p.docRef)}
              selectionActive={selected.size > 0}
              onToggleSelect={toggleSelect}
              onRequestDelete={(docRef) => requestDelete([docRef])}
              onRenamed={onRenamed}
            />
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-lg bg-[var(--dash-foreground)] px-4 py-3 text-[var(--dash-surface)] shadow-lg">
          <span className="text-[14px]">{toast.text}</span>
          <button
            type="button"
            onClick={toast.onUndo}
            className="text-[14px] font-medium text-[var(--dash-surface)] underline underline-offset-2 hover:opacity-80"
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
}
