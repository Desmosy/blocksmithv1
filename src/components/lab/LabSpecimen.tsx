"use client";

import type { Specimen } from "./types";

/**
 * The design system, rendered.
 *
 * Reading a token table tells you a system's values; it does not tell you
 * whether the system has taste. Every value below comes from the parsed
 * design system — nothing here is hand-styled — so what you see is what the
 * rules actually produce.
 */
export function LabSpecimen({ specimen }: { specimen: Specimen }) {
  const {
    name,
    tagline,
    colors,
    display,
    body,
    mono,
    sizes,
    space,
    radii,
  } = specimen;

  const token = (role: string, fallback: string) =>
    colors.find((c) => c.role.toLowerCase().includes(role))?.value ?? fallback;

  // Surfaces and ink are inferred from role text, which is how the system
  // describes its own colours. Falling back to the extremes of the palette
  // keeps a system with terser role text from rendering unreadably.
  const ground = colors[0]?.value ?? "#ffffff";
  const ink = token("primary text", colors[colors.length - 1]?.value ?? "#000000");
  const muted = token("secondary", ink);
  const accent = token("action", colors[colors.length - 2]?.value ?? ink);
  const line = token("border", muted);
  const card = token("card", ground);

  const s = (i: number, fallback: number) => space[i] ?? fallback;
  const radius = radii[0] ?? 6;

  return (
    <div
      className="lab-specimen"
      style={
        {
          background: ground,
          color: ink,
          "--sp-display": display,
          "--sp-body": body,
          "--sp-mono": mono,
        } as React.CSSProperties
      }
    >
      <div className="lab-specimen-inner" style={{ padding: s(4, 40), gap: s(3, 24) }}>
        <div style={{ display: "flex", flexDirection: "column", gap: s(1, 8) }}>
          <p
            style={{
              fontFamily: mono,
              fontSize: sizes.meta,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: muted,
              margin: 0,
            }}
          >
            {name}
          </p>
          <h2
            style={{
              fontFamily: display,
              fontSize: sizes.heading,
              lineHeight: 1.1,
              margin: 0,
              color: ink,
              textWrap: "balance",
            }}
          >
            {tagline || "The system, rendered."}
          </h2>
          <p
            style={{
              fontFamily: body,
              fontSize: sizes.body,
              lineHeight: 1.6,
              color: muted,
              margin: 0,
              maxWidth: "58ch",
            }}
          >
            Every value on this card comes from the parsed design system — the
            typefaces, the scale, the spacing, the radii. Nothing is hand-styled.
          </p>
        </div>

        <div style={{ display: "flex", gap: s(1, 8), flexWrap: "wrap" }}>
          <span
            style={{
              background: accent,
              color: ground,
              fontFamily: body,
              fontSize: sizes.body,
              padding: `${s(1, 8)}px ${s(2, 16)}px`,
              borderRadius: radius,
            }}
          >
            Primary action
          </span>
          <span
            style={{
              background: "transparent",
              color: ink,
              border: `1px solid ${line}`,
              fontFamily: body,
              fontSize: sizes.body,
              padding: `${s(1, 8)}px ${s(2, 16)}px`,
              borderRadius: radius,
            }}
          >
            Secondary
          </span>
        </div>

        <div
          style={{
            background: card,
            border: `1px solid ${line}`,
            borderRadius: radii[1] ?? radius,
            padding: s(2, 16),
            display: "flex",
            flexDirection: "column",
            gap: s(1, 8),
          }}
        >
          <p
            style={{
              fontFamily: mono,
              fontSize: sizes.meta,
              color: muted,
              margin: 0,
              letterSpacing: "0.06em",
            }}
          >
            2026 · CASE STUDY
          </p>
          <p
            style={{
              fontFamily: display,
              fontSize: sizes.subheading,
              margin: 0,
              color: ink,
            }}
          >
            A card in this system
          </p>
        </div>

        <div style={{ display: "flex", gap: 0, borderRadius: 4, overflow: "hidden" }}>
          {colors.slice(0, 10).map((c) => (
            <span
              key={c.value}
              title={`${c.name} ${c.value}`}
              style={{ background: c.value, height: 26, flex: 1 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
