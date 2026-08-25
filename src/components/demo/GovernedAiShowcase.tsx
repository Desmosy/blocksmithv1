"use client";

/**
 * Governed AI — the money shot (PROJECT-PIPELINE.md step 4), now LIVE.
 *
 * Same brief, two agents. Click Generate and both run real LLM completions via
 * /api/ai/governed-generate: the ungoverned agent invents brand values; the
 * governed agent is grounded in the tenant's approved tokens + components.
 * Drift is scored by the SAME color-lint engine the CI gate uses — the numbers
 * are real enforcement output, not the model's claim.
 *
 * If no model is configured (or a call fails), it degrades to a safe static
 * sample rendered from the real generated `@blocksmith/acme-ui-kit` — so the
 * demo never looks broken. We never eval/render the LLM's code (XSS-safe).
 */
import { useState, type CSSProperties } from "react";
import { Button, Card, Badge, cssVars } from "@blocksmith/acme-ui-kit";

const DEMO_DOC = "upload:scan-acme-ui-kit.md";
const DEFAULT_PROMPT =
  "Build a checkout summary card: a title, an \"In stock\" status badge, and a primary \"Pay now\" button.";
const MAX_PROMPT = 600;

const APPROVED_VARS = cssVars as Record<string, string>;
const accent = APPROVED_VARS["--acme-accent"] ?? "#e85d4a";

interface Violation {
  hex: string;
  line: number;
  snippet: string;
  nearest?: { name: string; cssVar?: string; hex: string };
}
interface AgentOutput {
  code: string;
  driftCount: number;
  violations: Violation[];
  usesApprovedKit: boolean;
  model: string;
}
interface GenResult {
  systemName: string;
  packageName: string;
  approvedTokenCount: number;
  approvedComponents: string[];
  governed: AgentOutput;
  ungoverned: AgentOutput;
  cached: boolean;
}

type Status = "idle" | "loading" | "done" | "unconfigured" | "error";

const code: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
};
const colHead: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
const cardShell: CSSProperties = {
  borderRadius: 14,
  border: "1px solid var(--wiki-border)",
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const codeBlock: CSSProperties = {
  ...code,
  margin: "10px 0 0",
  maxHeight: 280,
  overflow: "auto",
  background: "#0e1116",
  color: "#e6edf3",
  borderRadius: 10,
  padding: 14,
  lineHeight: 1.5,
  whiteSpace: "pre",
};

// ── Live result columns ─────────────────────────────────────────────────────
function LiveColumn({
  out,
  tone,
  title,
  subtitle,
  packageName,
}: {
  out: AgentOutput;
  tone: "red" | "green";
  title: string;
  subtitle: string;
  packageName: string;
}) {
  const c = tone === "red" ? "#dc2626" : "#16a34a";
  const clean = out.driftCount === 0;
  return (
    <div>
      <p style={{ ...colHead, color: c }}>{title}</p>
      <p style={{ fontSize: 13, color: "var(--wiki-muted)", margin: "4px 0 10px" }}>
        {subtitle}
      </p>
      <pre style={codeBlock}>{out.code || "// (empty response)"}</pre>
      <ul
        style={{
          margin: "12px 0 0",
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontSize: 13,
        }}
      >
        {clean ? (
          <li style={{ color: "#16a34a", fontWeight: 600 }}>
            ✓ 0 drift — every color is an approved token
          </li>
        ) : (
          out.violations.slice(0, 5).map((v, i) => (
            <li key={i} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ color: "#dc2626", fontWeight: 700 }}>✗</span>
              <span>
                <code style={code}>{v.hex}</code> — off-token
                {v.nearest?.cssVar ? (
                  <>
                    {" "}
                    · nearest <code style={code}>{v.nearest.cssVar}</code>
                  </>
                ) : null}
              </span>
            </li>
          ))
        )}
        <li style={{ color: out.usesApprovedKit ? "#16a34a" : "#dc2626" }}>
          {out.usesApprovedKit ? "✓" : "✗"} {out.usesApprovedKit ? "imports" : "does not import"}{" "}
          <code style={code}>{packageName}</code>
        </li>
      </ul>
      <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: c }}>
        {clean
          ? "0 drift · passes validate:ui"
          : `${out.driftCount} drift violation${out.driftCount === 1 ? "" : "s"} · would fail validate:ui in CI`}
      </p>
    </div>
  );
}

// ── Static fallback (safe, rendered from the real generated kit) ─────────────
function StaticSample() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 24,
        alignItems: "start",
      }}
    >
      <div>
        <p style={{ ...colHead, color: "#dc2626" }}>Agent without BlockSmith</p>
        <p style={{ fontSize: 13, color: "var(--wiki-muted)", margin: "4px 0 12px" }}>
          No design system to obey — so it guesses.
        </p>
        <div style={{ ...cardShell, background: "#fff" }}>
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 4,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 17, color: "#111827" }}>Checkout</strong>
              <span style={{ background: "#dcfce7", color: "#15803d", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 600 }}>
                In stock
              </span>
            </div>
            <button style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, padding: "10px 14px", fontWeight: 600 }}>
              Pay now
            </button>
          </div>
        </div>
        <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "#dc2626" }}>
          Off-brand <code style={code}>#2563eb</code>, invented radius, bespoke button
        </p>
      </div>
      <div>
        <p style={{ ...colHead, color: "#16a34a" }}>Agent governed by BlockSmith</p>
        <p style={{ fontSize: 13, color: "var(--wiki-muted)", margin: "4px 0 12px" }}>
          Pinned to the lock · reads the approved kit over MCP.
        </p>
        <div style={{ ...cardShell, ...(APPROVED_VARS as CSSProperties), background: "#fff" }}>
          <Card title="Checkout">
            <div style={{ marginBottom: 14 }}>
              <Badge label="In stock" />
            </div>
            <Button variant="primary">Pay now</Button>
          </Card>
        </div>
        <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "#16a34a" }}>
          Real <code style={code}>@blocksmith/acme-ui-kit</code> · accent{" "}
          <span style={{ color: accent }}>{accent}</span> · 0 drift
        </p>
      </div>
    </div>
  );
}

export function GovernedAiShowcase() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<GenResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function generate() {
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ai/governed-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: DEMO_DOC, prompt }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setStatus("unconfigured");
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "Generation failed.");
      setResult(body as GenResult);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Generation failed.");
      setStatus("error");
    }
  }

  return (
    <section
      style={{
        border: "1px solid var(--wiki-border)",
        borderRadius: 16,
        padding: 24,
        marginBottom: 32,
        background: "var(--wiki-sidebar)",
      }}
    >
      <p
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--wiki-muted)",
        }}
      >
        Same prompt · two live agents
      </p>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: "6px 0 4px", letterSpacing: "-0.01em" }}>
        Stop AI from inventing your design system.
      </h2>
      <p style={{ fontSize: 14, color: "var(--wiki-muted)", margin: "0 0 14px" }}>
        Same brief, two agents — one has your design system, one doesn&apos;t.
        Drift is scored by the same engine your CI uses.
      </p>

      {/* Prompt + run */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea
          value={prompt}
          maxLength={MAX_PROMPT}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          disabled={status === "loading"}
          style={{
            width: "100%",
            resize: "vertical",
            borderRadius: 10,
            border: "1px solid var(--wiki-border)",
            background: "var(--wiki-bg)",
            color: "var(--wiki-text)",
            padding: "10px 12px",
            fontSize: 14,
            fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={generate}
            disabled={status === "loading" || prompt.trim().length === 0}
            style={{
              background: accent,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 18px",
              fontWeight: 700,
              fontSize: 14,
              cursor: status === "loading" ? "wait" : "pointer",
              opacity: status === "loading" ? 0.7 : 1,
            }}
          >
            {status === "loading" ? "Generating with both agents…" : "Generate live"}
          </button>
          <span style={{ fontSize: 12, color: "var(--wiki-muted)" }}>
            {status === "done" && result
              ? `Live · ${result.governed.model}${result.cached ? " · cached" : ""} · ${result.approvedTokenCount} approved tokens`
              : status === "loading"
                ? "Two real LLM completions in parallel…"
                : `${prompt.length}/${MAX_PROMPT}`}
          </span>
        </div>
      </div>

      {/* Body: live results, or the safe static sample */}
      <div style={{ marginTop: 20 }}>
        {status === "done" && result ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
              alignItems: "start",
            }}
          >
            <LiveColumn
              out={result.ungoverned}
              tone="red"
              title="Agent without BlockSmith"
              subtitle="No design system — invents its own brand."
              packageName={result.packageName}
            />
            <LiveColumn
              out={result.governed}
              tone="green"
              title="Agent governed by BlockSmith"
              subtitle={`Grounded in ${result.systemName} · ${result.approvedComponents.length} approved components.`}
              packageName={result.packageName}
            />
          </div>
        ) : (
          <>
            {status === "unconfigured" && (
              <p style={{ fontSize: 13, color: "var(--wiki-muted)", marginBottom: 12 }}>
                Live generation needs a model configured on this server
                (<code style={code}>NVIDIA_API_KEY</code>). Showing a sample —
                the governed card is the real generated kit.
              </p>
            )}
            {status === "error" && (
              <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>
                {errorMsg} — showing a sample instead.
              </p>
            )}
            {status === "idle" && (
              <p style={{ fontSize: 13, color: "var(--wiki-muted)", marginBottom: 12 }}>
                Example below · click <strong>Generate live</strong> to run both
                agents for real.
              </p>
            )}
            <StaticSample />
          </>
        )}
      </div>

      <p
        style={{
          marginTop: 22,
          paddingTop: 16,
          borderTop: "1px solid var(--wiki-border)",
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        Same prompt. One agent invents your brand. The other{" "}
        <span style={{ color: accent }}>obeys</span> it — because the design is
        approved, pinned, and enforced. That&apos;s the BlockSmith handshake.
      </p>
    </section>
  );
}
