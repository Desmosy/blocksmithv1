type BadgeProps = {
  label: string;
};

export function Badge({ label }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-block",
        backgroundColor: "var(--acme-accent-muted)",
        color: "var(--acme-text)",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}
