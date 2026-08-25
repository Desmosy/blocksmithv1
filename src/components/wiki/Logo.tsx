/** BlockSmith mark — Privy-style ink dot (no gradient bars). */
export function Logo() {
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-lg border"
      style={{
        borderColor: "var(--wiki-border)",
        backgroundColor: "var(--wiki-bg)",
      }}
      aria-hidden
    >
      <span
        className="block h-2 w-2 rounded-full"
        style={{ backgroundColor: "var(--wiki-text)" }}
      />
    </div>
  );
}
