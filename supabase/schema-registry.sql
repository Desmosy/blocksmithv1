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
