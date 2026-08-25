"use client";

import { useEffect } from "react";
import type { TypographyFamily } from "@/lib/blocks/types";
import type { FontResolutionMap } from "@/lib/fonts/font-resolve";
import { wikiFontsStylesheetHref } from "@/lib/fonts/load-google-fonts";

/** Client fallback — keeps font link in sync when doc changes without full reload. */
export function GoogleFontsLink({
  typography,
  fontResolutions,
}: {
  typography: TypographyFamily[];
  fontResolutions?: FontResolutionMap;
}) {
  let href: string | null = null;
  try {
    href = wikiFontsStylesheetHref(typography, fontResolutions);
  } catch (err) {
    console.error("[GoogleFontsLink] font resolution failed:", err);
  }

  useEffect(() => {
    if (!href) return;

    const id = "blocksmith-wiki-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) {
      link.href = href;
    }
  }, [href]);

  return null;
}
