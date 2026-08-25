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
