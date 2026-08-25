import * as Sentry from "@sentry/nextjs";

/** Surface risky production misconfiguration loudly at startup. */
function warnOnRiskyProdConfig() {
  if (process.env.NODE_ENV !== "production") return;
  const supabase =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const strict = process.env.BLOCKSMITH_SAAS_STRICT === "1";

  if (!supabase) {
    console.warn(
      "[config] PRODUCTION without Supabase — data persists to an ephemeral filesystem and will be lost.",
    );
  }
  if (supabase && !strict) {
    console.warn(
      "[config] PRODUCTION with BLOCKSMITH_SAAS_STRICT off — tenant isolation is NOT enforced. Set BLOCKSMITH_SAAS_STRICT=1.",
    );
  }
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    console.warn(
      "[config] No Upstash Redis — rate limits are per-instance only (not distributed).",
    );
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    warnOnRiskyProdConfig();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// App Router server error capture (route handlers, RSC, etc.).
export const onRequestError = Sentry.captureRequestError;
