import "server-only";

import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { localCloudStoreWritable, saasDbEnabled } from "./saas";
import type { OrgRole } from "./rbac";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type OrgMember = {
  id: string;
  orgId: string;
  userId: string | null;
  invitedEmail: string | null;
  role: OrgRole;
  createdAt: string;
};

type OrgStore = {
  version: 1;
  organizations: Organization[];
  members: OrgMember[];
};

const STORE_DIR = join(process.cwd(), "data", "cloud");
const STORE_PATH = join(STORE_DIR, "orgs.json");

function readStore(): OrgStore {
  if (!existsSync(STORE_PATH)) {
    return { version: 1, organizations: [], members: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf-8")) as OrgStore;
    if (raw?.version === 1) return raw;
  } catch {
    /* corrupt */
  }
  return { version: 1, organizations: [], members: [] };
}

function writeStore(store: OrgStore): void {
  if (!localCloudStoreWritable()) return;
  mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf-8");
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "team"
  );
}

function personalSlug(userId: string, login: string | null): string {
  if (login) return slugify(`${login}-workspace`);
  return `user-${userId.replace(/-/g, "").slice(0, 12)}`;
}

function rowToOrg(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToMember(row: Record<string, unknown>): OrgMember {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    userId: (row.user_id as string | null) ?? null,
    invitedEmail: (row.invited_email as string | null) ?? null,
    role: row.role as OrgRole,
    createdAt: row.created_at as string,
  };
}

/** First sign-in / scan — personal org for the user. */
export async function ensureDefaultOrg(
  userId: string,
  login: string | null,
): Promise<Organization> {
  await acceptPendingInvites(userId, null);

  const existing = await listOrgsForUser(userId);
  if (existing.length > 0) return existing[0];

  const now = new Date().toISOString();
  const name = login ? `${login}'s workspace` : "My workspace";
  const slug = personalSlug(userId, login);
  const org: Organization = {
    id: randomUUID(),
    name,
    slug,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  const ownerMember: OrgMember = {
    id: randomUUID(),
    orgId: org.id,
    userId,
    invitedEmail: null,
    role: "owner",
    createdAt: now,
  };

  if (saasDbEnabled()) {
    const sb = getSupabaseAdmin();
    const { error: orgErr } = await sb.from("blocksmith_organizations").insert({
      id: org.id,
      name: org.name,
      slug: org.slug,
      created_by: org.createdBy,
    });
    if (orgErr) throw orgErr;
    const { error: memberErr } = await sb.from("blocksmith_org_members").insert({
      id: ownerMember.id,
      org_id: org.id,
      user_id: userId,
      role: "owner",
    });
    if (memberErr) throw memberErr;
    return org;
  }

  const store = readStore();
  store.organizations.push(org);
  store.members.push(ownerMember);
  writeStore(store);

  return org;
}

export async function listOrgsForUser(userId: string): Promise<Organization[]> {
  if (saasDbEnabled()) {
    try {
      const sb = getSupabaseAdmin();
      const { data, error } = await sb
        .from("blocksmith_org_members")
        .select("blocksmith_organizations (*)")
        .eq("user_id", userId);
      if (!error && data?.length) {
        return data
          .map((row) => {
            const org = row.blocksmith_organizations as
              | Record<string, unknown>
              | Record<string, unknown>[]
              | null;
            if (Array.isArray(org)) return org[0];
            return org;
          })
          .filter(Boolean)
          .map((row) => rowToOrg(row as Record<string, unknown>));
      }
    } catch {
      /* fall through */
    }
  }

  const store = readStore();
  const orgIds = new Set(
    store.members.filter((m) => m.userId === userId).map((m) => m.orgId),
  );
  return store.organizations.filter((o) => orgIds.has(o.id));
}

export async function getOrgBySlug(slug: string): Promise<Organization | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  if (saasDbEnabled()) {
    try {
      const sb = getSupabaseAdmin();
      const { data, error } = await sb
        .from("blocksmith_organizations")
        .select("*")
        .eq("slug", normalized)
        .maybeSingle();
      if (!error && data) return rowToOrg(data);
    } catch {
      /* fall through */
    }
  }
  return readStore().organizations.find((o) => o.slug === normalized) ?? null;
}

export async function getMemberRole(
  orgId: string,
  userId: string,
): Promise<OrgRole | null> {
  if (saasDbEnabled()) {
    try {
      const sb = getSupabaseAdmin();
      const { data, error } = await sb
        .from("blocksmith_org_members")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!error && data?.role) return data.role as OrgRole;
    } catch {
      /* fall through */
    }
  }

  const hit = readStore().members.find(
    (m) => m.orgId === orgId && m.userId === userId,
  );
  return hit?.role ?? null;
}

export async function getUserRoleForDocument(
  orgId: string | undefined,
  ownerUserId: string,
  userId: string | null,
): Promise<OrgRole | null> {
  if (!userId) return null;
  if (orgId) return getMemberRole(orgId, userId);
  if (ownerUserId === userId) return "owner";
  return null;
}

export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  if (saasDbEnabled()) {
    try {
      const sb = getSupabaseAdmin();
      const { data, error } = await sb
        .from("blocksmith_org_members")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });
      if (!error && data) return data.map(rowToMember);
    } catch {
      /* fall through */
    }
  }
  return readStore().members.filter((m) => m.orgId === orgId);
}

export async function inviteOrgMember(
  orgId: string,
  invitedBy: string,
  email: string,
  role: OrgRole = "member",
): Promise<OrgMember> {
  const inviterRole = await getMemberRole(orgId, invitedBy);
  if (!inviterRole || !["owner", "admin"].includes(inviterRole)) {
    throw new Error("Only org owners and admins can invite members");
  }
  if (role === "owner") {
    throw new Error("Cannot invite another owner — transfer ownership is not supported yet");
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) {
    throw new Error("Valid email required");
  }

  const now = new Date().toISOString();
  const member: OrgMember = {
    id: randomUUID(),
    orgId,
    userId: null,
    invitedEmail: normalized,
    role,
    createdAt: now,
  };

  if (saasDbEnabled()) {
    const sb = getSupabaseAdmin();
    const { data: existing } = await sb
      .from("blocksmith_org_members")
      .select("*")
      .eq("org_id", orgId)
      .eq("invited_email", normalized)
      .maybeSingle();
    if (existing) return rowToMember(existing);

    const { error } = await sb.from("blocksmith_org_members").insert({
      id: member.id,
      org_id: orgId,
      invited_email: normalized,
      role,
    });
    if (error) throw new Error(error.message);
    return member;
  }

  const store = readStore();
  const dup = store.members.find(
    (m) =>
      m.orgId === orgId &&
      (m.invitedEmail === normalized ||
        (m.userId && m.invitedEmail === normalized)),
  );
  if (dup) return dup;
  store.members.push(member);
  writeStore(store);
  return member;
}

export async function removeOrgMember(
  orgId: string,
  actorUserId: string,
  memberId: string,
): Promise<void> {
  const actorRole = await getMemberRole(orgId, actorUserId);
  if (!actorRole || !["owner", "admin"].includes(actorRole)) {
    throw new Error("Only org owners and admins can remove members");
  }

  const members = await listOrgMembers(orgId);
  const target = members.find((m) => m.id === memberId);
  if (!target) throw new Error("Member not found");
  if (target.role === "owner") {
    throw new Error("Cannot remove the org owner");
  }
  if (actorRole === "admin" && target.role === "admin") {
    throw new Error("Admins cannot remove other admins");
  }

  if (saasDbEnabled()) {
    try {
      const sb = getSupabaseAdmin();
      await sb
        .from("blocksmith_org_members")
        .delete()
        .eq("id", memberId)
        .eq("org_id", orgId);
    } catch {
      /* fall through */
    }
  }

  const store = readStore();
  store.members = store.members.filter((m) => m.id !== memberId);
  writeStore(store);
}

export async function acceptPendingInvites(
  userId: string,
  email: string | null,
): Promise<number> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return 0;

  let accepted = 0;

  if (saasDbEnabled()) {
    try {
      const sb = getSupabaseAdmin();
      const { data } = await sb
        .from("blocksmith_org_members")
        .select("*")
        .eq("invited_email", normalized)
        .is("user_id", null);
      for (const row of data ?? []) {
        await sb
          .from("blocksmith_org_members")
          .update({ user_id: userId, invited_email: null })
          .eq("id", row.id);
        accepted += 1;
      }
    } catch {
      /* fall through */
    }
  }

  const store = readStore();
  for (const m of store.members) {
    if (m.invitedEmail === normalized && !m.userId) {
      m.userId = userId;
      m.invitedEmail = null;
      accepted += 1;
    }
  }
  if (accepted) writeStore(store);
  return accepted;
}
