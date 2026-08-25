import Link from "next/link";

export const dynamic = "force-dynamic";

export default function PublicShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--wiki-bg)] text-[var(--wiki-text)]">
      <header className="border-b border-[var(--wiki-border)] px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--wiki-muted)]">
              BlockSmith · Public preview
            </p>
            <p className="mt-0.5 text-sm text-[var(--wiki-muted)]">
              Pre-launch feedback on a single design block
            </p>
          </div>
          <Link
            href="/wiki"
            className="shrink-0 text-xs font-medium text-[var(--wiki-muted)] hover:text-[var(--wiki-text)]"
          >
            Design wiki →
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
