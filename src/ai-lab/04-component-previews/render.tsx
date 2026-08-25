"use client";

import type { ReactElement } from "react";
import type { ComponentDoc } from "@/lib/blocks/types";
import { InspectablePreview } from "@/components/wiki/visual/InspectablePreview";
import type { ComponentPreviewSpec } from "./parse-spec";
import { specInlineStyle } from "./states";

function previewFrame(
  spec: ComponentPreviewSpec,
  children: ReactElement,
  label: string,
  compact?: boolean,
) {
  return (
    <div
      className="design-preview flex min-h-[160px] items-center justify-center rounded-[var(--wiki-radius-card,16px)] border border-[var(--wiki-border)] p-8"
      style={{ backgroundColor: spec.previewBg }}
    >
      <InspectablePreview label={label} compact={compact}>
        {children}
      </InspectablePreview>
    </div>
  );
}

function buttonStyle(spec: ComponentPreviewSpec): React.CSSProperties {
  return { ...specInlineStyle(spec), cursor: "default" };
}

function ButtonPreview({ spec }: { spec: ComponentPreviewSpec }) {
  return (
    <button type="button" style={buttonStyle(spec)}>
      {spec.label}
    </button>
  );
}

function InputPreview({ spec }: { spec: ComponentPreviewSpec }) {
  return (
    <input
      type="text"
      placeholder={spec.label}
      readOnly
      style={{
        width: "100%",
        maxWidth: 360,
        backgroundColor: spec.backgroundColor,
        color: spec.color,
        border:
          spec.borderWidth !== "0"
            ? `${spec.borderWidth} solid ${spec.borderColor}`
            : `1px solid ${spec.borderColor}`,
        borderRadius: spec.borderRadius,
        padding: spec.padding,
        fontSize: spec.fontSize,
        fontFamily: spec.fontFamily,
        outline: "none",
      }}
    />
  );
}

function CardPreview({ spec, component }: { spec: ComponentPreviewSpec; component: ComponentDoc }) {
  const isStat = /stat|metric|counter/i.test(component.title + component.role);
  const isBlog = /blog|editorial|article/i.test(component.title + component.role);

  if (isBlog) {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: 320,
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
        <div
          className="h-28 w-full"
          style={{
            background: `linear-gradient(135deg, var(--wiki-accent, #888) 0%, #524ae9 100%)`,
            opacity: 0.85,
          }}
        />
        <div style={{ padding: spec.padding }}>
          <span
            style={{
              display: "inline-block",
              backgroundColor: "var(--wiki-accent, #f5f528)",
              color: spec.color,
              fontSize: "12px",
              fontWeight: 500,
              padding: "3px 8px",
              borderRadius: "20px",
              marginBottom: 8,
            }}
          >
            Category
          </span>
          <p style={{ fontSize: spec.fontSize, fontWeight: 600, lineHeight: 1.1 }}>
            {spec.label}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 280,
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
          <p style={{ fontSize: spec.fontSize, opacity: 0.9 }}>Metric label</p>
          <p
            style={{
              marginTop: 8,
              fontSize: spec.displaySize ?? "40px",
              fontWeight: 700,
              lineHeight: 1,
              fontFamily: "var(--wiki-display-font, var(--wiki-font))",
            }}
          >
            97%
          </p>
        </>
      ) : (
        <>
          <p className="font-semibold leading-snug">{spec.label}</p>
          {component.role ? (
            <p className="mt-2 text-sm opacity-80">{component.role}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

function NavPreview({ spec }: { spec: ComponentPreviewSpec }) {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        width: "100%",
        maxWidth: 520,
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
      }}
    >
      <span style={{ fontWeight: 600 }}>Logo</span>
      <span style={{ opacity: 0.85 }}>Link</span>
      <span style={{ opacity: 0.85 }}>Link</span>
      <button type="button" style={{ ...buttonStyle(spec), fontSize: "13px" }}>
        CTA
      </button>
    </nav>
  );
}

function TagPreview({ spec }: { spec: ComponentPreviewSpec }) {
  return (
    <span
      style={{
        display: "inline-block",
        backgroundColor: spec.backgroundColor,
        color: spec.color,
        borderRadius: spec.borderRadius,
        padding: spec.padding,
        fontSize: spec.fontSize,
        fontWeight: spec.fontWeight,
        fontFamily: spec.fontFamily,
      }}
    >
      {spec.label}
    </span>
  );
}

function TabPreview({ spec }: { spec: ComponentPreviewSpec }) {
  return (
    <div
      className="flex gap-6"
      style={{
        fontFamily: spec.fontFamily,
        fontSize: spec.fontSize,
        color: spec.color,
      }}
    >
      <span
        style={{
          borderBottom: `2px solid var(--wiki-accent, ${spec.borderColor})`,
          paddingBottom: 6,
          fontWeight: 600,
        }}
      >
        Active
      </span>
      <span style={{ opacity: 0.55, paddingBottom: 6 }}>Inactive</span>
      <span style={{ opacity: 0.55, paddingBottom: 6 }}>Inactive</span>
    </div>
  );
}

function HeroPreview({ spec }: { spec: ComponentPreviewSpec }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        height: 180,
        borderRadius: spec.borderRadius,
        background: `linear-gradient(135deg, var(--wiki-accent, #fc5000) 0%, #524ae9 100%)`,
        opacity: 0.92,
      }}
    />
  );
}

function StripPreview({ spec }: { spec: ComponentPreviewSpec }) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        maxWidth: 480,
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
            fontSize: spec.fontSize,
            color: spec.color,
            borderRight: i < 3 ? `1px solid ${spec.borderColor}` : undefined,
            opacity: 0.7,
          }}
        >
          {letter}
        </div>
      ))}
    </div>
  );
}

function GenericPreview({ spec, component }: { spec: ComponentPreviewSpec; component: ComponentDoc }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 400,
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
      }}
    >
      <p className="font-semibold leading-snug">{component.title}</p>
      {component.role ? <p className="mt-2 text-sm opacity-80">{component.role}</p> : null}
    </div>
  );
}

export function ComponentPreviewView({
  component,
  spec,
}: {
  component: ComponentDoc;
  spec: ComponentPreviewSpec;
}) {
  const compact = spec.kind === "button" || spec.kind === "tag" || spec.kind === "input";

  const body = (() => {
    switch (spec.kind) {
      case "button":
        return <ButtonPreview spec={spec} />;
      case "input":
        return <InputPreview spec={spec} />;
      case "card":
        return <CardPreview spec={spec} component={component} />;
      case "nav":
        return <NavPreview spec={spec} />;
      case "tag":
        return <TagPreview spec={spec} />;
      case "tab":
        return <TabPreview spec={spec} />;
      case "hero":
        return <HeroPreview spec={spec} />;
      case "strip":
        return <StripPreview spec={spec} />;
      default:
        return <GenericPreview spec={spec} component={component} />;
    }
  })();

  return previewFrame(spec, body, component.title, compact);
}
