"use client";

import type { ComponentDoc, ComponentSpec } from "../types";
import { PretextText } from "./PretextText";
import type { TextSlot } from "../types";

function slot(
  partial: Omit<TextSlot, "id"> & { id?: string },
): TextSlot {
  return { id: partial.id ?? `s-${Math.random().toString(36).slice(2, 8)}`, ...partial };
}

function buttonStyle(spec: ComponentSpec): React.CSSProperties {
  return {
    backgroundColor: spec.backgroundColor,
    color: spec.color,
    border:
      spec.borderWidth !== "0"
        ? `${spec.borderWidth} solid ${spec.borderColor}`
        : "none",
    borderRadius: spec.borderRadius,
    padding: spec.padding,
    fontSize: spec.fontSize,
    fontWeight: spec.fontWeight,
    fontFamily: spec.fontFamily,
    boxShadow: spec.boxShadow !== "none" ? spec.boxShadow : undefined,
    cursor: "default",
    display: "inline-block",
  };
}

function familyFromStack(stack: string): string {
  const m = stack.match(/"([^"]+)"/);
  return m?.[1] ?? stack.split(",")[0]?.trim().replace(/['"]/g, "") ?? "Inter";
}

function textFamily(spec: ComponentSpec): string {
  return familyFromStack(spec.fontFamily);
}

export function ButtonFrame({ spec, maxWidth }: { spec: ComponentSpec; maxWidth: number }) {
  const family = textFamily(spec);
  const label = slot({
    id: "label",
    text: spec.label,
    fontFamily: family,
    fontSize: spec.fontSize,
    fontWeight: spec.fontWeight,
    lineHeight: "1",
    color: spec.color,
    maxWidth: maxWidth - 48,
  });

  return (
    <button type="button" style={buttonStyle(spec)}>
      <PretextText slot={label} maxWidth={maxWidth} />
    </button>
  );
}

export function InputFrame({ spec, maxWidth }: { spec: ComponentSpec; maxWidth: number }) {
  const family = textFamily(spec);
  const placeholder = slot({
    id: "placeholder",
    text: spec.label,
    fontFamily: family,
    fontSize: spec.fontSize,
    fontWeight: "400",
    lineHeight: "1.4",
    color: spec.color,
    maxWidth: maxWidth - 32,
  });

  return (
    <div
      style={{
        width: "100%",
        maxWidth: Math.min(maxWidth, 360),
        backgroundColor: spec.backgroundColor,
        border:
          spec.borderWidth !== "0"
            ? `${spec.borderWidth} solid ${spec.borderColor}`
            : `1px solid ${spec.borderColor}`,
        borderRadius: spec.borderRadius,
        padding: spec.padding,
        fontFamily: spec.fontFamily,
        overflow: "hidden",
      }}
    >
      <PretextText
        slot={placeholder}
        maxWidth={Math.min(maxWidth, 360) - 32}
        style={{ opacity: 0.65, fontSize: spec.fontSize }}
      />
    </div>
  );
}

export function CardFrame({
  spec,
  component,
  maxWidth,
}: {
  spec: ComponentSpec;
  component: ComponentDoc;
  maxWidth: number;
}) {
  const family = textFamily(spec);
  const isStat = /stat|metric|counter/i.test(component.title + component.role);
  const isBlog = /blog|editorial|article/i.test(component.title + component.role);
  const innerWidth = Math.min(maxWidth, 320) - 32;

  const titleSlot = slot({
    id: "title",
    text: spec.label,
    fontFamily: family,
    fontSize: spec.fontSize,
    fontWeight: "600",
    lineHeight: "1.2",
    color: spec.color,
    maxWidth: innerWidth,
  });

  const metricSlot = slot({
    id: "metric",
    text: "97%",
    fontFamily: family,
    fontSize: spec.displaySize ?? "40px",
    fontWeight: "700",
    lineHeight: "1",
    color: spec.color,
    maxWidth: innerWidth,
  });

  const roleSlot = slot({
    id: "role",
    text: component.role.slice(0, 120),
    fontFamily: family,
    fontSize: "14px",
    fontWeight: "400",
    lineHeight: "1.45",
    color: spec.color,
    maxWidth: innerWidth,
  });

  if (isBlog) {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: Math.min(maxWidth, 320),
          backgroundColor: spec.backgroundColor,
          color: spec.color,
          border:
            spec.borderWidth !== "0"
              ? `${spec.borderWidth} solid ${spec.borderColor}`
              : "none",
          borderRadius: spec.borderRadius,
          overflow: "hidden",
          fontFamily: spec.fontFamily,
        }}
      >
        <div className="h-28 w-full" style={{ background: "var(--wiki-accent, #888)", opacity: 0.85 }} />
        <div style={{ padding: spec.padding }}>
          <PretextText slot={titleSlot} maxWidth={innerWidth} />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: Math.min(maxWidth, 280),
        backgroundColor: spec.backgroundColor,
        color: spec.color,
        border:
          spec.borderWidth !== "0"
            ? `${spec.borderWidth} solid ${spec.borderColor}`
            : "none",
        borderRadius: spec.borderRadius,
        padding: spec.padding,
        fontFamily: spec.fontFamily,
        boxShadow: spec.boxShadow !== "none" ? spec.boxShadow : undefined,
      }}
    >
      {isStat ? (
        <>
          <PretextText
            slot={slot({
              id: "metric-label",
              text: "Metric label",
              fontFamily: family,
              fontSize: spec.fontSize,
              fontWeight: "400",
              lineHeight: "1.4",
              color: spec.color,
              maxWidth: innerWidth,
            })}
            maxWidth={innerWidth}
            style={{ opacity: 0.9 }}
          />
          <div style={{ marginTop: 8 }}>
            <PretextText slot={metricSlot} maxWidth={innerWidth} />
          </div>
        </>
      ) : (
        <>
          <PretextText slot={titleSlot} maxWidth={innerWidth} />
          {component.role ? (
            <div style={{ marginTop: 8 }}>
              <PretextText slot={roleSlot} maxWidth={innerWidth} style={{ opacity: 0.8 }} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function NavFrame({ spec, maxWidth }: { spec: ComponentSpec; maxWidth: number }) {
  const family = textFamily(spec);
  const link = (id: string, text: string, weight = "400") =>
    slot({
      id,
      text,
      fontFamily: family,
      fontSize: spec.fontSize,
      fontWeight: weight,
      lineHeight: "1",
      color: spec.color,
    });

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        width: "100%",
        maxWidth: Math.min(maxWidth, 520),
        backgroundColor: spec.backgroundColor,
        borderRadius: spec.borderRadius,
        padding: spec.padding,
        fontFamily: spec.fontFamily,
        fontSize: spec.fontSize,
        color: spec.color,
        border:
          spec.borderWidth !== "0"
            ? `${spec.borderWidth} solid ${spec.borderColor}`
            : "none",
        overflow: "hidden",
        boxShadow:
          spec.boxShadow !== "none" ? spec.boxShadow : "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <PretextText slot={link("logo", "Logo", "600")} maxWidth={80} />
      <PretextText slot={link("link-a", "Link")} maxWidth={60} style={{ opacity: 0.85 }} />
      <PretextText slot={link("link-b", "Link")} maxWidth={60} style={{ opacity: 0.85 }} />
      <ButtonFrame
        spec={{ ...spec, label: "CTA", fontSize: "13px" }}
        maxWidth={100}
      />
    </nav>
  );
}

export function TagFrame({ spec, maxWidth }: { spec: ComponentSpec; maxWidth: number }) {
  const family = textFamily(spec);
  const label = slot({
    id: "tag",
    text: spec.label,
    fontFamily: family,
    fontSize: spec.fontSize,
    fontWeight: spec.fontWeight,
    lineHeight: "1",
    color: spec.color,
  });

  return (
    <span
      style={{
        display: "inline-block",
        backgroundColor: spec.backgroundColor,
        color: spec.color,
        borderRadius: spec.borderRadius,
        padding: spec.padding,
        fontFamily: spec.fontFamily,
      }}
    >
      <PretextText slot={label} maxWidth={maxWidth} />
    </span>
  );
}

export function TabFrame({ spec, maxWidth }: { spec: ComponentSpec; maxWidth: number }) {
  const family = textFamily(spec);
  const tab = (id: string, text: string, active: boolean) => (
    <PretextText
      key={id}
      slot={slot({
        id,
        text,
        fontFamily: family,
        fontSize: spec.fontSize,
        fontWeight: active ? "600" : "400",
        lineHeight: "1",
        color: spec.color,
      })}
      maxWidth={120}
      style={{
        opacity: active ? 1 : 0.55,
        borderBottom: active ? `2px solid var(--wiki-accent, ${spec.borderColor})` : undefined,
        paddingBottom: 6,
      }}
    />
  );

  return (
    <div className="flex gap-6" style={{ fontFamily: spec.fontFamily, color: spec.color }}>
      {tab("active", "Active", true)}
      {tab("inactive-a", "Inactive", false)}
      {tab("inactive-b", "Inactive", false)}
    </div>
  );
}

export function HeroFrame({ spec, maxWidth }: { spec: ComponentSpec; maxWidth: number }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: Math.min(maxWidth, 420),
        height: 180,
        borderRadius: spec.borderRadius,
        background: "var(--wiki-accent, #fc5000)",
        opacity: 0.92,
      }}
    />
  );
}

export function StripFrame({ spec, maxWidth }: { spec: ComponentSpec; maxWidth: number }) {
  const family = textFamily(spec);
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        maxWidth: Math.min(maxWidth, 480),
        backgroundColor: spec.backgroundColor,
        borderRadius: spec.borderRadius,
        border:
          spec.borderWidth !== "0"
            ? `${spec.borderWidth} solid ${spec.borderColor}`
            : `1px solid ${spec.borderColor}`,
        overflow: "hidden",
      }}
    >
      {["A", "B", "C", "D"].map((letter, i) => (
        <div
          key={letter}
          style={{
            flex: 1,
            padding: "20px 16px",
            textAlign: "center",
            fontFamily: spec.fontFamily,
            color: spec.color,
            borderRight: i < 3 ? `1px solid ${spec.borderColor}` : undefined,
            opacity: 0.7,
          }}
        >
          <PretextText
            slot={slot({
              id: `strip-${letter}`,
              text: letter,
              fontFamily: family,
              fontSize: spec.fontSize,
              fontWeight: "500",
              lineHeight: "1",
              color: spec.color,
            })}
            maxWidth={48}
          />
        </div>
      ))}
    </div>
  );
}

export function GenericFrame({
  spec,
  component,
  maxWidth,
}: {
  spec: ComponentSpec;
  component: ComponentDoc;
  maxWidth: number;
}) {
  const family = textFamily(spec);
  const innerWidth = Math.min(maxWidth, 400) - 32;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: Math.min(maxWidth, 400),
        backgroundColor: spec.backgroundColor,
        color: spec.color,
        border:
          spec.borderWidth !== "0"
            ? `${spec.borderWidth} solid ${spec.borderColor}`
            : "none",
        borderRadius: spec.borderRadius,
        padding: spec.padding,
        fontFamily: spec.fontFamily,
        boxShadow: spec.boxShadow !== "none" ? spec.boxShadow : undefined,
      }}
    >
      <PretextText
        slot={slot({
          id: "title",
          text: component.title,
          fontFamily: family,
          fontSize: spec.fontSize,
          fontWeight: spec.fontWeight,
          lineHeight: "1.3",
          color: spec.color,
          maxWidth: innerWidth,
        })}
        maxWidth={innerWidth}
      />
      {component.role ? (
        <div style={{ marginTop: 8 }}>
          <PretextText
            slot={slot({
              id: "role",
              text: component.role.slice(0, 160),
              fontFamily: family,
              fontSize: "14px",
              fontWeight: "400",
              lineHeight: "1.45",
              color: spec.color,
              maxWidth: innerWidth,
            })}
            maxWidth={innerWidth}
            style={{ opacity: 0.8 }}
          />
        </div>
      ) : null}
    </div>
  );
}
