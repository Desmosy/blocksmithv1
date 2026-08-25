/**
 * Next.js instrumentation — runs once on server start.
 *
 * File watching is started from GET /api/sync/events (Node route) so we
 * never pull fs/crypto/chokidar into the instrumentation client bundle.
 */

export async function register() {
  /* watcher: see /api/sync/events */
}
