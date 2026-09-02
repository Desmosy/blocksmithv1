"use client";

/**
 * SyncStatusPanel — real-time connection status for the Sync page.
 *
 * In production: subscribes to Supabase Realtime Broadcast so events work
 * across serverless instances. Falls back to SSE (/api/sync/events) in local
 * dev when Supabase is not configured.
 */

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { REALTIME_CHANNEL } from "@/lib/sync/events";

interface SyncState {
  connected: boolean;
  lastEvent: { type?: string; docRef?: string; timestamp?: string } | null;
  eventsReceived: number;
}

export function SyncStatusPanel() {
  const [state, setState] = useState<SyncState>({
    connected: false,
    lastEvent: null,
    eventsReceived: 0,
  });

  useEffect(() => {
    const supabase = createBrowserSupabase();

    // ── Production path: Supabase Realtime Broadcast ──────────────────────
    // Wrapped because the WebSocket constructor can throw *synchronously* —
    // Safari raises "The operation is insecure" when a CSP or Lockdown Mode
    // blocks wss — and an unhandled throw here didn't degrade the panel, it
    // took the entire Sync page to the error boundary. Live status is an
    // ornament; it fails quiet and falls back to SSE.
    if (supabase) {
      try {
        const channel = supabase
          .channel(REALTIME_CHANNEL)
          .on(
            "broadcast",
            { event: "blocks.updated" },
            ({ payload }: { payload: Record<string, string | undefined> }) => {
              setState((s) => ({
                connected: true,
                lastEvent: {
                  type: payload.type,
                  docRef: payload.docRef,
                  timestamp: payload.timestamp,
                },
                eventsReceived: s.eventsReceived + 1,
              }));
            },
          )
          .subscribe((status) => {
            setState((s) => ({
              ...s,
              connected: status === "SUBSCRIBED",
            }));
          });

        return () => {
          void supabase.removeChannel(channel);
        };
      } catch (err) {
        console.warn("[sync] realtime unavailable — falling back to SSE", err);
      }
    }

    // ── SSE fallback: local dev, or a browser that blocks WebSockets ──────
    const es = new EventSource("/api/sync/events");

    es.onopen = () => setState((s) => ({ ...s, connected: true }));

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        setState((s) => ({
          connected: true,
          lastEvent: data,
          eventsReceived: s.eventsReceived + 1,
        }));
      } catch {
        // heartbeat or malformed — ignore
      }
    };

    es.onerror = () => setState((s) => ({ ...s, connected: false }));

    return () => es.close();
  }, []);

  return (
    <div className="mt-8 rounded-xl border border-[var(--wiki-border)] p-5">
      <div className="flex items-center gap-3">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: state.connected ? "#22c55e" : "var(--wiki-muted)", opacity: state.connected ? 1 : 0.4 }}
        />
        <div>
          <p className="text-sm font-semibold">
            {state.connected ? "Live sync active" : "Connecting…"}
          </p>
          <p className="text-xs text-[var(--wiki-muted)]">
            {state.connected
              ? "File watcher → SSE → wiki auto-refresh"
              : "Connecting…"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniStat
          label="Connection"
          value={state.connected ? "Connected" : "Disconnected"}
          accent={state.connected}
        />
        <MiniStat
          label="Events received"
          value={String(state.eventsReceived)}
        />
        <MiniStat
          label="Last event"
          value={
            state.lastEvent?.timestamp
              ? new Date(state.lastEvent.timestamp).toLocaleTimeString()
              : "—"
          }
        />
      </div>

      {state.lastEvent?.docRef ? (
        <div
          className="mt-3 rounded-lg px-3 py-2 text-xs font-mono"
          style={{ backgroundColor: "var(--wiki-active)" }}
        >
          Last update: <strong>{state.lastEvent.docRef}</strong> at{" "}
          {state.lastEvent.timestamp
            ? new Date(state.lastEvent.timestamp).toLocaleString()
            : "—"}
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-lg border border-[var(--wiki-border)] px-3 py-2"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--wiki-muted)]">
        {label}
      </p>
      <p
        className="mt-0.5 text-sm font-semibold"
        style={accent ? { color: "#22c55e" } : undefined}
      >
        {value}
      </p>
    </div>
  );
}
