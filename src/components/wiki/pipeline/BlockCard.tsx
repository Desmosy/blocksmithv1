"use client";

/**
 * BlockCard — one block in a staging or production queue.
 */
import type { ReleaseRow } from "@/lib/ir/releases";
import { IconBlockType } from "@/components/icons";

function tone(row: ReleaseRow): { label: string; modifier: string } {
  if (row.conflict) return { label: "conflict", modifier: "conflict" };
  if (row.stale) return { label: "stale", modifier: "stale" };
  if (row.draftPending || row.official == null)
    return { label: "draft", modifier: "draft" };
  return { label: "live", modifier: "live" };
}

export function BlockCard({
  row,
  lane,
  selected,
  onToggle,
  locked,
  justPromoted,
}: {
  row: ReleaseRow;
  lane: "staging" | "production";
  selected?: boolean;
  onToggle?: () => void;
  locked?: boolean;
  justPromoted?: boolean;
}) {
  const t = tone(row);
  const version =
    lane === "staging" ? row.latest : (row.official ?? row.latest);
  const modifier = justPromoted ? "promoted" : t.modifier;

  return (
    <label
      className={`pipeline-block-card pipeline-block-card--${modifier}`}
    >
      <div className="pipeline-block-card__row">
        {onToggle && (
          <input
            type="checkbox"
            className="pipeline-block-card__check"
            checked={selected ?? false}
            onChange={onToggle}
            aria-label={`Select ${row.id}`}
          />
        )}
        <span className="pipeline-block-card__icon" aria-hidden>
          <IconBlockType type={row.type} size={14} />
        </span>
        <div className="pipeline-block-card__body">
          <p className="pipeline-block-card__title">{row.title}</p>
          <p className="pipeline-block-card__id">{row.id}</p>
          <div className="pipeline-block-card__meta">
            <span className="pipeline-block-card__version">
              v{version}
              {lane === "staging" && row.official != null
                ? ` · prod v${row.official}`
                : ""}
            </span>
            <span className={`pipeline-block-card__status pipeline-block-card__status--${modifier}`}>
              {lane === "staging" ? t.label : justPromoted ? "promoted" : t.label}
            </span>
            {locked && (
              <span className="pipeline-block-card__locked" title="Pinned in blocksmith.lock">
                locked
              </span>
            )}
          </div>
        </div>
      </div>
    </label>
  );
}
