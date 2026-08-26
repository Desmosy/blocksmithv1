"use client";

import type { PresetSummary } from "./types";

/**
 * The header: which design system is governing, and whether the agent surface
 * is live. Both facts need to be visible at a glance — the whole premise is
 * that a human and an agent are looking at the same state.
 */
export function LabPresetBar({
  presets,
  active,
  onSelect,
  supported,
  registeredCount,
  registrationError,
}: {
  presets: PresetSummary[];
  active: string;
  onSelect: (fileName: string) => void;
  supported: boolean;
  registeredCount: number;
  registrationError: string | null;
}) {
  return (
    <header className="lab-bar">
      <div className="lab-bar-row">
        <div className="lab-brand">
          <span className="lab-brand-name">BlockSmith Lab</span>
          <span className="lab-brand-sub">
            Governed UI, for people and their agents
          </span>
        </div>
        <AgentStatus
          supported={supported}
          count={registeredCount}
          error={registrationError}
        />
      </div>

      <div className="lab-presets" role="tablist" aria-label="Design system">
        {presets.map((p) => {
          const isActive = p.fileName === active;
          return (
            <button
              key={p.fileName}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`lab-preset${isActive ? " is-active" : ""}`}
              onClick={() => onSelect(p.fileName)}
            >
              <span className="lab-preset-swatches" aria-hidden="true">
                {p.swatches.map((hex) => (
                  <span key={hex} style={{ background: hex }} />
                ))}
              </span>
              <span className="lab-preset-text">
                <span className="lab-preset-name">{p.name}</span>
                <span className="lab-preset-meta">
                  {p.componentCount} components · {p.tokenCount} tokens
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </header>
  );
}

function AgentStatus({
  supported,
  count,
  error,
}: {
  supported: boolean;
  count: number;
  error: string | null;
}) {
  if (error) {
    return (
      <p className="lab-agent lab-agent-error" role="status">
        <span className="lab-dot" aria-hidden="true" />
        Agent tools failed to register — {error}
      </p>
    );
  }
  if (!supported) {
    return (
      <p className="lab-agent lab-agent-off" role="status">
        <span className="lab-dot" aria-hidden="true" />
        <span>
          No agent connected — open in ChatGPT&apos;s browser, or enable{" "}
          <code>chrome://flags/#enable-webmcp-testing</code> and relaunch.
        </span>
      </p>
    );
  }
  return (
    <p className="lab-agent lab-agent-on" role="status">
      <span className="lab-dot" aria-hidden="true" />
      {count} agent tools live on this page
    </p>
  );
}
