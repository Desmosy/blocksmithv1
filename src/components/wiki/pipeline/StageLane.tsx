"use client";

/**
 * StageLane — queue column beneath the stage grid (Staging / Production).
 */
import type { ReactNode } from "react";

export function StageLane({
  title,
  subtitle,
  count,
  children,
  empty,
}: {
  title: string;
  subtitle: string;
  count: number;
  children: ReactNode;
  empty: ReactNode;
}) {
  return (
    <section className="pipeline-lane">
      <header className="pipeline-lane__header">
        <div className="pipeline-lane__title-row">
          <h2 className="pipeline-lane__title">{title}</h2>
          <span className="pipeline-lane__count">{count}</span>
        </div>
        <p className="pipeline-lane__subtitle">{subtitle}</p>
      </header>
      <div className="pipeline-lane__body">
        {count === 0 ? (
          <div className="pipeline-lane__empty">{empty}</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
