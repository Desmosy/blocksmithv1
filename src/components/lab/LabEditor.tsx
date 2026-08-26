"use client";

import { useId } from "react";

const SAMPLES: { label: string; code: string }[] = [
  {
    label: "Pricing card",
    code: `export function PricingCard() {
  return (
    <div className="p-5 rounded-xl shadow-lg bg-gradient-to-br from-slate-900 to-black">
      <h3 className="text-2xl font-bold text-blue-600">Pro</h3>
      <p className="text-sm mt-3">$29 / month</p>
      <button className="rounded-lg px-6 py-3 bg-blue-500">Start trial</button>
    </div>
  );
}`,
  },
  {
    label: "Hero",
    code: `export function Hero() {
  return (
    <section style={{ background: "linear-gradient(135deg,#667eea,#764ba2)", padding: 48 }}>
      <h1 style={{ color: "#ffffff", fontSize: 42 }}>Jane Doe</h1>
      <p style={{ color: "#e0e0e0" }}>Full-stack developer</p>
      <button style={{ background: "#3b82f6", borderRadius: 12 }}>Hire me</button>
    </section>
  );
}`,
  },
];

/**
 * A plain textarea, deliberately. The point of this page is the verdict, not
 * the editing experience — a syntax-highlighting editor would add weight and
 * a second scroll context for no gain.
 */
export function LabEditor({
  code,
  onChange,
  presetName,
}: {
  code: string;
  onChange: (next: string) => void;
  presetName: string;
}) {
  const id = useId();

  return (
    <div className="lab-editor">
      <div className="lab-pane-head">
        <label className="lab-pane-title" htmlFor={id}>
          Component
        </label>
        <div className="lab-samples">
          <span className="lab-samples-label">Try:</span>
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              type="button"
              className="lab-chip"
              onClick={() => onChange(s.code)}
            >
              {s.label}
            </button>
          ))}
          {code ? (
            <button
              type="button"
              className="lab-chip"
              onClick={() => onChange("")}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <textarea
        id={id}
        className="lab-textarea"
        value={code}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder={`Paste a component, or ask your agent to build one.\n\nIt will be checked against ${presetName} as you type.`}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="lab-hint">
        Checked against <strong>{presetName}</strong> on every edit.
      </p>
    </div>
  );
}
