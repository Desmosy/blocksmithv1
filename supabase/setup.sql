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
