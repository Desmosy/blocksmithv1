"use client";

import { useEffect, useState } from "react";
import { WikiGeneratingOverlay } from "./WikiGeneratingOverlay";

const BUILD_KEY = "blocksmith-wiki-building";

export function markWikiBuilding(docRef: string, systemName: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(
    BUILD_KEY,
    JSON.stringify({ docRef, systemName, at: Date.now() }),
  );
}

export function WikiBuildGate({
  docFileName,
  systemName,
  children,
}: {
  docFileName: string;
  systemName: string;
  children: React.ReactNode;
}) {
  const [building, setBuilding] = useState(false);

  // Drop stale flags from interrupted navigations
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(BUILD_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { at?: number };
      if (!data.at || Date.now() - data.at > 30_000) {
        sessionStorage.removeItem(BUILD_KEY);
      }
    } catch {
      sessionStorage.removeItem(BUILD_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(BUILD_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        docRef: string;
        systemName: string;
        at: number;
      };
      if (data.docRef !== docFileName) return;

      const elapsed = Date.now() - data.at;
      const minMs = 2200;
      const wait = Math.max(0, minMs - elapsed);

      if (wait === 0) {
        sessionStorage.removeItem(BUILD_KEY);
        return;
      }

      setBuilding(true);
      const t = setTimeout(() => {
        setBuilding(false);
        sessionStorage.removeItem(BUILD_KEY);
      }, wait);
      return () => clearTimeout(t);
    } catch {
      sessionStorage.removeItem(BUILD_KEY);
    }
  }, [docFileName]);

  return (
    <div className="relative">
      <WikiGeneratingOverlay open={building} systemName={systemName} />
      {/* Keep content visible under overlay — never opacity-0 (caused blank white screens) */}
      <div className={building ? "pointer-events-none" : undefined}>{children}</div>
    </div>
  );
}
