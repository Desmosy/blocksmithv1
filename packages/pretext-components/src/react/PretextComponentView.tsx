"use client";

import type { ComponentDoc, ComponentSpec } from "../types";
import {
  ButtonFrame,
  CardFrame,
  GenericFrame,
  HeroFrame,
  InputFrame,
  NavFrame,
  StripFrame,
  TabFrame,
  TagFrame,
} from "./frames";

function PreviewFrame({
  spec,
  children,
  label,
  compact,
}: {
  spec: ComponentSpec;
  children: React.ReactNode;
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className="pretext-component-frame"
      style={{
        display: "flex",
        minHeight: compact ? 120 : 160,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: "var(--wiki-radius-card, 16px)",
        border: "1px solid var(--wiki-border, #e5e7eb)",
        padding: compact ? 24 : 32,
        backgroundColor: spec.previewBg,
      }}
      aria-label={label}
    >
      {children}
    </div>
  );
}

export function PretextComponentView({
  component,
  spec,
  maxWidth = 360,
}: {
  component: ComponentDoc;
  spec: ComponentSpec;
  maxWidth?: number;
}) {
  const compact =
    spec.kind === "button" || spec.kind === "tag" || spec.kind === "input";

  const body = (() => {
    switch (spec.kind) {
      case "button":
        return <ButtonFrame spec={spec} maxWidth={maxWidth} />;
      case "input":
        return <InputFrame spec={spec} maxWidth={maxWidth} />;
      case "card":
        return <CardFrame spec={spec} component={component} maxWidth={maxWidth} />;
      case "nav":
        return <NavFrame spec={spec} maxWidth={maxWidth} />;
      case "tag":
        return <TagFrame spec={spec} maxWidth={maxWidth} />;
      case "tab":
        return <TabFrame spec={spec} maxWidth={maxWidth} />;
      case "hero":
        return <HeroFrame spec={spec} maxWidth={maxWidth} />;
      case "strip":
        return <StripFrame spec={spec} maxWidth={maxWidth} />;
      default:
        return <GenericFrame spec={spec} component={component} maxWidth={maxWidth} />;
    }
  })();

  return (
    <PreviewFrame spec={spec} label={component.title} compact={compact}>
      {body}
    </PreviewFrame>
  );
}
