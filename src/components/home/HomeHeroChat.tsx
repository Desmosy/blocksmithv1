"use client";

import { useRef } from "react";
import {
  IconArrowRight,
  IconLink,
  IconLock,
  IconModule,
  IconPaperclip,
  IconUpload,
} from "@/components/icons/streamline";

const TABS = [
  { id: "wiki", label: "Wiki" },
  { id: "scan", label: "Scan" },
  { id: "pipeline", label: "Pipeline" },
  { id: "lock", label: "Lock" },
] as const;

export type HeroTabId = (typeof TABS)[number]["id"];

const TAB_HINTS: Record<Exclude<HeroTabId, "wiki">, string> = {
  scan: "Connect GitHub and scan your design repo — tokens, components, and governance flow into the wiki.",
  pipeline:
    "Review staged blocks, see diffs, and promote what humans approved — like merge to main for design.",
  lock: "Pull blocksmith.lock into your repo after promote so agents and CI read pinned versions only.",
};

const SUBMIT_LABELS: Record<HeroTabId, string> = {
  wiki: "Generate wiki from markdown",
  scan: "Connect your repo",
  pipeline: "Open Pipeline",
  lock: "Open Sync & lock",
};

export function HomeHeroChat({
  tab,
  onTabChange,
  markdown,
  onMarkdownChange,
  onSubmit,
  loading,
  parserMode,
  onAttachClick,
  fileLabel,
}: {
  tab: HeroTabId;
  onTabChange: (tab: HeroTabId) => void;
  markdown: string;
  onMarkdownChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  parserMode: string;
  onAttachClick: () => void;
  fileLabel: string | null;
}) {
  const wikiRef = useRef<HTMLTextAreaElement>(null);
  const isWiki = tab === "wiki";

  const hintIcon =
    tab === "scan" ? (
      <IconLink size={18} />
    ) : tab === "pipeline" ? (
      <IconModule size={18} />
    ) : tab === "lock" ? (
      <IconLock size={18} />
    ) : null;

  return (
    <div className="hero-chat">
      <div className="hero-chat__card">
        <div className="hero-chat__input-row">
          {isWiki ? (
            <>
              <span className="hero-chat__input-icon" aria-hidden>
                <IconUpload size={18} />
              </span>
              <textarea
                ref={wikiRef}
                className="hero-chat__textarea"
                value={markdown}
                onChange={(e) => onMarkdownChange(e.target.value)}
                placeholder="Paste your design system .md — colors, typography, components, agent rules…"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
              />
            </>
          ) : (
            <p className="hero-chat__hint">
              <span className="hero-chat__hint-icon" aria-hidden>
                {hintIcon}
              </span>
              {TAB_HINTS[tab]}
            </p>
          )}
        </div>

        <div className="hero-chat__bar">
          <div className="hero-chat__tabs" role="tablist" aria-label="Action">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`hero-chat__tab${tab === t.id ? " hero-chat__tab--active" : ""}`}
                onClick={() => onTabChange(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="hero-chat__bar-right">
            {isWiki ? (
              <>
                <span className="hero-chat__pill">{parserMode}</span>
                <button
                  type="button"
                  className="hero-chat__attach"
                  onClick={onAttachClick}
                  aria-label="Attach .md file"
                >
                  <IconPaperclip size={18} />
                </button>
                {fileLabel ? (
                  <span className="hero-chat__file">{fileLabel}</span>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              className="hero-chat__submit"
              onClick={onSubmit}
              disabled={loading || (isWiki && !markdown.trim())}
              aria-label={SUBMIT_LABELS[tab]}
            >
              {loading ? (
                <span className="home-studio__send-spinner" />
              ) : (
                <IconArrowRight size={18} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
