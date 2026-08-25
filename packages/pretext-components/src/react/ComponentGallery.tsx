"use client";

import type { GalleryComposition } from "../types";
import { PretextComponentView } from "./PretextComponentView";

export function ComponentGallery({
  composition,
  itemMaxWidth = 400,
}: {
  composition: GalleryComposition;
  itemMaxWidth?: number;
}) {
  return (
    <div
      className="pretext-component-gallery"
      style={{
        display: "grid",
        gap: 32,
        maxWidth: composition.maxWidth,
        margin: "0 auto",
      }}
    >
      {composition.items.map(({ component, spec }) => (
        <section key={component.id}>
          <header
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--wiki-text, #1a1a1a)",
              }}
            >
              {component.title}
            </h3>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--wiki-muted, #6b7280)",
              }}
            >
              {spec.kind}
            </span>
          </header>
          <PretextComponentView
            component={component}
            spec={spec}
            maxWidth={itemMaxWidth}
          />
        </section>
      ))}
    </div>
  );
}
