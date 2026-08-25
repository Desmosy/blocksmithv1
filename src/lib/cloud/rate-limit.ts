/**
 * Distributed rate limiting backed by Upstash Redis (fixed-window counters), so
 * limits hold across serverless instances. Falls back to an in-memory map when
 * Upstash isn't configured (local dev / single instance), and fails OPEN on any
 * Redis error so a backend hiccup never bricks an endpoint.
 */
import { getRedis } from "./redis";

type Result = { ok: true } | { ok: false; retryAfterSec: number };

// ── In-memory fallback ───────────────────────────────────────────────────────
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function checkInMemory(key: string, limit: number, windowMs: number): Result {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { ok: true };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "local";
}

/**
 * Fixed-window counter: INCR the key, set TTL on first hit, deny once the count
 * exceeds the limit within the window. Distributed when Upstash is configured.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<Result> {
  const redis = getRedis();
  if (!redis) return checkInMemory(key, limit, windowMs);

  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `rl:${key}`;
  try {
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSec);
    }
    if (count > limit) {
      let ttl = await redis.ttl(redisKey);
      if (ttl < 0) ttl = windowSec; // key missing TTL — use the full window
      return { ok: false, retryAfterSec: Math.max(1, ttl) };
    }
    return { ok: true };
  } catch (err) {
    // Fail open — never let a Redis outage block legitimate traffic.
    console.warn("[rate-limit] Redis error, allowing request", err);
    return { ok: true };
  }
}

// ── Scan limits ──────────────────────────────────────────────────────────────
function scanWindowMs(): number {
  const windowMin = Number(process.env.BLOCKSMITH_SCAN_RATE_WINDOW_MIN ?? 60);
  return Math.max(60_000, windowMin * 60_000);
}

export function scanRateLimitForRequest(request: Request): Promise<Result> {
  const limit = Number(process.env.BLOCKSMITH_SCAN_RATE_LIMIT ?? 8);
  return checkRateLimit(`scan:github:${clientIp(request)}`, limit, scanWindowMs());
}

export function scanRateLimitForUser(userId: string): Promise<Result> {
  const limit = Number(process.env.BLOCKSMITH_SCAN_RATE_LIMIT_PER_USER ?? 12);
  return checkRateLimit(`scan:github:user:${userId}`, limit, scanWindowMs());
}

export function scanRateLimitForApiKey(keyId: string): Promise<Result> {
  const limit = Number(process.env.BLOCKSMITH_SCAN_RATE_LIMIT_PER_KEY ?? 24);
  return checkRateLimit(`scan:apikey:${keyId}`, limit, scanWindowMs());
}

// ── AI generation limits (tighter — each call is real LLM spend) ─────────────
function aiWindowMs(): number {
  const windowMin = Number(process.env.BLOCKSMITH_AI_RATE_WINDOW_MIN ?? 60);
  return Math.max(60_000, windowMin * 60_000);
}

export function aiGenerateRateLimitForRequest(request: Request): Promise<Result> {
  const limit = Number(process.env.BLOCKSMITH_AI_RATE_LIMIT ?? 10);
  return checkRateLimit(`ai:gen:ip:${clientIp(request)}`, limit, aiWindowMs());
}

export function aiGenerateRateLimitForUser(userId: string): Promise<Result> {
  const limit = Number(process.env.BLOCKSMITH_AI_RATE_LIMIT_PER_USER ?? 40);
  return checkRateLimit(`ai:gen:user:${userId}`, limit, aiWindowMs());
}
