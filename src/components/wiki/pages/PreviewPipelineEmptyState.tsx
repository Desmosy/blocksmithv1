/**
 * PreviewPipelineEmptyState — honest Pipeline/Releases surface for preview docs.
 *
 * A pasted or sampled document has no repo behind it, so there is no real
 * staging / production / lock to show. Instead of fake cards we explain the
 * mode and point at the one action that turns releases on: connect a repo and
 * scan. The full PipelinePage (team's work) renders untouched once connected.
 */
import Link from "next/link";
import { IconLock } from "@/components/icons/streamline";

export function PreviewPipelineEmptyState({
  route,
}: {
  route?: "pipeline" | "releases";
}) {
  const title = route === "releases" ? "Releases" : "Pipeline";

  return (
    <article className="pipeline-page">
      <header className="pipeline-page-header">
        <div>
          <h1 className="pipeline-page-title">{title}</h1>
          <p className="pipeline-page-subtitle">
            Preview mode — releases aren&apos;t active yet.
          </p>
        </div>
      </header>

      <div
        className="mt-6 rounded-lg border border-dashed p-8 text-center"
        style={{
          borderColor: "var(--wiki-border)",
          backgroundColor: "var(--wiki-bg)",
        }}
      >
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            backgroundColor: "var(--wiki-active)",
            color: "var(--wiki-muted)",
          }}
          aria-hidden
        >
          <IconLock size={20} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-[var(--wiki-text)]">
          Connect your repo to enable releases
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--wiki-muted)]">
          Generated from a document — a preview you can browse. Connect a GitHub
          repo to enable staging, promote, and the production lock.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center rounded-full bg-[var(--wiki-text)] px-5 py-2.5 text-sm font-medium text-[var(--wiki-bg)] hover:opacity-90"
          >
            Connect GitHub and scan
          </Link>
          <Link
            href="/demo/investor"
            className="inline-flex items-center rounded-full border border-[var(--wiki-text)] px-5 py-2.5 text-sm font-medium text-[var(--wiki-text)] hover:bg-[var(--wiki-text)] hover:text-[var(--wiki-bg)]"
          >
            See the release loop
          </Link>
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-[var(--wiki-muted)]">
        Colors, components, and guidelines work in preview. Only promote and
        lock need a connected repo.
      </p>
    </article>
  );
}
