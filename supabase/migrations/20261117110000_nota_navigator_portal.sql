-- Nota Navigator Academy portal content is isolated from CRM business tables.
create table if not exists public.portal_course_content (
  id text primary key default 'default' check (id = 'default'),
  content jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint portal_course_content_shape check (
    jsonb_typeof(content->'modules') = 'array'
    and jsonb_typeof(content->'lessons') = 'object'
  )
);
alter table public.portal_course_content enable row level security;
drop policy if exists "Portal course is readable by visitors" on public.portal_course_content;
create policy "Portal course is readable by visitors" on public.portal_course_content
  for select to anon, authenticated using (true);
drop policy if exists "Only Future owner can create portal course" on public.portal_course_content;
create policy "Only Future owner can create portal course" on public.portal_course_content
  for insert to authenticated with check (
    (auth.jwt()->>'email') = 'dalprapf1@gmail.com'
    and (updated_by is null or updated_by = auth.uid())
  );
drop policy if exists "Only Future owner can update portal course" on public.portal_course_content;
create policy "Only Future owner can update portal course" on public.portal_course_content
  for update to authenticated using ((auth.jwt()->>'email') = 'dalprapf1@gmail.com')
  with check ((auth.jwt()->>'email') = 'dalprapf1@gmail.com' and (updated_by is null or updated_by = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal-media', 'portal-media', true, 15728640, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Portal media is publicly readable" on storage.objects;
create policy "Portal media is publicly readable" on storage.objects for select to anon, authenticated using (bucket_id = 'portal-media');
drop policy if exists "Only Future owner can upload portal media" on storage.objects;
create policy "Only Future owner can upload portal media" on storage.objects for insert to authenticated with check (bucket_id = 'portal-media' and (auth.jwt()->>'email') = 'dalprapf1@gmail.com');
drop policy if exists "Only Future owner can update portal media" on storage.objects;
create policy "Only Future owner can update portal media" on storage.objects for update to authenticated using (bucket_id = 'portal-media' and (auth.jwt()->>'email') = 'dalprapf1@gmail.com') with check (bucket_id = 'portal-media' and (auth.jwt()->>'email') = 'dalprapf1@gmail.com');
drop policy if exists "Only Future owner can delete portal media" on storage.objects;
create policy "Only Future owner can delete portal media" on storage.objects for delete to authenticated using (bucket_id = 'portal-media' and (auth.jwt()->>'email') = 'dalprapf1@gmail.com');
