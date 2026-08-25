"use client";

import type { LandingModel } from "@/ai-lab/06-demo-compose";
import { DemoButton } from "./DemoButton";

export function LandingView({ model }: { model: LandingModel }) {
  return (
    <>
      <nav
        className="flex items-center justify-between px-8 py-5"
        style={{ borderBottom: "var(--wiki-nav-divider, 1px solid var(--wiki-border))" }}
      >
        <span
          className="text-lg font-bold"
          style={{
            fontFamily: "var(--wiki-display-font)",
            letterSpacing: "var(--wiki-heading-tracking)",
          }}
        >
          {model.brandName}
        </span>
        <div className="hidden items-center gap-7 md:flex">
          {model.navLinks.map((link) => (
            <span key={link} className="text-sm" style={{ color: "var(--wiki-muted)" }}>
              {link}
            </span>
          ))}
        </div>
        <DemoButton cta={model.navCta} small />
      </nav>

      <section className="px-8 py-20 text-center">
        {model.hero.eyebrow ? (
          <p
            className="mb-4 text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--wiki-accent)" }}
          >
            {model.hero.eyebrow}
          </p>
        ) : null}
        <h2
          className="mx-auto max-w-3xl text-5xl font-bold leading-[1.05]"
          style={{
            fontFamily: "var(--wiki-display-font)",
            letterSpacing: "var(--wiki-heading-tracking)",
          }}
        >
          {model.hero.title}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed" style={{ color: "var(--wiki-muted)" }}>
          {model.hero.subtitle}
        </p>
        <div className="mt-9 flex items-center justify-center gap-4">
          <DemoButton cta={model.hero.primary} large />
          <DemoButton cta={model.hero.secondary} large />
        </div>
      </section>

      <section className="px-8 pb-20">
        <h3
          className="mb-10 text-center text-2xl font-semibold"
          style={{ fontFamily: "var(--wiki-display-font)" }}
        >
          {model.features.heading}
        </h3>
        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {model.features.items.map((f) => (
            <div
              key={f.title}
              className="p-6"
              style={{
                backgroundColor: "var(--wiki-sidebar)",
                border: "var(--wiki-card-border, 1px solid var(--wiki-border))",
                borderRadius: "var(--wiki-radius-card)",
                boxShadow: "var(--wiki-card-shadow, none)",
              }}
            >
              <div
                className="mb-4 h-9 w-9 rounded-lg"
                style={{ backgroundColor: "var(--wiki-accent)", opacity: 0.9 }}
              />
              <p className="font-semibold leading-snug">{f.title}</p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--wiki-muted)" }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="px-8 py-16 text-center"
        style={{ backgroundColor: "var(--wiki-accent)", color: "var(--wiki-cta-on-accent)" }}
      >
        <h3 className="text-3xl font-bold" style={{ fontFamily: "var(--wiki-display-font)" }}>
          {model.closing.title}
        </h3>
        <p className="mx-auto mt-3 max-w-md text-sm opacity-90">{model.closing.subtitle}</p>
        {model.closing.action ? (
          <div className="mt-7 flex justify-center">
            <button
              type="button"
              style={{
                backgroundColor: "var(--wiki-cta-on-accent)",
                color: "var(--wiki-accent)",
                border: "none",
                borderRadius: model.closing.action.spec.borderRadius,
                padding: "14px 28px",
                fontSize: "15px",
                fontWeight: 600,
                fontFamily: "var(--wiki-font)",
                cursor: "default",
              }}
            >
              {model.closing.action.label}
            </button>
          </div>
        ) : null}
      </section>

      <footer
        className="px-8 py-8 text-center text-xs"
        style={{ color: "var(--wiki-muted)", borderTop: "1px solid var(--wiki-border)" }}
      >
        {model.footerNote}
      </footer>
    </>
  );
}
