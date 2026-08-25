"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * SyncToast — minimal toast notification for live sync events.
 *
 * Matches the wiki's design language (CSS variables, no third-party lib).
 * Slides in from the bottom-right, auto-dismisses.
 */

interface SyncToastProps {
  message: string | null;
}

export function SyncToast({ message }: SyncToastProps) {
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (message && message !== previous.current) toast.success(message);
    previous.current = message;
  }, [message]);

  return null;
}
