"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type OrgMember = {
  id: string;
  orgId: string;
  userId: string | null;
  invitedEmail: string | null;
  role: string;
  createdAt: string;
};

type OrgPayload = {
  org: { id: string; name: string; slug: string };
  members: OrgMember[];
  login: string | null;
  email: string | null;
  currentUserId: string;
};

const ROLE_HINT: Record<string, string> = {
  owner: "Full control",
  admin: "Invite & remove members",
  member: "Scan, finalize, pull",
  viewer: "Read wiki only",
};

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  role: z.enum(["member", "viewer", "admin"]),
});
type InviteForm = z.infer<typeof inviteSchema>;

export function TeamPanel() {
  const [data, setData] = useState<OrgPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "member" },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/orgs/me");
      const json = await res.json();
      if (!res.ok) {
        setData(null);
        if (res.status !== 401) setError(json.error || "Failed to load team");
        return;
      }
      setData(json);
    } catch {
      setError("Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async ({ email, role }: InviteForm) => {
    setError(null);
    try {
      const res = await fetch("/api/v1/orgs/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Invite failed");
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    }
  };

  const remove = async (memberId: string) => {
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/orgs/members?id=${encodeURIComponent(memberId)}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Remove failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    }
  };

  if (loading) {
    return <p className="text-sm text-[var(--wiki-muted)]">Loading team…</p>;
  }

  if (!data) {
    return (
      <p className="text-sm text-[var(--wiki-muted)]">
        Connect GitHub to manage your team.
      </p>
    );
  }

  const myRole =
    data.members.find((m) => m.userId === data.currentUserId)?.role ?? "owner";
  const canManage = myRole === "owner" || myRole === "admin";

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--wiki-muted)]">
        <strong className="text-[var(--wiki-text)]">{data.org.name}</strong>
      </p>

      {canManage ? (
        <form className="flex flex-wrap gap-2" onSubmit={handleSubmit(invite)}>
          <input
            type="email"
            {...register("email")}
            placeholder="teammate@company.com"
            className="min-w-[200px] flex-1 rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-2 text-sm"
          />
          <select
            {...register("role")}
            className="rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-2 py-2 text-sm"
          >
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-[var(--wiki-accent)] px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
          >
            {isSubmitting ? "Inviting…" : "Invite"}
          </button>
          {errors.email ? <p className="w-full text-xs text-red-600">{errors.email.message}</p> : null}
        </form>
      ) : null}

      {error ? (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <ul className="divide-y divide-[var(--wiki-border)] rounded-lg border border-[var(--wiki-border)]">
        {data.members.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
          >
            <div>
              <span className="font-medium text-[var(--wiki-text)]">
                {m.invitedEmail ?? (m.userId ? "Member" : "Pending")}
              </span>
              <span className="ml-2 rounded bg-[var(--wiki-active)] px-1.5 py-0.5 font-mono text-[10px] uppercase">
                {m.role}
              </span>
              <span className="ml-2 text-[var(--wiki-muted)]">
                {ROLE_HINT[m.role] ?? ""}
              </span>
            </div>
            {canManage && m.role !== "owner" ? (
              <button
                type="button"
                onClick={() => void remove(m.id)}
                className="text-[var(--wiki-muted)] hover:text-red-600"
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
