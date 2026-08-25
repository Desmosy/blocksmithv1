"use client";

interface ContentToolbarProps {
  viewport: string;
  onViewportChange: (v: string) => void;
  highContrast: boolean;
  onHighContrastChange: (v: boolean) => void;
  previewDark: boolean;
  onPreviewDarkChange: (v: boolean) => void;
}

export function ContentToolbar({
  viewport,
  onViewportChange,
  highContrast,
  onHighContrastChange,
  previewDark,
  onPreviewDarkChange,
}: ContentToolbarProps) {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-4">
      <label className="flex items-center gap-2 text-sm text-[var(--wiki-muted)]">
        <span className="sr-only">Viewport</span>
        <select
          value={viewport}
          onChange={(e) => onViewportChange(e.target.value)}
          className="h-9 rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 pr-8 text-sm text-[var(--wiki-text)] outline-none focus:ring-1 focus:ring-[var(--wiki-text)]"
        >
          <option value="mobile">Mobile</option>
          <option value="tablet">Tablet</option>
          <option value="desktop">Desktop</option>
        </select>
      </label>

      <Toggle
        label="High Contrast"
        checked={highContrast}
        onChange={onHighContrastChange}
      />
      <Toggle
        label="Dark mode"
        checked={previewDark}
        onChange={onPreviewDarkChange}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--wiki-text)]">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${
          checked ? "bg-[var(--wiki-accent)]" : "bg-[var(--wiki-border)]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </label>
  );
}
