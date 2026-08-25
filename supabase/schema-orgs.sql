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
