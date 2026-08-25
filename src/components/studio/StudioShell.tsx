import Link from "next/link";
import { hrefWithDoc } from "@/lib/wiki/doc-param";

export function StudioShell({
  children,
  systemName,
  docFileName,
}: {
  children: React.ReactNode;
  systemName: string;
  docFileName: string;
}) {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--wiki-bg, #fafafa)", color: "var(--wiki-text, #1a1a1a)" }}
    >
      <header
        className="sticky top-0 z-10 border-b"
        style={{
          borderColor: "var(--wiki-border, #e5e7eb)",
          background: "var(--wiki-nav-bg, var(--wiki-bg, #fff))",
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--wiki-muted)]">
              Pretext Components
            </p>
            <h1 className="text-lg font-semibold">{systemName}</h1>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href={hrefWithDoc("/wiki", docFileName)}
              className="text-[var(--wiki-muted)] transition hover:text-[var(--wiki-text)]"
            >
              Wiki
            </Link>
            <span className="rounded-full border border-[var(--wiki-border)] px-3 py-1 text-xs font-medium">
              @blocksmith/pretext-components
            </span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
