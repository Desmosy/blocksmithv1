import Link from "next/link";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-ink-black">
      <div className="mx-auto max-w-[720px]">
        <Link
          href="/"
          className="font-gtstandardmono text-[11px] uppercase tracking-wider text-graphite hover:text-ink-black"
        >
          ← BlockSmith
        </Link>
        <h1 className="mt-6 text-[32px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-[13px] text-graphite">Last updated: {updated}</p>
        <div className="legal-prose mt-8 space-y-5 text-[15px] leading-relaxed text-ink-black/85">
          {children}
        </div>
        <p className="mt-12 rounded-lg border border-dashed border-lavender-mist bg-faint-slate p-4 text-[13px] text-graphite">
          This is a starting draft. Have counsel review and replace the
          bracketed placeholders before relying on it.
        </p>
      </div>
    </main>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-[18px] font-semibold text-ink-black">{heading}</h2>
      <div className="space-y-2 text-graphite">{children}</div>
    </section>
  );
}
