import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Shared Upstash Redis client (REST). Returns null when not configured, so
 * callers degrade gracefully. Used for distributed rate limiting and the
 * dashboard project-metadata cache.
 */
let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}
