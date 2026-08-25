"use client";

import "@blocksmith/acme-ui-kit/tokens.css";
import { Surface, Text, Button, colors } from "@blocksmith/acme-ui-kit";
import Link from "next/link";

export function PulseDemo() {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "clamp(16px, 4vw, 48px)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <Surface level={0} style={{ maxWidth: 640 }}>
        <Text variant="heading">@blocksmith/acme-ui-kit</Text>
        <Text variant="muted" style={{ marginTop: 8 }}>
          Scan markdown → codegen → import. No hand-written CSS for tokens.
        </Text>

        <Surface level={1} style={{ marginTop: 24 }}>
          <Text variant="body" style={{ marginBottom: 12 }}>
            Featured components
          </Text>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
          </div>
        </Surface>

        <Surface level={2} style={{ marginTop: 16 }}>
          <Text variant="body" style={{ marginBottom: 8 }}>
            Token palette ({colors.length} colors)
          </Text>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {colors.map((c) => (
              <div
                key={c.cssVar}
                title={`${c.name} — ${c.cssVar}`}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: `var(${c.cssVar})`,
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              />
            ))}
          </div>
        </Surface>

        <p style={{ marginTop: 24, fontSize: 14 }}>
          <Link href="/wiki?doc=upload%3Ascan-acme-ui-kit.md" style={{ color: "var(--acme-accent)" }}>
            Open source wiki
          </Link>
          {" · "}
          <Link href="/" style={{ color: "var(--acme-text-muted)" }}>
            Home
          </Link>
        </p>
      </Surface>
    </div>
  );
}
