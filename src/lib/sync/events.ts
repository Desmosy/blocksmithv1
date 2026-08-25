/**
 * Sync event bus — decoupled from transport.
 *
 * The watcher emits here; SSE reads from here in local dev.
 * In production, events are also published to Supabase Realtime Broadcast
 * so all serverless instances and browser clients stay in sync.
 */

import { EventEmitter } from "events";
import { createClient } from "@supabase/supabase-js";

export interface BlocksUpdatedEvent {
  type: "blocks.updated";
  docRef: string;
  filePath: string;
  timestamp: string;
}

export type SyncEvent = BlocksUpdatedEvent;

type SyncListener = (payload: SyncEvent) => void;

const SYNC_EVENT = "sync";
export const REALTIME_CHANNEL = "blocksmith:sync";

/**
 * Publish to Supabase Realtime Broadcast.
 * Falls back silently if Supabase is not configured (local dev without it).
 */
async function publishToRealtime(event: SyncEvent): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return;

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await supabase.channel(REALTIME_CHANNEL).send({
      type: "broadcast",
      event: "blocks.updated",
      payload: event,
    });
  } catch (err) {
    // Non-fatal — local SSE still works
    console.warn("[sync] Realtime publish failed:", err);
  }
}

/**
 * Typed wrapper around EventEmitter.
 *
 * Avoids overload-signature conflicts with Node's base class
 * by delegating through simple typed methods.
 */
class SyncBus {
  private readonly ee = new EventEmitter();

  constructor() {
    // Many SSE clients can connect simultaneously in dev
    this.ee.setMaxListeners(50);
  }

  emitSync(payload: SyncEvent): void {
    // In-process emit (local dev SSE)
    this.ee.emit(SYNC_EVENT, payload);
    // Cross-instance broadcast (production serverless)
    void publishToRealtime(payload);
  }

  onSync(listener: SyncListener): void {
    this.ee.on(SYNC_EVENT, listener);
  }

  offSync(listener: SyncListener): void {
    this.ee.off(SYNC_EVENT, listener);
  }
}

/**
 * Singleton sync bus — survives hot reloads via globalThis.
 * Same pattern Next.js uses for Prisma in dev.
 */
const globalForSync = globalThis as unknown as { __syncBus?: SyncBus };

export const syncBus: SyncBus =
  globalForSync.__syncBus ?? (globalForSync.__syncBus = new SyncBus());
