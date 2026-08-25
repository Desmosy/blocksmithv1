"use client";

interface VisualizeStyleButtonProps {
  canVisualize: boolean;
  hasTokens?: boolean;
  aiConfigured?: boolean | null;
  applied: boolean;
  loading: boolean;
  onClick: () => void;
}

export function VisualizeStyleButton({
  canVisualize,
  hasTokens = true,
  aiConfigured = null,
  applied,
  loading,
  onClick,
}: VisualizeStyleButtonProps) {
  if (!hasTokens) {
    return (
      <span className="text-xs text-[var(--wiki-muted)]">
        Add colors or components to visualize
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`rounded-full px-5 py-2 text-sm font-medium transition disabled:opacity-50 ${
        applied
          ? "border border-[var(--wiki-border)] bg-transparent text-[var(--wiki-text)] hover:bg-[var(--wiki-active)]"
          : "border-0 bg-[var(--wiki-cta-fill)] text-[var(--wiki-cta-on-accent)] hover:opacity-90"
      }`}
      aria-pressed={applied}
    >
      {loading
        ? "Compiling…"
        : applied
          ? "Exit design preview"
          : "Visualize style"}
    </button>
  );
}
