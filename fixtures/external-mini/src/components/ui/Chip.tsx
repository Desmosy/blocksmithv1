export function Chip({ label }: { label: string }) {
  return (
    <span
      style={{
        background: "var(--mini-surface)",
        color: "var(--mini-text)",
        borderRadius: "var(--mini-radius)",
        padding: "4px var(--mini-space)",
        fontSize: 12,
      }}
    >
      {label}
    </span>
  );
}
