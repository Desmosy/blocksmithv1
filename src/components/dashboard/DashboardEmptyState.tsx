"use client";

/**
 * Shown when there are no design systems yet.
 *
 * Deliberately small. The prompt bar directly above already takes a site
 * address, a name, or a design.md, and carries Upload / Figma / Scan buttons —
 * so this used to restate all of it in a second panel, and the screen read as
 * the same offer twice. What is left is the part the bar cannot say: that
 * nothing is here yet, and what the fastest first move is.
 */
export function DashboardEmptyState({ aiEnabled }: { aiEnabled?: boolean }) {
  return (
    <div className="rounded-[var(--dash-radius)] border border-dashed border-[var(--dash-border)] bg-[var(--dash-surface)] px-8 py-10 text-center">
      <h2 className="text-[16px] font-medium text-[var(--dash-foreground)]">
        No design systems yet
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-[14px] leading-relaxed text-[var(--dash-muted-fg)]">
        The quickest start is a site you already like — type{" "}
        <button
          type="button"
          onClick={() => {
            const el = document.querySelector<HTMLTextAreaElement>(
              "[data-prompt-bar-input]",
            );
            if (!el) return;
            el.focus();
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          className="rounded border border-[var(--dash-border)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--dash-foreground)] hover:bg-[var(--dash-muted)]"
        >
          linear.app
        </button>{" "}
        into the bar above and BlockSmith reads its colours, type and spacing
        into a governed system. Figma, a repo, or a{" "}
        <code className="text-[13px]">design.md</code> work the same way.
      </p>
      {!aiEnabled ? (
        <p className="mt-4 text-[12px] text-[var(--dash-subtle-fg)]">
          AI generation is off — set a model to describe a system from scratch.
        </p>
      ) : null}
    </div>
  );
}
