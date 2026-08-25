import "server-only";
import { getRedis } from "@/lib/cloud/redis";
import type { ProjectKind } from "./projects";

/**
 * Project-metadata cache (Upstash Redis). In hosted mode the dashboard can't
 * parse every doc's markdown on each load (N storage downloads), so creation
 * paths denormalize name/kind/counts here and the dashboard reads them in one
 * MGET. No-op (graceful) when Redis isn't configured.
 */
export type ProjectMeta = {
  name: string;
  kind: ProjectKind;
  tokens: number;
  components: number;
  updatedAt: string;
};

const key = (fileName: string) => `pmeta:${fileName}`;

export async function cacheProjectMeta(
  fileName: string,
  meta: ProjectMeta,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key(fileName), meta); // @upstash/redis serializes objects
  } catch {
    /* cache is best-effort */
  }
}

export async function getCachedMetas(
  fileNames: string[],
): Promise<Map<string, ProjectMeta>> {
  const out = new Map<string, ProjectMeta>();
  const redis = getRedis();
  if (!redis || fileNames.length === 0) return out;
  try {
    const vals = await redis.mget<(ProjectMeta | null)[]>(
      ...fileNames.map(key),
    );
    fileNames.forEach((fn, i) => {
      const v = vals[i];
      if (v) out.set(fn, v);
    });
  } catch {
    /* miss → callers fall back to coarse cards */
  }
  return out;
}

export async function deleteProjectMeta(fileName: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key(fileName));
  } catch {
    /* best-effort */
  }
}
