"use client";

export function VisualizeLoadingOverlay({
  open,
  stage,
}: {
  open: boolean;
  stage?: string | null;
}) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center"
      style={{ backgroundColor: "rgba(247, 245, 242, 0.92)" }}
      role="status"
      aria-busy="true"
      aria-label="Applying design system"
    >
      <div className="flex max-w-sm flex-col items-center gap-8 px-8 text-center">
        <div className="relative h-16 w-16">
          <div
            className="visualize-spinner absolute inset-0 rounded-full border-4 border-transparent"
            style={{
              borderTopColor: "var(--wiki-accent, #ebf212)",
              borderRightColor: "var(--wiki-accent, #ebf212)",
            }}
          />
          <div
            className="absolute inset-2 rounded-full"
            style={{ backgroundColor: "var(--wiki-bg, #f7f5f2)" }}
          />
        </div>
        <div>
          <p
            className="text-lg font-semibold tracking-tight"
            style={{ color: "var(--wiki-text, #000000)" }}
          >
            AI Lab — compiling chrome
          </p>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--wiki-text-muted, #47423d)" }}
          >
            {stage ??
              "Parallel AI agents: 2 primaries at once → refiner merge. May take up to 5 minutes."}
          </p>
        </div>
        <div className="flex gap-2">
          {[
            "var(--wiki-bg, #f7f5f2)",
            "var(--wiki-accent, #ebf212)",
            "var(--wiki-text, #000000)",
            "var(--wiki-border, #ccc9c6)",
            "var(--wiki-sidebar, #ffffff)",
          ].map((c) => (
            <div
              key={c}
              className="h-3 w-8 rounded-full"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
