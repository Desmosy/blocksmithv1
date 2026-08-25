"use client";

import type { ReactNode } from "react";
import type {
  ColorToken,
  ComponentDoc,
  DesignSystem,
  SurfaceRow,
  TypeScaleRow,
  TypographyFamily,
} from "@/lib/blocks/types";
import {
  buildPreviewContextFromSystem,
  parseComponentPreviewSpec,
} from "@/ai-lab/04-component-previews";
import type { DemoCta } from "@/ai-lab/06-demo-compose";
import { ButtonPreview } from "./ButtonPreview";
import { DemoButton } from "./pages/demo/DemoButton";
import { ColorSwatchCard } from "./visual/ColorSwatchCard";
import { FontSpecimen } from "./visual/FontSpecimen";
import { SurfaceLevelCard } from "./visual/SurfaceLevelCard";
import { TypeScalePreview } from "./visual/TypeScalePreview";
import { canRenderLocalScannedPreview } from "@/lib/scan/local-preview";

function sampleColorToken(system: DesignSystem): ColorToken {
  if (system.colors[0]) return system.colors[0];
  return {
    name: "Wiki accent",
    value: "#1c5d5f",
    cssVar: "--wiki-accent",
    role: "Accent",
    group: "SCANNED",
  };
}

function sampleSurfaces(system: DesignSystem): SurfaceRow[] {
  if (system.surfaces.length > 0) return system.surfaces.slice(0, 3);
  return [
    {
      level: "0",
      name: "Base",
      value: "var(--wiki-bg)",
      purpose: "Page background",
    },
    {
      level: "1",
      name: "Elevated",
      value: "var(--wiki-sidebar)",
      purpose: "Cards and panels",
    },
    {
      level: "2",
      name: "Overlay",
      value: "var(--wiki-text)",
      purpose: "Modal / emphasis surface",
    },
  ];
}

function sampleTypography(): TypographyFamily {
  return {
    name: "UI Sans",
    cssVar: "--wiki-font",
    substitute: "Inter, system-ui, sans-serif",
    weights: "400, 500, 600",
    sizes: "14, 16, 20, 24",
    lineHeight: "1.5",
    letterSpacing: "0",
    role: "Body text",
  };
}

function sampleTypeScale(): TypeScaleRow[] {
  return [
    {
      role: "display",
      size: "32px",
      lineHeight: "40px",
      letterSpacing: "-0.02em",
      token: "--text-display",
    },
    {
      role: "heading",
      size: "24px",
      lineHeight: "32px",
      letterSpacing: "-0.01em",
      token: "--text-heading",
    },
    {
      role: "body",
      size: "16px",
      lineHeight: "24px",
      letterSpacing: "0",
      token: "--text-body",
    },
    {
      role: "caption",
      size: "13px",
      lineHeight: "18px",
      letterSpacing: "0.01em",
      token: "--text-caption",
    },
  ];
}

function sampleDemoCta(system: DesignSystem): DemoCta {
  const ctx = buildPreviewContextFromSystem(system);
  const spec = parseComponentPreviewSpec(
    {
      id: "demo-cta",
      title: "Button",
      role: "Primary call to action",
      description: "",
    },
    ctx,
  );
  return { id: "demo-cta", label: "Get started", spec };
}

export function ScannedComponentLivePreview({
  component,
  system,
  docFileName,
}: {
  component: ComponentDoc;
  system: DesignSystem;
  docFileName?: string;
}) {
  if (!canRenderLocalScannedPreview(component)) return null;

  const frame = (children: ReactNode) => (
    <div
      className="design-preview overflow-hidden rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-6"
      style={{ boxShadow: "var(--wiki-card-shadow, none)" }}
    >
      {children}
    </div>
  );

  switch (component.id) {
    case "buttonpreview":
      return frame(
        <div className="apollo-preview">
          <ButtonPreview />
        </div>,
      );

    case "colorswatchcard":
      return frame(
        <div className="grid max-w-md gap-4 sm:grid-cols-2">
          <ColorSwatchCard token={sampleColorToken(system)} selected />
          {system.colors[1] ? (
            <ColorSwatchCard token={system.colors[1]} />
          ) : null}
        </div>,
      );

    case "surfacelevelcard": {
      const surfaces = sampleSurfaces(system);
      return frame(
        <div className="space-y-6">
          {surfaces.map((surface, i) => (
            <SurfaceLevelCard
              key={`${surface.level}-${surface.name}`}
              surface={surface}
              index={i}
              total={surfaces.length}
              docFileName={docFileName}
            />
          ))}
        </div>,
      );
    }

    case "fontspecimen":
      return frame(
        <FontSpecimen font={system.typography[0] ?? sampleTypography()} />,
      );

    case "typescalepreview":
      return frame(
        <TypeScalePreview
          rows={
            system.typeScale.length > 0 ? system.typeScale : sampleTypeScale()
          }
        />,
      );

    case "demobutton": {
      const cta = sampleDemoCta(system);
      return frame(
        <div className="flex flex-wrap items-center gap-4">
          <DemoButton cta={cta} />
          <DemoButton cta={cta} large />
          <DemoButton cta={cta} small />
        </div>,
      );
    }

    default:
      return null;
  }
}
