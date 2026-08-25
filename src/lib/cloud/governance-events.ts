import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { localCloudStoreWritable, saasDbEnabled } from "./saas";
import type {
  GovernanceEvent,
  GovernanceEventStatus,
  NewGovernanceEvent,
} from "@/lib/governance/types";

type EventStore = {
  version: 1;
  events: GovernanceEvent[];
};

const STORE_DIR = join(process.cwd(), "data", "cloud");
const STORE_PATH = join(STORE_DIR, "governance-events.json");

function readFileStore(): EventStore {
  if (!existsSync(STORE_PATH)) return { version: 1, events: [] };
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf-8")) as EventStore;
    if (raw?.version === 1 && Array.isArray(raw.events)) return raw;
  } catch {
    /* corrupt */
  }
  return { version: 1, events: [] };
}

function writeFileStore(store: EventStore): void {
  if (!localCloudStoreWritable()) return;
  mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf-8");
}

function rowToEvent(row: Record<string, unknown>): GovernanceEvent {
  return {
    id: String(row.id),
    ts: String(row.created_at ?? row.ts),
    docRef: String(row.doc_ref),
    componentId: (row.component_id as string | null) ?? undefined,
    componentTitle: (row.component_title as string | null) ?? undefined,
    author: String(row.author),
    source: row.source as GovernanceEvent["source"],
    action: row.action as GovernanceEvent["action"],
    findings: (row.findings as GovernanceEvent["findings"]) ?? [],
    commit: (row.commit_sha as string | null) ?? undefined,
    branch: (row.branch as string | null) ?? undefined,
    overrideReason: (row.override_reason as string | null) ?? undefined,
    status: row.status as GovernanceEventStatus,
  };
}

async function insertDb(event: GovernanceEvent): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("blocksmith_governance_events").insert({
    id: event.id,
    doc_ref: event.docRef,
    component_id: event.componentId ?? null,
    component_title: event.componentTitle ?? null,
    author: event.author,
    source: event.source,
    action: event.action,
    findings: event.findings,
    commit_sha: event.commit ?? null,
    branch: event.branch ?? null,
    override_reason: event.overrideReason ?? null,
    status: event.status,
    created_at: event.ts,
    updated_at: event.ts,
  });
  if (error) throw new Error(`Governance event insert failed: ${error.message}`);
}

async function updateDbStatus(id: string, status: GovernanceEventStatus): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("blocksmith_governance_events")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Governance event update failed: ${error.message}`);
}

async function listDb(
  docRef: string,
  opts?: { status?: GovernanceEventStatus; limit?: number },
): Promise<GovernanceEvent[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("blocksmith_governance_events")
    .select("*")
    .eq("doc_ref", docRef)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw new Error(`Governance event list failed: ${error.message}`);
  return (data ?? []).map((row) => rowToEvent(row as Record<string, unknown>));
}

export async function appendGovernanceEvent(
  input: NewGovernanceEvent,
): Promise<GovernanceEvent> {
  const event: GovernanceEvent = {
    ...input,
    id: randomUUID(),
    ts: new Date().toISOString(),
    status: input.status ?? "open",
  };

  if (saasDbEnabled()) {
    await insertDb(event);
    return event;
  }

  const store = readFileStore();
  store.events.unshift(event);
  store.events = store.events.slice(0, 500);
  writeFileStore(store);
  return event;
}

export async function listGovernanceEvents(
  docRef: string,
  opts?: { status?: GovernanceEventStatus; limit?: number },
): Promise<GovernanceEvent[]> {
  if (saasDbEnabled()) {
    return listDb(docRef, opts);
  }
  let events = readFileStore().events.filter((e) => e.docRef === docRef);
  if (opts?.status) events = events.filter((e) => e.status === opts.status);
  return events.slice(0, opts?.limit ?? 50);
}

export async function updateGovernanceEventStatus(
  id: string,
  status: GovernanceEventStatus,
): Promise<void> {
  if (saasDbEnabled()) {
    await updateDbStatus(id, status);
    return;
  }
  const store = readFileStore();
  const hit = store.events.find((e) => e.id === id);
  if (!hit) throw new Error("Governance event not found");
  hit.status = status;
  writeFileStore(store);
}

export function countOpenViolations(events: GovernanceEvent[]): number {
  return events.filter((e) => e.status === "open").length;
}
