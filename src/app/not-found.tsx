import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8fafc] px-6 text-center text-[#1d1c20]">
      <p className="font-mono text-[12px] uppercase tracking-wider text-black/40">
        404
      </p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-sm text-black/55">
        That page doesn’t exist or may have moved.
      </p>
      <div className="mt-2 flex gap-3">
        <Link
          href="/dashboard"
          className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-black/80"
        >
          Go to dashboard
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-black/15 px-5 py-2 text-sm font-medium text-black transition-colors hover:border-black/40"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
