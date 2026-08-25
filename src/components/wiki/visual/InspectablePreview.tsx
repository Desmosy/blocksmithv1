"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { readComputedSnapshot, type ComputedSnapshot } from "@/lib/visual/computed-metrics";
import { ComputedBoxModel } from "./ComputedBoxModel";

export const INSPECT_TARGET_ATTR = "data-inspect-target";

interface InspectablePreviewProps {
  label?: string;
  compact?: boolean;
  showTypography?: boolean;
  className?: string;
  children: ReactElement;
}

export function InspectablePreview({
  label,
  compact = false,
  showTypography = true,
  className = "",
  children,
}: InspectablePreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<ComputedSnapshot | null>(null);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>(`[${INSPECT_TARGET_ATTR}]`);
    if (!target) return;
    setSnapshot(readComputedSnapshot(target));
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    measure();

    const target = root.querySelector<HTMLElement>(`[${INSPECT_TARGET_ATTR}]`);
    if (!target) return;

    const ro = new ResizeObserver(measure);
    ro.observe(target);

    const mo = new MutationObserver(measure);
    mo.observe(target, { attributes: true, attributeFilter: ["class", "style"] });

    if (document.fonts?.ready) {
      document.fonts.ready.then(measure);
    }

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [measure, children]);

  const marked = cloneElement(children, {
    [INSPECT_TARGET_ATTR]: true,
  } as Record<string, boolean>);

  return (
    <div ref={rootRef} className={className}>
      {marked}
      {snapshot ? (
        <ComputedBoxModel
          snapshot={snapshot}
          label={label}
          compact={compact}
          showTypography={showTypography}
        />
      ) : null}
    </div>
  );
}
