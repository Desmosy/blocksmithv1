"use client";

/**
 * useSyncEvents — connects to the SSE endpoint and triggers
 * a soft refresh when the current doc changes on disk.
 *
 * Returns sync status for the UI (connected, last update time).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SyncStatus {
  /** SSE connection state */
  connected: boolean;
  /** Last time this doc was updated from disk */
  lastUpdate: string | null;
  /** Brief message for the UI */
  message: string | null;
}

const MAX_RECONNECT_DELAY_MS = 16_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

/**
 * Auto-dismiss duration for the "updated" toast message.
 */
const TOAST_DURATION_MS = 4_000;

export function useSyncEvents(currentDocRef: string): SyncStatus {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const reconnectDelay = useRef(INITIAL_RECONNECT_DELAY_MS);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const clearMessage = useCallback(() => {
    if (messageTimer.current) {
      clearTimeout(messageTimer.current);
      messageTimer.current = null;
    }
  }, []);

  const showMessage = useCallback(
    (msg: string) => {
      clearMessage();
      setMessage(msg);
      messageTimer.current = setTimeout(() => {
        setMessage(null);
        messageTimer.current = null;
      }, TOAST_DURATION_MS);
    },
    [clearMessage],
  );

  useEffect(() => {
    // Skip SSE in test/build environments without a window
    if (typeof window === "undefined") return;

    let unmounted = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (unmounted) return;

      const es = new EventSource("/api/sync/events");
      eventSourceRef.current = es;

      es.onopen = () => {
        if (unmounted) return;
        setConnected(true);
        reconnectDelay.current = INITIAL_RECONNECT_DELAY_MS;
      };

      es.onmessage = (event) => {
        if (unmounted) return;

        try {
          const data = JSON.parse(event.data);

          if (data.type === "connected") {
            setConnected(true);
            return;
          }

          if (data.type === "blocks.updated") {
            const eventDocRef = data.docRef as string;

            // Check if this event is for the current doc
            if (
              eventDocRef === currentDocRef ||
              // Handle upload: prefix matching
              eventDocRef.replace(/^upload:/, "") ===
                currentDocRef.replace(/^upload:/, "")
            ) {
              setLastUpdate(data.timestamp);
              showMessage("Updated from disk");

              // Soft refresh — re-runs server components, preserves client state
              router.refresh();
            }
          }
        } catch {
          // Ignore heartbeats and malformed data
        }
      };

      es.onerror = () => {
        if (unmounted) return;
        setConnected(false);
        es.close();
        eventSourceRef.current = null;

        // Reconnect with exponential backoff
        const delay = reconnectDelay.current;
        reconnectDelay.current = Math.min(
          delay * 2,
          MAX_RECONNECT_DELAY_MS,
        );
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      unmounted = true;
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearMessage();
    };
  }, [currentDocRef, router, showMessage, clearMessage]);

  return { connected, lastUpdate, message };
}
