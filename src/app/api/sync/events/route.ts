/**
 * SSE endpoint — pushes sync events to connected wiki clients.
 *
 * GET /api/sync/events → Server-Sent Events stream
 *
 * Clients connect via EventSource. When the file watcher detects
 * a change, the sync bus fires and this endpoint pushes the event
 * to all connected browsers. Heartbeat every 30s keeps the connection alive.
 */

import { syncBus, type SyncEvent } from "@/lib/sync/events";
import { startWatcher } from "@/lib/sync/watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_INTERVAL_MS = 30_000;

export async function GET() {
  startWatcher();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection confirmation
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`,
        ),
      );

      // Listen for sync events
      const onSync = (event: SyncEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // Stream closed — cleanup will happen in cancel
        }
      };

      syncBus.onSync(onSync);

      // Heartbeat to keep connection alive through proxies/browsers
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Store cleanup refs on the controller for cancel()
      (controller as unknown as Record<string, unknown>).__syncCleanup = () => {
        syncBus.offSync(onSync);
        clearInterval(heartbeat);
      };
    },

    cancel(controller) {
      const cleanup = (controller as unknown as Record<string, unknown>)
        ?.__syncCleanup as (() => void) | undefined;
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
