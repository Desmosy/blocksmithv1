"use client";

/**
 * ComponentPlaygroundPage — the interactive workbench for a design system.
 *
 * Pick any component, then live-edit it: colors snap to your token palette,
 * sizing/spacing/typography are sliders, interaction states (hover/focus/
 * disabled) render on-palette, and the CSS + HTML export updates as you go.
 * Everything is rendered from the parsed system spec — nothing hand-styled.
 */
import { useMemo, useState } from "react";
import type { ComponentDoc, DesignSystem } from "@/lib/blocks/types";
import {
  buildPreviewContextFromIR,
  buildPreviewContextFromSystem,
  classifyComponentKind,
  componentSpecToCss,
  deriveComponentStates,
  parseComponentPreviewSpec,
  ComponentPreviewView,
  type ComponentPreviewContext,
  type ComponentPreviewKind,
  type ComponentPreviewSpec,
  type ComponentVariant,
} from "@/ai-lab/04-component-previews";
import { useDesignIROptional } from "@/lib/design-ir/context";
import { CopyButton } from "../visual/CopyButton";

const KIND_ORDER: ComponentPreviewKind[] = [
  "button",
  "input",
  "nav",
  "tab",
  "card",
  "tag",
  "hero",
  "strip",
  "generic",
];

const KIND_LABEL: Record<ComponentPreviewKind, string> = {
  button: "Buttons & Actions",
  input: "Inputs & Fields",
  nav: "Navigation",
  tab: "Tabs",
  card: "Cards & Containers",
  tag: "Tags & Badges",
  hero: "Heroes & Banners",
  strip: "Strips & Bars",
  generic: "Other",
};

const SHADOW_PRESETS: Record<string, string> = {
  none: "none",
  sm: "0 1px 2px rgba(0,0,0,0.08)",
  md: "0 4px 12px rgba(0,0,0,0.12)",
  lg: "0 12px 32px rgba(0,0,0,0.18)",
};

const num = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const px = (n: number): string => `${Math.round(n)}px`;

/** Split a padding shorthand into vertical / horizontal slider values. */
function splitPadding(value: string): { v: number; h: number } {
  const parts = value.trim().split(/\s+/).map(num);
  if (parts.length === 1) return { v: parts[0], h: parts[0] };
  return { v: parts[0] ?? 12, h: parts[1] ?? parts[0] ?? 16 };
}

function htmlSnippet(spec: ComponentPreviewSpec, cls: string): string {
  switch (spec.kind) {
    case "input":
      return `<input class="${cls}" type="text" placeholder="${spec.label}" />`;
    case "tag":
      return `<span class="${cls}">${spec.label}</span>`;
    case "nav":
      return `<nav class="${cls}">…</nav>`;
    case "card":
    case "hero":
    case "strip":
    case "generic":
      return `<div class="${cls}">${spec.label}</div>`;
    default:
      return `<button class="${cls}" type="button">${spec.label}</button>`;
  }
}

export function ComponentPlaygroundPage({
  system,
}: {
  system: DesignSystem;
  docFileName?: string;
}) {
  const ir = useDesignIROptional();
  const ctx = useMemo(
    () =>
      ir ? buildPreviewContextFromIR(ir) : buildPreviewContextFromSystem(system),
    [ir, system],
  );

  const grouped = useMemo(() => {
    const map = new Map<ComponentPreviewKind, ComponentDoc[]>();
    for (const component of system.components) {
      const kind = classifyComponentKind(component);
      const list = map.get(kind) ?? [];
      list.push(component);
      map.set(kind, list);
    }
    return KIND_ORDER.filter((k) => map.has(k)).map((kind) => ({
      kind,
      components: map.get(kind)!,
    }));
  }, [system.components]);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(
    system.components[0]?.id ?? "",
  );

  const selected =
    system.components.find((c) => c.id === selectedId) ??
    system.components[0] ??
    null;

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return grouped;
    return grouped
      .map((g) => ({
        ...g,
        components: g.components.filter((c) =>
          c.title.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.components.length > 0);
  }, [grouped, query]);

  if (!selected) {
    return (
      <article>
        <h1 className="text-3xl font-semibold tracking-tight">
          Component Playground
        </h1>
        <p className="mt-4 text-sm text-[var(--wiki-muted)]">
          This document defines no components yet. Add a{" "}
          <code>## Components</code> section to your design doc to see a live,
          interactive workbench here.
        </p>
      </article>
    );
  }

  return (
    <article>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--wiki-text)]">
          Component Playground
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--wiki-muted)]">
          Pick a component and edit it live. Colors snap to {system.name}&apos;s
          tokens, states render on-palette, and the CSS updates as you go.
        </p>
      </header>

      <div className="mt-8 grid gap-5 xl:grid-cols-[210px_minmax(0,1fr)_300px]">
        {/* Picker */}
        <aside className="rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search components…"
            className="mb-3 w-full rounded-md border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-2.5 py-1.5 text-xs text-[var(--wiki-text)] outline-none"
          />
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {filteredGroups.map(({ kind, components }) => (
              <div key={kind}>
                <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-widest text-[var(--wiki-muted)]">
                  {KIND_LABEL[kind]}
                </p>
                <ul className="space-y-0.5">
                  {components.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className={`w-full truncate rounded-md px-2 py-1.5 text-left text-xs transition ${
                          c.id === selected.id
                            ? "bg-[var(--wiki-active)] font-semibold text-[var(--wiki-text)]"
                            : "text-[var(--wiki-muted)] hover:bg-[var(--wiki-active)] hover:text-[var(--wiki-text)]"
                        }`}
                      >
                        {c.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas + code + controls remount per component for a clean spec */}
        <Playground key={selected.id} component={selected} ctx={ctx} />
      </div>
    </article>
  );
}

function Playground({
  component,
  ctx,
}: {
  component: ComponentDoc;
  ctx: ComponentPreviewContext;
}) {
  const initial = useMemo(
    () => parseComponentPreviewSpec(component, ctx),
    [component, ctx],
  );
  const [spec, setSpec] = useState<ComponentPreviewSpec>(initial);
  const [canvasBg, setCanvasBg] = useState<"page" | "light" | "dark">("page");
  const [activeState, setActiveState] = useState("Default");

  const set = (patch: Partial<ComponentPreviewSpec>) =>
    setSpec((s) => ({ ...s, ...patch }));

  const states = useMemo(() => deriveComponentStates(spec), [spec]);
  const current =
    states.find((s) => s.name === activeState) ?? states[0];

  const bgValue =
    canvasBg === "light"
      ? "#ffffff"
      : canvasBg === "dark"
        ? "#111114"
        : initial.previewBg;

  const renderSpec: ComponentPreviewSpec = {
    ...current.spec,
    previewBg: bgValue,
  };

  const selector = `.${component.id}`;
  const css = useMemo(() => componentSpecToCss(spec, selector), [spec, selector]);
  const html = htmlSnippet(spec, component.id);

  const palette = ctx.colors
    .filter((c) => c.value.startsWith("#"))
    .map((c) => ({ value: c.value.toLowerCase(), name: c.name }));

  const pad = splitPadding(spec.padding);
  const radiusIsPill = spec.borderRadius === "9999px";

  return (
    <>
      {/* Center: canvas + states + code */}
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented
            value={canvasBg}
            options={[
              ["page", "System"],
              ["light", "Light"],
              ["dark", "Dark"],
            ]}
            onChange={(v) => setCanvasBg(v as typeof canvasBg)}
          />
          <button
            type="button"
            onClick={() => {
              setSpec(initial);
              setActiveState("Default");
            }}
            className="rounded-md border border-[var(--wiki-border)] px-2.5 py-1 text-xs font-medium text-[var(--wiki-muted)] hover:bg-[var(--wiki-active)] hover:text-[var(--wiki-text)]"
          >
            Reset
          </button>
        </div>

        <div style={{ opacity: current.opacity ?? 1 }}>
          <ComponentPreviewView component={component} spec={renderSpec} />
        </div>

        {/* Interaction states — click to preview live */}
        {states.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {states.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setActiveState(s.name)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  s.name === current.name
                    ? "border-transparent bg-[var(--wiki-text)] text-[var(--wiki-bg)]"
                    : "border-[var(--wiki-border)] text-[var(--wiki-muted)] hover:bg-[var(--wiki-active)]"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        ) : null}

        {/* Code export */}
        <div className="space-y-3">
          <CodeBlock title="CSS" code={css} />
          <CodeBlock title="HTML" code={html} />
        </div>
      </div>

      {/* Controls */}
      <aside className="space-y-5 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-4">
        <Field label="Content">
          <input
            value={spec.label}
            onChange={(e) => set({ label: e.target.value })}
            className="w-full rounded-md border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-2.5 py-1.5 text-sm text-[var(--wiki-text)] outline-none"
          />
        </Field>

        <Field label="Render as">
          <Segmented
            value={spec.kind}
            wrap
            options={KIND_ORDER.map((k) => [k, k])}
            onChange={(v) => set({ kind: v as ComponentPreviewKind })}
          />
        </Field>

        <Field label="Variant">
          <Segmented
            value={spec.variant}
            options={[
              ["filled", "Filled"],
              ["outline", "Outline"],
              ["ghost", "Ghost"],
            ]}
            onChange={(v) => set({ variant: v as ComponentVariant })}
          />
        </Field>

        <ColorControl
          label="Background"
          value={spec.backgroundColor}
          palette={palette}
          allowTransparent
          onChange={(v) => set({ backgroundColor: v })}
        />
        <ColorControl
          label="Text"
          value={spec.color}
          palette={palette}
          onChange={(v) => set({ color: v })}
        />
        <ColorControl
          label="Border"
          value={spec.borderColor}
          palette={palette}
          onChange={(v) => set({ borderColor: v })}
        />

        <Slider
          label="Border width"
          value={num(spec.borderWidth)}
          min={0}
          max={8}
          onChange={(n) => set({ borderWidth: px(n) })}
        />

        <Field label={`Radius — ${radiusIsPill ? "pill" : px(radiusIsPill ? 0 : num(spec.borderRadius))}`}>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={48}
              value={radiusIsPill ? 48 : num(spec.borderRadius)}
              onChange={(e) => set({ borderRadius: px(num(e.target.value)) })}
              className="flex-1 accent-[var(--wiki-text)]"
              disabled={radiusIsPill}
            />
            <button
              type="button"
              onClick={() =>
                set({ borderRadius: radiusIsPill ? "8px" : "9999px" })
              }
              className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
                radiusIsPill
                  ? "border-transparent bg-[var(--wiki-text)] text-[var(--wiki-bg)]"
                  : "border-[var(--wiki-border)] text-[var(--wiki-muted)]"
              }`}
            >
              Pill
            </button>
          </div>
        </Field>

        <Slider
          label="Padding · vertical"
          value={pad.v}
          min={0}
          max={48}
          onChange={(n) => set({ padding: `${px(n)} ${px(pad.h)}` })}
        />
        <Slider
          label="Padding · horizontal"
          value={pad.h}
          min={0}
          max={64}
          onChange={(n) => set({ padding: `${px(pad.v)} ${px(n)}` })}
        />

        <Slider
          label="Font size"
          value={num(spec.fontSize)}
          min={10}
          max={48}
          onChange={(n) => set({ fontSize: px(n) })}
        />

        <Field label="Font weight">
          <Segmented
            value={spec.fontWeight}
            options={[
              ["300", "300"],
              ["400", "400"],
              ["500", "500"],
              ["600", "600"],
              ["700", "700"],
            ]}
            onChange={(v) => set({ fontWeight: v })}
          />
        </Field>

        <Field label="Shadow">
          <Segmented
            value={
              Object.entries(SHADOW_PRESETS).find(
                ([, v]) => v === spec.boxShadow,
              )?.[0] ?? "none"
            }
            options={[
              ["none", "None"],
              ["sm", "S"],
              ["md", "M"],
              ["lg", "L"],
            ]}
            onChange={(v) => set({ boxShadow: SHADOW_PRESETS[v] ?? "none" })}
          />
        </Field>

        {ctx.typography.length > 0 ? (
          <Field label="Font family">
            <select
              value={spec.fontFamily}
              onChange={(e) => set({ fontFamily: e.target.value })}
              className="w-full rounded-md border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-2 py-1.5 text-xs text-[var(--wiki-text)] outline-none"
            >
              <option value={initial.fontFamily}>System default</option>
              {ctx.typography.map((t) => {
                const key = t.cssVar.startsWith("--")
                  ? t.cssVar
                  : `--font-${t.cssVar}`;
                const stack =
                  ctx.fontStacks[key] ?? `var(${key}, var(--wiki-font))`;
                return (
                  <option key={t.name} value={stack}>
                    {t.name}
                  </option>
                );
              })}
            </select>
          </Field>
        ) : null}
      </aside>
    </>
  );
}

/* ---------- small control primitives ---------- */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
        {label}
      </p>
      {children}
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
  wrap,
}: {
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
  wrap?: boolean;
}) {
  return (
    <div
      className={`flex gap-1 ${wrap ? "flex-wrap" : ""} rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-0.5`}
    >
      {options.map(([val, label]) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium capitalize transition ${
            value === val
              ? "bg-[var(--wiki-text)] text-[var(--wiki-bg)]"
              : "text-[var(--wiki-muted)] hover:text-[var(--wiki-text)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <Field label={`${label} — ${Math.round(value)}px`}>
      <input
        type="range"
        min={min}
        max={max}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(num(e.target.value))}
        className="w-full accent-[var(--wiki-text)]"
      />
    </Field>
  );
}

function ColorControl({
  label,
  value,
  palette,
  onChange,
  allowTransparent,
}: {
  label: string;
  value: string;
  palette: { value: string; name: string }[];
  onChange: (v: string) => void;
  allowTransparent?: boolean;
}) {
  const isTransparent = value === "transparent";
  const colorInput = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";

  return (
    <Field label={label}>
      <div className="flex flex-wrap items-center gap-1.5">
        {allowTransparent ? (
          <button
            type="button"
            title="transparent"
            onClick={() => onChange("transparent")}
            className={`h-6 w-6 rounded-md border ${
              isTransparent
                ? "border-[var(--wiki-text)] ring-1 ring-[var(--wiki-text)]"
                : "border-[var(--wiki-border)]"
            }`}
            style={{
              backgroundImage:
                "linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%)",
              backgroundSize: "8px 8px",
              backgroundPosition: "0 0,4px 4px",
            }}
          />
        ) : null}
        {palette.map((c) => (
          <button
            key={c.value}
            type="button"
            title={`${c.name} ${c.value}`}
            onClick={() => onChange(c.value)}
            className={`h-6 w-6 rounded-md border ${
              value.toLowerCase() === c.value
                ? "border-[var(--wiki-text)] ring-1 ring-[var(--wiki-text)]"
                : "border-[var(--wiki-border)]"
            }`}
            style={{ backgroundColor: c.value }}
          />
        ))}
        <label
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-dashed border-[var(--wiki-border)] text-[10px] text-[var(--wiki-muted)]"
          title="Custom color"
        >
          +
          <input
            type="color"
            value={colorInput}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
        </label>
        <span className="ml-1 font-mono text-[11px] text-[var(--wiki-muted)]">
          {value}
        </span>
      </div>
    </Field>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--wiki-border)]">
      <div className="flex items-center justify-between border-b border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-3 py-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--wiki-muted)]">
          {title}
        </span>
        <CopyButton value={code} label="Copy" />
      </div>
      <pre className="overflow-x-auto bg-[var(--wiki-bg)] p-3 text-xs leading-relaxed text-[var(--wiki-text)]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
