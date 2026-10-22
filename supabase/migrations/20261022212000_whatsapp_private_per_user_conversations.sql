-- WhatsApp Conversations are private per instance owner. Leads and Kanban policies are untouched.
-- Remove role, assignment, and email-based overrides from private WhatsApp rows.
drop policy if exists "Gestores veem todas as instancias" on public.whatsapp_instances;
drop policy if exists "Usuarios gerenciam suas instancias" on public.whatsapp_instances;
drop policy if exists "Usuarios veem suas instancias" on public.whatsapp_instances;
drop policy if exists "Owner full access whatsapp_instances" on public.whatsapp_instances;
create policy "WhatsApp instances owner select" on public.whatsapp_instances for select to authenticated using (owner_id = (select auth.uid()));
create policy "WhatsApp instances owner insert" on public.whatsapp_instances for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "WhatsApp instances owner update" on public.whatsapp_instances for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "WhatsApp instances owner delete" on public.whatsapp_instances for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "WhatsApp chats visible to owner agent or manager" on public.whatsapp_chats;
drop policy if exists "WhatsApp chats update by owner agent or manager" on public.whatsapp_chats;
drop policy if exists "WhatsApp chats insert by owner or manager" on public.whatsapp_chats;
drop policy if exists "WhatsApp chats delete by owner or manager" on public.whatsapp_chats;
drop policy if exists "Owner full access whatsapp_chats" on public.whatsapp_chats;
create policy "WhatsApp chats owner select" on public.whatsapp_chats for select to authenticated using (exists (select 1 from public.whatsapp_instances i where i.id = whatsapp_chats.instance_id and i.owner_id = (select auth.uid())));
create policy "WhatsApp chats owner insert" on public.whatsapp_chats for insert to authenticated with check (exists (select 1 from public.whatsapp_instances i where i.id = whatsapp_chats.instance_id and i.owner_id = (select auth.uid())));
create policy "WhatsApp chats owner update" on public.whatsapp_chats for update to authenticated using (exists (select 1 from public.whatsapp_instances i where i.id = whatsapp_chats.instance_id and i.owner_id = (select auth.uid()))) with check (exists (select 1 from public.whatsapp_instances i where i.id = whatsapp_chats.instance_id and i.owner_id = (select auth.uid())));
create policy "WhatsApp chats owner delete" on public.whatsapp_chats for delete to authenticated using (exists (select 1 from public.whatsapp_instances i where i.id = whatsapp_chats.instance_id and i.owner_id = (select auth.uid())));

drop policy if exists "WhatsApp messages visible to owner assigned agent or manager" on public.whatsapp_messages;
drop policy if exists "WhatsApp messages insert by owner assigned agent or manager" on public.whatsapp_messages;
drop policy if exists "WhatsApp messages update by owner or manager" on public.whatsapp_messages;
drop policy if exists "Owner full access whatsapp_messages" on public.whatsapp_messages;
create policy "WhatsApp messages owner select" on public.whatsapp_messages for select to authenticated using (exists (select 1 from public.whatsapp_instances i where i.id = whatsapp_messages.instance_id and i.owner_id = (select auth.uid())));
create policy "WhatsApp messages owner insert" on public.whatsapp_messages for insert to authenticated with check (exists (select 1 from public.whatsapp_instances i where i.id = whatsapp_messages.instance_id and i.owner_id = (select auth.uid())));
create policy "WhatsApp messages owner update" on public.whatsapp_messages for update to authenticated using (exists (select 1 from public.whatsapp_instances i where i.id = whatsapp_messages.instance_id and i.owner_id = (select auth.uid()))) with check (exists (select 1 from public.whatsapp_instances i where i.id = whatsapp_messages.instance_id and i.owner_id = (select auth.uid())));
create policy "WhatsApp messages owner delete" on public.whatsapp_messages for delete to authenticated using (exists (select 1 from public.whatsapp_instances i where i.id = whatsapp_messages.instance_id and i.owner_id = (select auth.uid())));

-- Assignment history must not expose metadata for another user's private WhatsApp conversations.
drop policy if exists "Authorized users read WhatsApp assignment history" on public.whatsapp_chat_assignment_history;
create policy "WhatsApp assignment history instance owner only" on public.whatsapp_chat_assignment_history for select to authenticated
using (exists (select 1 from public.whatsapp_chats c join public.whatsapp_instances i on i.id = c.instance_id where c.id = whatsapp_chat_assignment_history.chat_id and i.owner_id = (select auth.uid())));

-- Enable database Realtime for new/updated conversation data.
do $$
declare t text;
begin
  foreach t in array array['whatsapp_chats','whatsapp_messages'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
