"use client";

import { useEffect, useMemo, useRef } from "react";
import type { LoadedDesignSystem } from "@/lib/clients/registry";
import {
  applyThemeToDocument,
  buildAllThemeProperties,
  clearThemeFromDocument,
  getColorVarKeys,
} from "@/lib/apollo/apply-theme";

export function useDesignTheme(
  system: LoadedDesignSystem,
  styleApplied: boolean,
  hydrated: boolean,
) {
  const colorVarKeys = useMemo(
    () => getColorVarKeys(system),
    [system],
  );
  const properties = useMemo(
    () =>
      system.mode === "apollo" && system.colors.length > 0
        ? buildAllThemeProperties(system)
        : null,
    [system],
  );
  const prevApplied = useRef(false);

  useEffect(() => {
    if (!hydrated) return;

    if (styleApplied && properties) {
      applyThemeToDocument(properties);
      prevApplied.current = true;
    } else if (prevApplied.current) {
      clearThemeFromDocument(colorVarKeys);
      prevApplied.current = false;
    }

    return () => {
      if (prevApplied.current) {
        clearThemeFromDocument(colorVarKeys);
        prevApplied.current = false;
      }
    };
  }, [styleApplied, properties, hydrated, colorVarKeys]);
}
