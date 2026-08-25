-- Deviation TTL + governance settings — run after schema-orgs.sql.
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- ── Deviation records ────────────────────────────────────────────────────────
-- Each row is a conscious push that differs from the finalized wiki lock.

create table if not exists public.blocksmith_deviations (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.blocksmith_organizations(id) on delete cascade,
  doc_ref        text not null,
  block_id       text not null,
  pushed_by      text not null,                          -- GitHub login or user id
  deviation_diff jsonb not null default '{}'::jsonb,     -- { field, wikiValue, pushedValue }
  commit_ref     text,
  pr_url         text,
  reason         text,                                   -- developer's stated reason
  status         text not null default 'pending'
    check (status in ('pending', 'auto_approved', 'approved', 'rejected', 'resolved')),
  reviewed_by    text,                                   -- reviewer GitHub login
  fix_suggestion text,                                   -- message from reviewer on reject
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,                   -- created_at + TTL
  resolved_at    timestamptz,
  rejection_count int not null default 0                 -- for progressive escalation
);

create index if not exists idx_deviations_org_status
  on public.blocksmith_deviations (org_id, status);

create index if not exists idx_deviations_pushed_by
  on public.blocksmith_deviations (pushed_by, status);

create index if not exists idx_deviations_expires
  on public.blocksmith_deviations (expires_at)
  where status = 'pending';

create index if not exists idx_deviations_block
  on public.blocksmith_deviations (org_id, block_id, status);

-- ── Org governance settings ──────────────────────────────────────────────────
-- One row per org. Controls TTL, budgets, and escalation thresholds.

create table if not exists public.org_governance_settings (
  org_id                  uuid primary key references public.blocksmith_organizations(id) on delete cascade,
  ttl_hours               int not null default 24,
  max_open_per_dev        int not null default 3,
  rejections_before_block int not null default 2,
  allow_auto_approve      boolean not null default true,
  notify_team_email       boolean not null default true,
  notify_team_wiki        boolean not null default true,
  review_roles            text[] not null default '{admin,owner}',
  updated_at              timestamptz not null default now()
);
