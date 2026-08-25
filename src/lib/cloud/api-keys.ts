import { createHash, randomBytes, randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { localCloudStoreWritable, saasDbEnabled } from "./saas";
import type { ApiKeyRecord, ApiKeyStore, AuthenticatedKey } from "./types";

const STORE_DIR = join(process.cwd(), "data", "cloud");
const STORE_PATH = join(STORE_DIR, "api-keys.json");

function emptyStore(): ApiKeyStore {
  return { version: 1, keys: [] };
}

function readStore(): ApiKeyStore {
  if (!existsSync(STORE_PATH)) return emptyStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf-8")) as ApiKeyStore;
    if (raw?.version === 1 && Array.isArray(raw.keys)) return raw;
  } catch {
    /* corrupt */
  }
  return emptyStore();
}

function writeStore(store: ApiKeyStore): void {
  if (!localCloudStoreWritable()) return;
  mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf-8");
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function toAuthenticated(record: ApiKeyRecord): AuthenticatedKey {
  return {
    id: record.id,
    userId: record.userId ?? null,
    prefix: record.prefix,
    label: record.label,
    isAdmin: !record.userId,
  };
}

async function insertDbKey(record: ApiKeyRecord): Promise<void> {
  if (!record.userId) return;
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("blocksmith_api_keys").insert({
    id: record.id,
    user_id: record.userId,
    prefix: record.prefix,
    hash: record.hash,
    label: record.label,
    created_at: record.createdAt,
  });
  if (error) throw new Error(`API key store failed: ${error.message}`);
}

async function findDbKey(hash: string): Promise<ApiKeyRecord | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("blocksmith_api_keys")
    .select("*")
    .eq("hash", hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    userId: data.user_id as string,
    prefix: data.prefix as string,
    hash: data.hash as string,
    label: data.label as string,
    createdAt: data.created_at as string,
    lastUsedAt: (data.last_used_at as string | null) ?? undefined,
  };
}

async function touchDbKey(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb
    .from("blocksmith_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", id);
}

function buildApiKeyRecord(label: string, userId?: string | null): {
  key: string;
  record: ApiKeyRecord;
} {
  const id = randomUUID();
  const body = randomBytes(24).toString("base64url");
  const key = `bs_live_${body}`;
  const prefix = key.slice(0, 16);
  const record: ApiKeyRecord = {
    id,
    userId: userId ?? null,
    prefix,
    hash: hashSecret(key),
    label: label.trim() || "default",
    createdAt: new Date().toISOString(),
  };
  return { key, record };
}

export function createApiKey(
  label: string,
  userId?: string | null,
): { key: string; record: ApiKeyRecord } {
  const { key, record } = buildApiKeyRecord(label, userId);
  const store = readStore();
  store.keys.push(record);
  writeStore(store);

  if (saasDbEnabled() && record.userId) {
    void insertDbKey(record).catch((err) =>
      console.warn("[api-keys] Supabase insert failed", err),
    );
  }

  return { key, record };
}

/** Self-serve keys on hosted BlockSmith — Supabase only (no local file). */
export async function createApiKeyForUser(
  label: string,
  userId: string,
): Promise<{ key: string; record: ApiKeyRecord }> {
  const { key, record } = buildApiKeyRecord(label, userId);

  if (saasDbEnabled()) {
    await insertDbKey(record);
    return { key, record };
  }

  const store = readStore();
  store.keys.push(record);
  writeStore(store);
  return { key, record };
}

export function listApiKeys(userId?: string): Omit<ApiKeyRecord, "hash">[] {
  const keys = readStore().keys.filter((k) => !k.revokedAt);
  const filtered = userId ? keys.filter((k) => k.userId === userId) : keys;
  return filtered.map(({ hash: _h, ...rest }) => rest);
}

export async function listApiKeysForUser(
  userId: string,
): Promise<Omit<ApiKeyRecord, "hash">[]> {
  if (saasDbEnabled()) {
    try {
      const sb = getSupabaseAdmin();
      const { data, error } = await sb
        .from("blocksmith_api_keys")
        .select("id, user_id, prefix, label, created_at, last_used_at, revoked_at")
        .eq("user_id", userId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (!error && data) {
        return data.map((row) => ({
          id: row.id as string,
          userId: row.user_id as string,
          prefix: row.prefix as string,
          label: row.label as string,
          createdAt: row.created_at as string,
          lastUsedAt: (row.last_used_at as string | null) ?? undefined,
        }));
      }
    } catch {
      /* fall through */
    }
  }
  return listApiKeys(userId);
}

export async function revokeApiKey(
  keyId: string,
  userId: string,
): Promise<boolean> {
  const revokedAt = new Date().toISOString();

  if (saasDbEnabled()) {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("blocksmith_api_keys")
      .update({ revoked_at: revokedAt })
      .eq("id", keyId)
      .eq("user_id", userId)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return true;
  }

  const store = readStore();
  const hit = store.keys.find((k) => k.id === keyId && k.userId === userId);
  if (!hit) return false;
  hit.revokedAt = revokedAt;
  writeStore(store);
  return true;
}

export async function authenticateApiKey(
  bearer: string | null | undefined,
): Promise<AuthenticatedKey | null> {
  const raw = bearer?.trim();
  if (!raw?.startsWith("bs_live_")) return null;
  const hash = hashSecret(raw);

  if (saasDbEnabled()) {
    try {
      const dbHit = await findDbKey(hash);
      if (dbHit) {
        void touchDbKey(dbHit.id).catch(() => {});
        return toAuthenticated(dbHit);
      }
    } catch {
      /* fall through */
    }
  }

  const store = readStore();
  const hit = store.keys.find((k) => k.hash === hash && !k.revokedAt);
  if (!hit) return null;
  hit.lastUsedAt = new Date().toISOString();
  writeStore(store);
  return toAuthenticated(hit);
}

export function adminSecretOk(header: string | null): boolean {
  const expected = process.env.BLOCKSMITH_ADMIN_SECRET?.trim();
  if (!expected) return false;
  return header?.trim() === expected;
}
