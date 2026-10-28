-- Let agents who already have access to an instance read its WhatsApp groups.
-- Group chats remain read-only for agents; private chats stay assigned-only.
drop policy if exists "WhatsApp chats instance group select" on public.whatsapp_chats;
create policy "WhatsApp chats instance group select"
  on public.whatsapp_chats for select to authenticated
  using (
    is_group is true
    and private.can_access_whatsapp_instance(instance_id)
  );

drop policy if exists "WhatsApp messages instance group select" on public.whatsapp_messages;
create policy "WhatsApp messages instance group select"
  on public.whatsapp_messages for select to authenticated
  using (
    exists (
      select 1
      from public.whatsapp_chats c
      where c.id = whatsapp_messages.chat_id
        and c.instance_id = whatsapp_messages.instance_id
        and c.is_group is true
        and private.can_access_whatsapp_instance(c.instance_id)
    )
  );
