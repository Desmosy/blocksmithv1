"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { IconCheck } from "@/components/icons/streamline";

function PostScanBannerInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  const scanned = params.get("scanned");
  if (scanned == null || dismissed) return null;

  const count = Number.parseInt(scanned, 10);
  const countLabel =
    Number.isFinite(count) && count > 0
      ? `${count} component${count === 1 ? "" : "s"} ready`
      : "your components are ready";

  const dismiss = () => {
    setDismissed(true);
    const next = new URLSearchParams(params.toString());
    next.delete("scanned");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const doc = params.get("doc");
  const pipelineHref = `/wiki/pipeline${doc ? `?doc=${encodeURIComponent(doc)}` : ""}`;

  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm"
      style={{
        borderColor: "var(--wiki-border)",
        backgroundColor: "var(--wiki-bg)",
      }}
    >
      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: "var(--wiki-active)",
          color: "var(--wiki-text)",
        }}
      >
        <IconCheck size={14} />
      </span>
      <div className="min-w-0">
        <p className="font-medium text-[var(--wiki-text)]">
          Scan complete — {countLabel}.
        </p>
        <p className="text-xs text-[var(--wiki-muted)]">
          Review and promote, or read the generated docs.
        </p>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <a
          href={pipelineHref}
          className="rounded-full bg-[var(--wiki-text)] px-4 py-1.5 text-xs font-medium text-[var(--wiki-bg)] hover:opacity-90"
        >
          Open Pipeline
        </a>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full border border-[var(--wiki-text)] px-4 py-1.5 text-xs font-medium text-[var(--wiki-text)] hover:bg-[var(--wiki-text)] hover:text-[var(--wiki-bg)]"
        >
          Browse the wiki
        </button>
      </div>
    </div>
  );
}

export function PostScanBanner() {
  return (
    <Suspense fallback={null}>
      <PostScanBannerInner />
    </Suspense>
  );
}
