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
