-- BlockSmith — full Supabase setup, in dependency order.
-- Paste this whole file into Supabase Dashboard → SQL Editor → Run.
-- Generated from the individual files in supabase/; safe to re-run.


-- ============================================================
-- setup.sql
-- ============================================================
-- Run once in Supabase Dashboard → SQL Editor
-- BlockSmith: private bucket for scan + design .md files

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'scan-docs',
  'scan-docs',
  false,
  2097152,
  array['text/markdown', 'text/plain', 'application/json', 'application/octet-stream']
)
on conflict (id) do nothing;

-- Server uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). Optional public read later:

-- create policy "Public read scan docs"
-- on storage.objects for select
-- using ( bucket_id = 'scan-docs' );

-- Next: run schema.sql then schema-orgs.sql for SaaS + team RBAC.


-- ============================================================
-- schema.sql
-- ============================================================
-- BlockSmith SaaS tables — run in Supabase SQL Editor after setup.sql
-- Requires Supabase Auth (GitHub provider) for user-bound keys and doc ownership.

-- Document ownership (upload:scan-*.md)
create table if not exists public.blocksmith_documents (
  file_name text primary key,
  doc_ref text not null unique,
  owner_user_id uuid not null,
  github_repo text,
  scan_mode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blocksmith_documents_owner_idx
  on public.blocksmith_documents (owner_user_id);

-- Self-serve API keys (CLI pull / scan / MCP)
create table if not exists public.blocksmith_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  prefix text not null,
  hash text not null unique,
  label text not null default 'default',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists blocksmith_api_keys_user_idx
  on public.blocksmith_api_keys (user_id);

create index if not exists blocksmith_api_keys_hash_idx
  on public.blocksmith_api_keys (hash)
  where revoked_at is null;


-- ============================================================
-- schema-orgs.sql
-- ============================================================
-- BlockSmith team/org RBAC — run after schema.sql
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

create table if not exists public.blocksmith_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blocksmith_org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.blocksmith_organizations(id) on delete cascade,
  user_id uuid,
  invited_email text,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id),
  unique (org_id, invited_email)
);

create index if not exists blocksmith_org_members_user_idx
  on public.blocksmith_org_members (user_id)
  where user_id is not null;

create index if not exists blocksmith_org_members_email_idx
  on public.blocksmith_org_members (invited_email)
  where invited_email is not null;

alter table public.blocksmith_documents
  add column if not exists org_id uuid references public.blocksmith_organizations(id) on delete set null;

create index if not exists blocksmith_documents_org_idx
  on public.blocksmith_documents (org_id);

-- Opt-in public publishing: a doc the org marks public is readable without auth
-- on /sites/<org-slug>. Default false keeps everything private (default-deny).
alter table public.blocksmith_documents
  add column if not exists published boolean not null default false;

create index if not exists blocksmith_documents_published_idx
  on public.blocksmith_documents (org_id)
  where published = true;


-- ============================================================
-- schema-registry.sql
-- ============================================================
-- Design IR registry, locks, and pipeline runs — durable on Vercel.
-- (PROJECT-PIPELINE.md "Platform dependency"; mirrors documents/orgs pattern.)
--
-- Apply with: psql or the Supabase SQL editor. Service-role only access;
-- the app talks to these tables through getSupabaseAdmin().

-- Append-only block version registry: one row per (doc, block id).
create table if not exists blocksmith_block_registry_entries (
  doc_ref text not null,
  block_id text not null,
  -- Full BlockRegistryEntry.versions array (append-only by contract).
  versions jsonb not null default '[]'::jsonb,
  -- Official (promoted) version pointer; null = never promoted.
  official integer,
  updated_at timestamptz not null default now(),
  primary key (doc_ref, block_id)
);

create index if not exists idx_registry_entries_doc
  on blocksmith_block_registry_entries (doc_ref);

-- Per-doc manifest: graph hash + counts for staleness checks.
create table if not exists blocksmith_registry_manifest (
  doc_ref text primary key,
  system_id text not null default '',
  official_graph_hash text not null default '',
  block_count integer not null default 0,
  promoted_count integer not null default 0,
  draft_count integer not null default 0,
  stale_count integer not null default 0,
  last_ingest_at timestamptz not null default now()
);

-- Reference locks: what the wiki last pinned per doc.
create table if not exists blocksmith_block_locks (
  doc_ref text primary key,
  lock jsonb not null,
  content_hash text not null,
  generated_at timestamptz not null default now()
);

-- Pipeline runs: promote / rollback / pin-lock / ingest audit (append-only).
create table if not exists blocksmith_pipeline_runs (
  run_id text primary key,
  doc_ref text not null,
  run_number int,
  actor text not null default 'unknown',
  action text not null check (action in ('promote','rollback','pin-lock','ingest','demo-seed')),
  summary text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  lock_before text,
  lock_after text,
  duration_ms int,
  stages jsonb,
  created_at timestamptz not null default now()
);

-- Migrate existing deployments (idempotent).
alter table blocksmith_pipeline_runs add column if not exists run_number int;
alter table blocksmith_pipeline_runs add column if not exists duration_ms int;
alter table blocksmith_pipeline_runs add column if not exists stages jsonb;
-- Console output: run outcome + captured log lines (failed runs are recorded).
alter table blocksmith_pipeline_runs add column if not exists status text not null default 'success';
alter table blocksmith_pipeline_runs add column if not exists log jsonb;

create index if not exists idx_pipeline_runs_doc
  on blocksmith_pipeline_runs (doc_ref, created_at desc);

-- RLS: service-role only (admin client). No anon/user policies on purpose —
-- document-level access is enforced in the app via requireDocumentAccess.
alter table blocksmith_block_registry_entries enable row level security;
alter table blocksmith_registry_manifest enable row level security;
alter table blocksmith_block_locks enable row level security;
alter table blocksmith_pipeline_runs enable row level security;


-- ============================================================
-- schema-governance-events.sql
-- ============================================================
-- Governance violation events — warn-tier drift + block-tier bypass audit trail.
-- Run in Supabase SQL Editor after schema.sql + schema-orgs.sql.

create table if not exists public.blocksmith_governance_events (
  id uuid primary key default gen_random_uuid(),
  doc_ref text not null,
  component_id text,
  component_title text,
  author text not null,
  source text not null check (source in ('mcp', 'cli', 'git-hook', 'ci')),
  action text not null check (action in ('detected', 'overridden', 'bypass')),
  findings jsonb not null default '[]'::jsonb,
  commit_sha text,
  branch text,
  override_reason text,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blocksmith_governance_events_doc_idx
  on public.blocksmith_governance_events (doc_ref, created_at desc);

create index if not exists blocksmith_governance_events_status_idx
  on public.blocksmith_governance_events (doc_ref, status)
  where status = 'open';

