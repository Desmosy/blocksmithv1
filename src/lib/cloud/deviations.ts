import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { localCloudStoreWritable, saasDbEnabled } from "./saas";

// ── Types ────────────────────────────────────────────────────────────────────

export type DeviationStatus =
  | "pending"
  | "auto_approved"
  | "approved"
  | "rejected"
  | "resolved";

export type DeviationDiff = {
  field: string;
  wikiValue: string;
  pushedValue: string;
};

export type Deviation = {
  id: string;
  orgId: string;
  docRef: string;
  blockId: string;
  pushedBy: string;
  deviationDiff: DeviationDiff;
  commitRef?: string;
  prUrl?: string;
  reason?: string;
  status: DeviationStatus;
  reviewedBy?: string;
  fixSuggestion?: string;
  createdAt: string;
  expiresAt: string;
  resolvedAt?: string;
  rejectionCount: number;
};

export type NewDeviation = {
  orgId: string;
  docRef: string;
  blockId: string;
  pushedBy: string;
  deviationDiff: DeviationDiff;
  commitRef?: string;
  prUrl?: string;
  reason?: string;
  ttlHours?: number;
};

export type GovernanceSettings = {
  orgId: string;
  ttlHours: number;
  maxOpenPerDev: number;
  rejectionsBeforeBlock: number;
  allowAutoApprove: boolean;
  notifyTeamEmail: boolean;
  notifyTeamWiki: boolean;
  reviewRoles: string[];
  updatedAt: string;
};

export type GovernanceSettingsUpdate = Partial<
  Omit<GovernanceSettings, "orgId" | "updatedAt">
>;

// ── Local file store (dev fallback) ──────────────────────────────────────────

type DeviationStore = {
  version: 1;
  deviations: Deviation[];
  settings: GovernanceSettings[];
};

const STORE_DIR = join(process.cwd(), "data", "cloud");
const STORE_PATH = join(STORE_DIR, "deviations.json");

function readFileStore(): DeviationStore {
  if (!existsSync(STORE_PATH))
    return { version: 1, deviations: [], settings: [] };
  try {
    const raw = JSON.parse(
      readFileSync(STORE_PATH, "utf-8"),
    ) as DeviationStore;
    if (raw?.version === 1 && Array.isArray(raw.deviations)) return raw;
  } catch {
    /* corrupt */
  }
  return { version: 1, deviations: [], settings: [] };
}

function writeFileStore(store: DeviationStore): void {
  if (!localCloudStoreWritable()) return;
  mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf-8");
}

// ── Row mappers ──────────────────────────────────────────────────────────────

function rowToDeviation(row: Record<string, unknown>): Deviation {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    docRef: String(row.doc_ref),
    blockId: String(row.block_id),
    pushedBy: String(row.pushed_by),
    deviationDiff: (row.deviation_diff as DeviationDiff) ?? {
      field: "",
      wikiValue: "",
      pushedValue: "",
    },
    commitRef: (row.commit_ref as string | null) ?? undefined,
    prUrl: (row.pr_url as string | null) ?? undefined,
    reason: (row.reason as string | null) ?? undefined,
    status: row.status as DeviationStatus,
    reviewedBy: (row.reviewed_by as string | null) ?? undefined,
    fixSuggestion: (row.fix_suggestion as string | null) ?? undefined,
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    resolvedAt: (row.resolved_at as string | null) ?? undefined,
    rejectionCount: Number(row.rejection_count ?? 0),
  };
}

function rowToSettings(row: Record<string, unknown>): GovernanceSettings {
  return {
    orgId: String(row.org_id),
    ttlHours: Number(row.ttl_hours ?? 24),
    maxOpenPerDev: Number(row.max_open_per_dev ?? 3),
    rejectionsBeforeBlock: Number(row.rejections_before_block ?? 2),
    allowAutoApprove: row.allow_auto_approve !== false,
    notifyTeamEmail: row.notify_team_email !== false,
    notifyTeamWiki: row.notify_team_wiki !== false,
    reviewRoles: (row.review_roles as string[]) ?? ["admin", "owner"],
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

// ── Default settings ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Omit<GovernanceSettings, "orgId"> = {
  ttlHours: 24,
  maxOpenPerDev: 3,
  rejectionsBeforeBlock: 2,
  allowAutoApprove: true,
  notifyTeamEmail: true,
  notifyTeamWiki: true,
  reviewRoles: ["admin", "owner"],
  updatedAt: new Date().toISOString(),
};

// ── Deviations CRUD ──────────────────────────────────────────────────────────

export async function createDeviation(
  input: NewDeviation,
): Promise<Deviation> {
  const now = new Date();
  const ttl = input.ttlHours ?? 24;
  const expiresAt = new Date(now.getTime() + ttl * 60 * 60 * 1000);

  const deviation: Deviation = {
    id: randomUUID(),
    orgId: input.orgId,
    docRef: input.docRef,
    blockId: input.blockId,
    pushedBy: input.pushedBy,
    deviationDiff: input.deviationDiff,
    commitRef: input.commitRef,
    prUrl: input.prUrl,
    reason: input.reason,
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    rejectionCount: 0,
  };

  if (saasDbEnabled()) {
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("blocksmith_deviations").insert({
      id: deviation.id,
      org_id: deviation.orgId,
      doc_ref: deviation.docRef,
      block_id: deviation.blockId,
      pushed_by: deviation.pushedBy,
      deviation_diff: deviation.deviationDiff,
      commit_ref: deviation.commitRef ?? null,
      pr_url: deviation.prUrl ?? null,
      reason: deviation.reason ?? null,
      status: deviation.status,
      created_at: deviation.createdAt,
      expires_at: deviation.expiresAt,
      rejection_count: 0,
    });
    if (error) throw new Error(`Deviation insert failed: ${error.message}`);
    return deviation;
  }

  const store = readFileStore();
  store.deviations.unshift(deviation);
  store.deviations = store.deviations.slice(0, 500);
  writeFileStore(store);
  return deviation;
}

export async function listDeviations(
  orgId: string,
  opts?: { status?: DeviationStatus; pushedBy?: string; limit?: number },
): Promise<Deviation[]> {
  if (saasDbEnabled()) {
    const sb = getSupabaseAdmin();
    let q = sb
      .from("blocksmith_deviations")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(opts?.limit ?? 50);
    if (opts?.status) q = q.eq("status", opts.status);
    if (opts?.pushedBy) q = q.eq("pushed_by", opts.pushedBy);
    const { data, error } = await q;
    if (error) throw new Error(`Deviation list failed: ${error.message}`);
    return (data ?? []).map((row) =>
      rowToDeviation(row as Record<string, unknown>),
    );
  }

  let deviations = readFileStore().deviations.filter(
    (d) => d.orgId === orgId,
  );
  if (opts?.status) deviations = deviations.filter((d) => d.status === opts.status);
  if (opts?.pushedBy) deviations = deviations.filter((d) => d.pushedBy === opts.pushedBy);
  return deviations.slice(0, opts?.limit ?? 50);
}

/** Count open (pending) deviations for a specific developer in an org. */
export async function countOpenDeviations(
  orgId: string,
  pushedBy: string,
): Promise<number> {
  if (saasDbEnabled()) {
    const sb = getSupabaseAdmin();
    const { count, error } = await sb
      .from("blocksmith_deviations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("pushed_by", pushedBy)
      .eq("status", "pending");
    if (error) throw new Error(`Budget check failed: ${error.message}`);
    return count ?? 0;
  }

  return readFileStore().deviations.filter(
    (d) => d.orgId === orgId && d.pushedBy === pushedBy && d.status === "pending",
  ).length;
}

/** Count how many times a block has been rejected for a developer (unresolved). */
export async function countBlockRejections(
  orgId: string,
  blockId: string,
  pushedBy: string,
): Promise<number> {
  if (saasDbEnabled()) {
    const sb = getSupabaseAdmin();
    const { count, error } = await sb
      .from("blocksmith_deviations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("block_id", blockId)
      .eq("pushed_by", pushedBy)
      .eq("status", "rejected");
    if (error) throw new Error(`Rejection count failed: ${error.message}`);
    return count ?? 0;
  }

  return readFileStore().deviations.filter(
    (d) =>
      d.orgId === orgId &&
      d.blockId === blockId &&
      d.pushedBy === pushedBy &&
      d.status === "rejected",
  ).length;
}

/** Pass (approve) a deviation — lock adopts the new value. */
export async function approveDeviation(
  id: string,
  reviewedBy: string,
): Promise<void> {
  const now = new Date().toISOString();
  if (saasDbEnabled()) {
    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("blocksmith_deviations")
      .update({ status: "approved", reviewed_by: reviewedBy, resolved_at: now })
      .eq("id", id);
    if (error) throw new Error(`Deviation approve failed: ${error.message}`);
    return;
  }

  const store = readFileStore();
  const hit = store.deviations.find((d) => d.id === id);
  if (!hit) throw new Error("Deviation not found");
  hit.status = "approved";
  hit.reviewedBy = reviewedBy;
  hit.resolvedAt = now;
  writeFileStore(store);
}

/** Rollback (reject) a deviation — developer must fix. */
export async function rejectDeviation(
  id: string,
  reviewedBy: string,
  fixSuggestion?: string,
): Promise<void> {
  const now = new Date().toISOString();
  if (saasDbEnabled()) {
    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("blocksmith_deviations")
      .update({
        status: "rejected",
        reviewed_by: reviewedBy,
        fix_suggestion: fixSuggestion ?? null,
        resolved_at: now,
      })
      .eq("id", id);
    if (error) throw new Error(`Deviation reject failed: ${error.message}`);
    return;
  }

  const store = readFileStore();
  const hit = store.deviations.find((d) => d.id === id);
  if (!hit) throw new Error("Deviation not found");
  hit.status = "rejected";
  hit.reviewedBy = reviewedBy;
  hit.fixSuggestion = fixSuggestion;
  hit.resolvedAt = now;
  hit.rejectionCount += 1;
  writeFileStore(store);
}

/** Mark a rejected deviation as resolved (developer fixed it). */
export async function resolveDeviation(id: string): Promise<void> {
  const now = new Date().toISOString();
  if (saasDbEnabled()) {
    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("blocksmith_deviations")
      .update({ status: "resolved", resolved_at: now })
      .eq("id", id);
    if (error) throw new Error(`Deviation resolve failed: ${error.message}`);
    return;
  }

  const store = readFileStore();
  const hit = store.deviations.find((d) => d.id === id);
  if (!hit) throw new Error("Deviation not found");
  hit.status = "resolved";
  hit.resolvedAt = now;
  writeFileStore(store);
}

/** Auto-approve all pending deviations that have expired their TTL. */
export async function autoApproveExpired(): Promise<number> {
  const now = new Date().toISOString();
  if (saasDbEnabled()) {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("blocksmith_deviations")
      .update({ status: "auto_approved", resolved_at: now })
      .eq("status", "pending")
      .lte("expires_at", now)
      .select("id");
    if (error) throw new Error(`Auto-approve failed: ${error.message}`);
    return data?.length ?? 0;
  }

  const store = readFileStore();
  let count = 0;
  for (const d of store.deviations) {
    if (d.status === "pending" && d.expiresAt <= now) {
      d.status = "auto_approved";
      d.resolvedAt = now;
      count++;
    }
  }
  if (count > 0) writeFileStore(store);
  return count;
}

// ── Governance Settings CRUD ─────────────────────────────────────────────────

export async function getGovernanceSettings(
  orgId: string,
): Promise<GovernanceSettings> {
  if (saasDbEnabled()) {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("org_governance_settings")
      .select("*")
      .eq("org_id", orgId)
      .single();
    if (error?.code === "PGRST116" || !data) {
      // No settings row — return defaults without inserting
      return { orgId, ...DEFAULT_SETTINGS };
    }
    if (error) throw new Error(`Settings read failed: ${error.message}`);
    return rowToSettings(data as Record<string, unknown>);
  }

  const store = readFileStore();
  const hit = store.settings.find((s) => s.orgId === orgId);
  return hit ?? { orgId, ...DEFAULT_SETTINGS };
}

export async function updateGovernanceSettings(
  orgId: string,
  updates: GovernanceSettingsUpdate,
): Promise<GovernanceSettings> {
  const now = new Date().toISOString();

  if (saasDbEnabled()) {
    const sb = getSupabaseAdmin();
    const row: Record<string, unknown> = { updated_at: now };
    if (updates.ttlHours !== undefined) row.ttl_hours = updates.ttlHours;
    if (updates.maxOpenPerDev !== undefined) row.max_open_per_dev = updates.maxOpenPerDev;
    if (updates.rejectionsBeforeBlock !== undefined) row.rejections_before_block = updates.rejectionsBeforeBlock;
    if (updates.allowAutoApprove !== undefined) row.allow_auto_approve = updates.allowAutoApprove;
    if (updates.notifyTeamEmail !== undefined) row.notify_team_email = updates.notifyTeamEmail;
    if (updates.notifyTeamWiki !== undefined) row.notify_team_wiki = updates.notifyTeamWiki;
    if (updates.reviewRoles !== undefined) row.review_roles = updates.reviewRoles;

    // Upsert: insert defaults if no row exists, otherwise update
    const { data, error } = await sb
      .from("org_governance_settings")
      .upsert(
        {
          org_id: orgId,
          ttl_hours: updates.ttlHours ?? DEFAULT_SETTINGS.ttlHours,
          max_open_per_dev: updates.maxOpenPerDev ?? DEFAULT_SETTINGS.maxOpenPerDev,
          rejections_before_block: updates.rejectionsBeforeBlock ?? DEFAULT_SETTINGS.rejectionsBeforeBlock,
          allow_auto_approve: updates.allowAutoApprove ?? DEFAULT_SETTINGS.allowAutoApprove,
          notify_team_email: updates.notifyTeamEmail ?? DEFAULT_SETTINGS.notifyTeamEmail,
          notify_team_wiki: updates.notifyTeamWiki ?? DEFAULT_SETTINGS.notifyTeamWiki,
          review_roles: updates.reviewRoles ?? DEFAULT_SETTINGS.reviewRoles,
          updated_at: now,
        },
        { onConflict: "org_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(`Settings update failed: ${error.message}`);
    return rowToSettings(data as Record<string, unknown>);
  }

  const store = readFileStore();
  let hit = store.settings.find((s) => s.orgId === orgId);
  if (!hit) {
    hit = { orgId, ...DEFAULT_SETTINGS };
    store.settings.push(hit);
  }
  Object.assign(hit, updates, { updatedAt: now });
  writeFileStore(store);
  return hit;
}
