export function Button({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      style={{
        backgroundColor: "var(--mini-brand)",
        color: "#fff",
        borderRadius: "var(--mini-radius)",
        padding: "var(--mini-space)",
        border: "none",
      }}
    >
      {children}
    </button>
  );
}
