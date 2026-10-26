-- Allow agents to access only WhatsApp conversations assigned to them, even when
-- the connected WhatsApp instance is owned by a manager/admin account.
create schema if not exists private;

create or replace function private.can_access_whatsapp_instance(p_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.whatsapp_instances i
    where i.id = p_instance_id
      and (
        i.owner_id = (select auth.uid())
        or exists (
          select 1 from public.whatsapp_chats c
          where c.instance_id = i.id and c.assigned_to = (select auth.uid())
        )
      )
  );
$$;

revoke all on function private.can_access_whatsapp_instance(uuid) from public, anon;
grant execute on function private.can_access_whatsapp_instance(uuid) to authenticated;

drop policy if exists "WhatsApp instances owner select" on public.whatsapp_instances;
create policy "WhatsApp instances owner or assigned agent select"
  on public.whatsapp_instances for select to authenticated
  using (private.can_access_whatsapp_instance(id));

drop policy if exists "WhatsApp chats assigned agent select" on public.whatsapp_chats;
create policy "WhatsApp chats assigned agent select"
  on public.whatsapp_chats for select to authenticated
  using (assigned_to = (select auth.uid()));

drop policy if exists "WhatsApp chats assigned agent update" on public.whatsapp_chats;
create policy "WhatsApp chats assigned agent update"
  on public.whatsapp_chats for update to authenticated
  using (assigned_to = (select auth.uid()))
  with check (assigned_to = (select auth.uid()));

drop policy if exists "WhatsApp messages assigned agent select" on public.whatsapp_messages;
create policy "WhatsApp messages assigned agent select"
  on public.whatsapp_messages for select to authenticated
  using (
    exists (
      select 1 from public.whatsapp_chats c
      where c.id = whatsapp_messages.chat_id
        and c.assigned_to = (select auth.uid())
    )
  );
