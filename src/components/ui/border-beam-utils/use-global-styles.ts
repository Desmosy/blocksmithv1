"use client";

import { useEffect } from "react";

export function useGlobalStyles(styles: string, id: string) {
  useEffect(() => {
    if (typeof document !== "undefined" && !document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.innerHTML = styles;
      document.head.appendChild(style);
    }
  }, [styles, id]);
}
