"use client";

/**
 * GovernanceSettingsPanel — admin/owner-only settings for deviation TTL,
 * budget limits, and escalation thresholds. Displayed on the Sync page.
 */

import { useEffect, useState, useCallback } from "react";

type Settings = {
  ttlHours: number;
  maxOpenPerDev: number;
  rejectionsBeforeBlock: number;
  allowAutoApprove: boolean;
  notifyTeamEmail: boolean;
  notifyTeamWiki: boolean;
  reviewRoles: string[];
};

export function GovernanceSettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/governance/settings");
      if (!res.ok) {
        setSettings(null);
        return;
      }
      const data = (await res.json()) as { settings: Settings };
      setSettings(data.settings);
    } catch {
      setError("Could not load governance settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/v1/governance/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = (await res.json()) as { settings: Settings };
        setSettings(data.settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Save failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 rounded-xl border border-[var(--wiki-border)] p-5">
        <p className="text-sm text-[var(--wiki-muted)]">Loading settings…</p>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="mt-6 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-5">
      <h2 className="text-sm font-semibold">Governance Settings</h2>
      <p className="mt-1 text-xs text-[var(--wiki-muted)]">
        Controls how deviations are reviewed and auto-approved. Admin and owner
        only.
      </p>

      <div className="mt-4 space-y-4">
        {/* TTL Hours */}
        <SettingRow
          label="Auto-approve timeout"
          hint="Hours before a pending deviation auto-approves if no one reviews it."
        >
          <NumberInput
            value={settings.ttlHours}
            min={1}
            max={720}
            suffix="hours"
            onChange={(v) => setSettings({ ...settings, ttlHours: v })}
          />
        </SettingRow>

        {/* Max open per dev */}
        <SettingRow
          label="Max open deviations per developer"
          hint="Developers with this many pending deviations will be blocked from pushing more."
        >
          <NumberInput
            value={settings.maxOpenPerDev}
            min={1}
            max={50}
            onChange={(v) => setSettings({ ...settings, maxOpenPerDev: v })}
          />
        </SettingRow>

        {/* Rejections before block */}
        <SettingRow
          label="Rejections before block"
          hint="After this many rejections on the same block, that block is locked for the developer."
        >
          <NumberInput
            value={settings.rejectionsBeforeBlock}
            min={1}
            max={10}
            onChange={(v) =>
              setSettings({ ...settings, rejectionsBeforeBlock: v })
            }
          />
        </SettingRow>

        {/* Auto-approve toggle */}
        <SettingRow
          label="Allow auto-approve"
          hint="When on, deviations auto-approve after the timeout. When off, they stay pending until manually reviewed."
        >
          <Toggle
            checked={settings.allowAutoApprove}
            onChange={(v) => setSettings({ ...settings, allowAutoApprove: v })}
          />
        </SettingRow>

        {/* Notifications */}
        <SettingRow
          label="Notify design team"
          hint="How the design team is notified of new deviations."
        >
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={settings.notifyTeamWiki}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notifyTeamWiki: e.target.checked,
                  })
                }
                className="rounded"
              />
              Wiki
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={settings.notifyTeamEmail}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notifyTeamEmail: e.target.checked,
                  })
                }
                className="rounded"
              />
              Email
            </label>
          </div>
        </SettingRow>
      </div>

      {/* Save button */}
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md px-4 py-2 text-xs font-medium text-white transition-colors"
          style={{ backgroundColor: saving ? "var(--wiki-muted)" : "#6366f1" }}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saved && (
          <span className="text-xs font-medium" style={{ color: "#22c55e" }}>
            ✓ Saved
          </span>
        )}
        {error && (
          <span className="text-xs font-medium" style={{ color: "#ef4444" }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Small components ─────────────────────────────────────────────────────────

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--wiki-border)] px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-[11px] text-[var(--wiki-muted)]">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        className="w-16 rounded-md border border-[var(--wiki-border)] bg-transparent px-2 py-1 text-center text-sm font-medium text-[var(--wiki-text)] focus:outline-none focus:ring-1 focus:ring-[var(--wiki-text)]"
      />
      {suffix && (
        <span className="text-xs text-[var(--wiki-muted)]">{suffix}</span>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
      style={{ backgroundColor: checked ? "#6366f1" : "var(--wiki-border)" }}
    >
      <span
        className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
      />
    </button>
  );
}
