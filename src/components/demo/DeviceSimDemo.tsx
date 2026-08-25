"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { DeviceProfile } from "@/lib/ir/targets/device-sim";

/**
 * device-sim compile target demo — renders the SAME promoted block graph the
 * wiki and Pulse read, on watch/HMI frames. Every color and radius on screen
 * is traceable to a block id @ version pinned in blocksmith.lock.
 */
export function DeviceSimDemo({
  profiles,
  tokensHeader,
}: {
  profiles: DeviceProfile[];
  tokensHeader: string;
}) {
  const [frameId, setFrameId] = useState(profiles[0]?.frame.id ?? "watch-240");
  const [showHeader, setShowHeader] = useState(false);
  const profile = useMemo(
    () => profiles.find((p) => p.frame.id === frameId) ?? profiles[0],
    [profiles, frameId],
  );

  if (!profile) {
    return (
      <main style={page}>
        <h1 style={h1}>Device simulator</h1>
        <p style={{ color: "#888" }}>
          No promoted blocks yet — open the wiki, Finalize a block, then reload.
        </p>
      </main>
    );
  }

  const colors = profile.tokens.filter((t) => t.kind === "color" && t.rgb != null);
  const accent =
    colors.find((t) => t.id.includes("accent")) ?? colors[0] ?? null;
  const surface =
    profile.tokens.find((t) => t.kind === "surface" && t.rgb != null) ?? null;
  const bg = surface?.value ?? "#101014";
  const fg = accent?.value ?? "#d97757";
  const primary =
    profile.widgets.find((w) => w.id.includes("primary") || w.id.includes("button")) ??
    profile.widgets[0] ??
    null;
  const enforced = profile.constraints.filter((c) => c.severity === "enforce");
  const { frame, minTouchPx } = profile;
  const scale = Math.min(1, 320 / Math.max(frame.width, frame.height));

  return (
    <main style={page}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={h1}>Device simulator — same protocol, embedded surface</h1>
        <p style={{ color: "#9a9a9a", maxWidth: 720, lineHeight: 1.5 }}>
          Compiled from the official <code style={code}>blocksmith.blocks.v1</code>{" "}
          graph <code style={code}>{profile.graphHash}</code> — the same promoted
          block versions the wiki renders and <code style={code}>blocksmith.lock</code>{" "}
          pins for agents. No PDF, no screenshot, no re-design.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {profiles.map((p) => (
            <button
              key={p.frame.id}
              onClick={() => setFrameId(p.frame.id)}
              style={{
                ...chip,
                background: p.frame.id === frameId ? fg : "transparent",
                color: p.frame.id === frameId ? "#101014" : "#ccc",
                borderColor: p.frame.id === frameId ? fg : "#3a3a40",
              }}
            >
              {p.frame.label}
            </button>
          ))}
          <button onClick={() => setShowHeader((s) => !s)} style={{ ...chip, color: "#ccc", borderColor: "#3a3a40" }}>
            {showHeader ? "Hide" : "Show"} tokens.h
          </button>
        </div>
      </header>

      <div style={{ display: "flex", gap: 40, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* ── The simulated device ─────────────────────────────────── */}
        <figure style={{ margin: 0 }}>
          <div
            style={{
              width: frame.width * scale,
              height: frame.height * scale,
              borderRadius: frame.shape === "round" ? "50%" : 18 * scale,
              background: bg,
              border: "6px solid #2a2a30",
              boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 14 * scale,
              overflow: "hidden",
            }}
          >
            <div style={{ color: "#e8e8ea", fontSize: 13 * scale * 1.6, fontWeight: 600 }}>
              12:42
            </div>
            {primary && (
              <button
                title={`${primary.id}@v${primary.version} · ${primary.contentHash}`}
                style={{
                  minWidth: Math.max(minTouchPx, 96) * scale,
                  minHeight: minTouchPx * scale,
                  borderRadius: primary.cornerRadiusPx * scale * 2,
                  background: fg,
                  color: "#101014",
                  border: "none",
                  fontSize: 12 * scale * 1.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {primary.title}
              </button>
            )}
            <div style={{ display: "flex", gap: 6 * scale }}>
              {colors.slice(0, 5).map((t) => (
                <span
                  key={t.id}
                  title={`${t.id}@v${t.version} = ${t.value}`}
                  style={{
                    width: 14 * scale * 1.4,
                    height: 14 * scale * 1.4,
                    borderRadius: "50%",
                    background: t.value,
                    border: "1px solid rgba(255,255,255,0.25)",
                  }}
                />
              ))}
            </div>
          </div>
          <figcaption style={{ color: "#777", fontSize: 12, marginTop: 10, textAlign: "center" }}>
            {frame.label} · min touch {minTouchPx}px ({frame.pxPerMm}px/mm)
          </figcaption>
        </figure>

        {/* ── Traceability panel ───────────────────────────────────── */}
        <section style={{ flex: 1, minWidth: 320, maxWidth: 560 }}>
          <h2 style={h2}>What survived the compile</h2>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                {["Block", "v", "Compiled as", "Hash"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colors.slice(0, 6).map((t) => (
                <tr key={t.id}>
                  <td style={td}><code style={code}>{t.id}</code></td>
                  <td style={td}>v{t.version}</td>
                  <td style={td}>
                    <span style={{ display: "inline-block", width: 10, height: 10, background: t.value, borderRadius: 2, marginRight: 6 }} />
                    {t.value}
                  </td>
                  <td style={{ ...td, color: "#777" }}>{t.contentHash.slice(7, 17)}…</td>
                </tr>
              ))}
              {profile.widgets.slice(0, 4).map((w) => (
                <tr key={w.id}>
                  <td style={td}><code style={code}>{w.id}</code></td>
                  <td style={td}>v{w.version}</td>
                  <td style={td}>
                    <code style={code}>{w.widget}</code> · r{w.cornerRadiusPx}px · ≥{w.minTouchPx}px
                  </td>
                  <td style={{ ...td, color: "#777" }}>{w.contentHash.slice(7, 17)}…</td>
                </tr>
              ))}
            </tbody>
          </table>

          {enforced.length > 0 && (
            <>
              <h2 style={h2}>Governance compiled as constraints</h2>
              <ul style={{ color: "#bbb", fontSize: 13, lineHeight: 1.6, paddingLeft: 18 }}>
                {enforced.slice(0, 6).map((c, i) => (
                  <li key={`${c.id}-${i}`}>
                    {c.rule}{" "}
                    <span style={{ color: "#666" }}>
                      ({c.id}@v{c.version})
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 style={h2}>Invariants this target preserves</h2>
          <ul style={{ color: "#bbb", fontSize: 13, lineHeight: 1.6, paddingLeft: 18 }}>
            {profile.invariants.map((inv) => (
              <li key={inv}>{inv}</li>
            ))}
          </ul>
        </section>
      </div>

      {showHeader && (
        <section style={{ marginTop: 32 }}>
          <h2 style={h2}>tokens.h — Phase 2 export (generated from the same graph)</h2>
          <pre
            style={{
              background: "#16161a",
              border: "1px solid #2a2a30",
              borderRadius: 10,
              padding: 16,
              fontSize: 12,
              lineHeight: 1.5,
              color: "#c8c8cc",
              overflowX: "auto",
            }}
          >
            {tokensHeader}
          </pre>
        </section>
      )}
    </main>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  background: "#0c0c0f",
  color: "#e8e8ea",
  padding: "48px clamp(20px, 6vw, 72px)",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
};
const h1: CSSProperties = { fontSize: 24, fontWeight: 700, marginBottom: 8 };
const h2: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#8a8a92",
  margin: "24px 0 10px",
};
const code: CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  fontSize: "0.92em",
  background: "rgba(255,255,255,0.06)",
  padding: "1px 5px",
  borderRadius: 4,
};
const chip: CSSProperties = {
  padding: "6px 14px",
  borderRadius: 999,
  border: "1px solid",
  background: "transparent",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const th: CSSProperties = {
  textAlign: "left",
  padding: "6px 10px",
  borderBottom: "1px solid #2a2a30",
  color: "#8a8a92",
  fontWeight: 600,
};
const td: CSSProperties = {
  padding: "6px 10px",
  borderBottom: "1px solid #1d1d22",
};
