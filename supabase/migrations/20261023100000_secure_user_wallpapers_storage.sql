-- Private wallpaper storage for per-user CRM personalization.
-- The same migration has been applied to Supabase project jhmdavcidwqycjedvgoz.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-wallpapers', 'user-wallpapers', false, 10485760, array['image/webp'])
on conflict (id) do update
set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/webp'];

drop policy if exists "User wallpapers read own files" on storage.objects;
create policy "User wallpapers read own files"
on storage.objects for select to authenticated
using (bucket_id = 'user-wallpapers' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "User wallpapers upload own files" on storage.objects;
create policy "User wallpapers upload own files"
on storage.objects for insert to authenticated
with check (bucket_id = 'user-wallpapers' and (storage.foldername(name))[1] = (select auth.uid())::text and storage.extension(name) = 'webp');

drop policy if exists "User wallpapers update own files" on storage.objects;
create policy "User wallpapers update own files"
on storage.objects for update to authenticated
using (bucket_id = 'user-wallpapers' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'user-wallpapers' and (storage.foldername(name))[1] = (select auth.uid())::text and storage.extension(name) = 'webp');

drop policy if exists "User wallpapers delete own files" on storage.objects;
create policy "User wallpapers delete own files"
on storage.objects for delete to authenticated
using (bucket_id = 'user-wallpapers' and (storage.foldername(name))[1] = (select auth.uid())::text);
