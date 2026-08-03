drop policy "whatsapp media auth insert" on storage.objects;
drop policy "whatsapp media auth update" on storage.objects;
drop policy "whatsapp media auth delete" on storage.objects;

create policy "whatsapp media owner insert" on storage.objects for insert to authenticated with check (bucket_id = 'whatsapp-media' and owner = auth.uid());
create policy "whatsapp media owner update" on storage.objects for update to authenticated using (bucket_id = 'whatsapp-media' and owner = auth.uid()) with check (bucket_id = 'whatsapp-media' and owner = auth.uid());
create policy "whatsapp media owner delete" on storage.objects for delete to authenticated using (bucket_id = 'whatsapp-media' and owner = auth.uid());