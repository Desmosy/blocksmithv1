import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUserRoleForDocument } from "./orgs";
import { canPerform, type DocAction } from "./rbac";
import {
  isPublicContent,
  isPublicDemoDocument,
  localCloudStoreWritable,
  saasDbEnabled,
} from "./saas";

export type DocumentRecord = {
  fileName: string;
  docRef: string;
  ownerUserId: string;
  orgId?: string;
  githubRepo?: string;
  scanMode?: string;
  /** Opt-in public: readable without auth on the org's public site. */
  published?: boolean;
  createdAt: string;
  updatedAt: string;
};

type DocumentStore = {
  version: 1;
  documents: DocumentRecord[];
};

const STORE_DIR = join(process.cwd(), "data", "cloud");
const STORE_PATH = join(STORE_DIR, "documents.json");

function readFileStore(): DocumentStore {
  if (!existsSync(STORE_PATH)) return { version: 1, documents: [] };
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf-8")) as DocumentStore;
    if (raw?.version === 1 && Array.isArray(raw.documents)) return raw;
  } catch {
    /* corrupt */
  }
  return { version: 1, documents: [] };
}

function writeFileStore(store: DocumentStore): void {
  if (!localCloudStoreWritable()) return;
  mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf-8");
}

async function upsertDb(record: DocumentRecord): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("blocksmith_documents").upsert(
    {
      file_name: record.fileName,
      doc_ref: record.docRef,
      owner_user_id: record.ownerUserId,
      org_id: record.orgId ?? null,
      github_repo: record.githubRepo ?? null,
      scan_mode: record.scanMode ?? null,
      published: record.published ?? false,
      updated_at: record.updatedAt,
    },
    { onConflict: "file_name" },
  );
  if (error) throw new Error(`Document registry failed: ${error.message}`);
}

async function readDb(fileName: string): Promise<DocumentRecord | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("blocksmith_documents")
    .select("*")
    .eq("file_name", fileName)
    .maybeSingle();
  if (error) throw new Error(`Document lookup failed: ${error.message}`);
  if (!data) return null;
  return {
    fileName: data.file_name as string,
    docRef: data.doc_ref as string,
    ownerUserId: data.owner_user_id as string,
    orgId: (data.org_id as string | null) ?? undefined,
    githubRepo: (data.github_repo as string | null) ?? undefined,
    scanMode: (data.scan_mode as string | null) ?? undefined,
    published: (data.published as boolean | null) ?? false,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

export async function registerDocument(input: {
  fileName: string;
  docRef: string;
  ownerUserId: string;
  orgId?: string;
  githubRepo?: string;
  scanMode?: string;
}): Promise<DocumentRecord> {
  const now = new Date().toISOString();
  const existing = await getDocument(input.fileName);

  if (existing && !isPublicDemoDocument(input.fileName)) {
    const sameOwner = existing.ownerUserId === input.ownerUserId;
    const sameOrg =
      existing.orgId && input.orgId && existing.orgId === input.orgId;
    if (!sameOwner && !sameOrg) {
      throw new Error(
        `Scan filename "${input.fileName}" is owned by another team. ` +
          `Set a unique workspaceId in blocksmith.config.json.`,
      );
    }
  }

  const record: DocumentRecord = {
    fileName: input.fileName,
    docRef: input.docRef,
    ownerUserId: input.ownerUserId,
    orgId: input.orgId ?? existing?.orgId,
    githubRepo: input.githubRepo,
    scanMode: input.scanMode,
    // Re-scanning / re-importing must never silently un-publish a live doc.
    published: existing?.published ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (saasDbEnabled()) {
    await upsertDb(record);
    if (!localCloudStoreWritable()) {
      return record;
    }
  }

  const store = readFileStore();
  const idx = store.documents.findIndex((d) => d.fileName === input.fileName);
  if (idx >= 0) store.documents[idx] = record;
  else store.documents.push(record);
  writeFileStore(store);

  return record;
}

async function deleteDb(fileName: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("blocksmith_documents")
    .delete()
    .eq("file_name", fileName);
  if (error) throw new Error(`Document delete failed: ${error.message}`);
}

/** Remove a document's registry record (DB + local store). */
export async function unregisterDocument(fileName: string): Promise<void> {
  if (saasDbEnabled()) {
    try {
      await deleteDb(fileName);
    } catch {
      /* best-effort — local removal still hides it from listings */
    }
    if (!localCloudStoreWritable()) return;
  }
  const store = readFileStore();
  const next = store.documents.filter((d) => d.fileName !== fileName);
  if (next.length !== store.documents.length) {
    writeFileStore({ version: 1, documents: next });
  }
}

export async function getDocument(
  fileName: string,
): Promise<DocumentRecord | null> {
  if (saasDbEnabled()) {
    const hit = await readDb(fileName);
    if (hit) return hit;
    if (!localCloudStoreWritable()) return null;
  }
  return readFileStore().documents.find((d) => d.fileName === fileName) ?? null;
}

export async function listDocumentsForOrg(
  orgId: string,
): Promise<DocumentRecord[]> {
  if (saasDbEnabled()) {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("blocksmith_documents")
      .select("*")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`Document list failed: ${error.message}`);
    return (data ?? []).map((d) => ({
      fileName: d.file_name as string,
      docRef: d.doc_ref as string,
      ownerUserId: d.owner_user_id as string,
      orgId: (d.org_id as string | null) ?? undefined,
      githubRepo: (d.github_repo as string | null) ?? undefined,
      scanMode: (d.scan_mode as string | null) ?? undefined,
      published: (d.published as boolean | null) ?? false,
      createdAt: d.created_at as string,
      updatedAt: d.updated_at as string,
    }));
  }
  return readFileStore().documents.filter((d) => d.orgId === orgId);
}

/** Toggle the opt-in public flag for a document (caller must be authorized). */
export async function setDocumentPublished(
  fileName: string,
  published: boolean,
): Promise<DocumentRecord> {
  const existing = await getDocument(fileName);
  if (!existing) throw new Error("Document not found");
  const record: DocumentRecord = {
    ...existing,
    published,
    updatedAt: new Date().toISOString(),
  };

  if (saasDbEnabled()) {
    await upsertDb(record);
    if (!localCloudStoreWritable()) return record;
  }

  const store = readFileStore();
  const idx = store.documents.findIndex((d) => d.fileName === fileName);
  if (idx >= 0) store.documents[idx] = record;
  else store.documents.push(record);
  writeFileStore(store);
  return record;
}

/** Documents an org has opted to publish on its public site. */
export async function listPublishedDocumentsForOrg(
  orgId: string,
): Promise<DocumentRecord[]> {
  const docs = await listDocumentsForOrg(orgId);
  return docs.filter((d) => d.published);
}

/**
 * Every published document, across all orgs — the Community shelf.
 *
 * Only rows whose owner explicitly flipped the published flag appear here:
 * publishing is an admin/owner action with an account behind it, which is
 * what separates a community template from an anonymous drop. Ownerless
 * documents can never reach this list — they have no one to publish them.
 */
export async function listPublishedDocuments(
  limit = 24,
): Promise<DocumentRecord[]> {
  if (saasDbEnabled()) {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("blocksmith_documents")
      .select("*")
      .eq("published", true)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Published list failed: ${error.message}`);
    return (data ?? []).map((d) => ({
      fileName: d.file_name as string,
      docRef: d.doc_ref as string,
      ownerUserId: d.owner_user_id as string,
      orgId: (d.org_id as string | null) ?? undefined,
      githubRepo: (d.github_repo as string | null) ?? undefined,
      scanMode: (d.scan_mode as string | null) ?? undefined,
      published: (d.published as boolean | null) ?? false,
      createdAt: d.created_at as string,
      updatedAt: d.updated_at as string,
    }));
  }
  return readFileStore()
    .documents.filter((d) => d.published)
    .slice(0, limit);
}

export async function canAccessDocument(
  fileName: string,
  userId: string | null,
  opts?: { allowAdminKey?: boolean; action?: DocAction },
): Promise<boolean> {
  // Explicit public content (named demo + bundled repo samples) is the only
  // unauthenticated-readable surface.
  if (isPublicContent(fileName)) return true;
  // Server-trusted admin API keys (CI / MCP) bypass ownership.
  if (opts?.allowAdminKey) return true;

  const doc = await getDocument(fileName);
  // DEFAULT DENY: if we cannot answer "who owns this?" from the registry, the
  // answer is no — an unregistered private doc is never world-readable.
  if (!doc) return false;

  // Opt-in public: a doc the org explicitly published is readable by anyone,
  // but only for reads — never for writes/promotes.
  const action = opts?.action ?? "read";
  if (doc.published && action === "read") return true;

  if (!userId) return false;

  const role = await getUserRoleForDocument(
    doc.orgId,
    doc.ownerUserId,
    userId,
  );
  if (!role) return false;
  return canPerform(role, opts?.action ?? "read");
}
