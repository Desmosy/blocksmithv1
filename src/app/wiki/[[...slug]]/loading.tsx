export default function WikiLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-black/15 border-t-black/60" />
        <p className="font-mono text-[11px] uppercase tracking-wider text-black/40">
          Opening project…
        </p>
      </div>
    </div>
  );
}
