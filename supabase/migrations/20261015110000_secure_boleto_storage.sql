-- The finance module uploads files under <auth.uid()>/<filename>.
-- Ensure a private bucket exists and isolate every object's access by user folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('boletos', 'boletos', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false;

drop policy if exists "Boleto files select own folder" on storage.objects;
drop policy if exists "Boleto files insert own folder" on storage.objects;
drop policy if exists "Boleto files update own folder" on storage.objects;
drop policy if exists "Boleto files delete own folder" on storage.objects;

create policy "Boleto files select own folder"
on storage.objects for select to authenticated
using (bucket_id = 'boletos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Boleto files insert own folder"
on storage.objects for insert to authenticated
with check (bucket_id = 'boletos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Boleto files update own folder"
on storage.objects for update to authenticated
using (bucket_id = 'boletos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'boletos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Boleto files delete own folder"
on storage.objects for delete to authenticated
using (bucket_id = 'boletos' and (storage.foldername(name))[1] = auth.uid()::text);
