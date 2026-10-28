-- WhatsApp flow sessions contain chat identifiers and agent assignments.
-- Restrict direct client reads to the instance owner or the assigned chat agent.
-- The existing manager policy remains in force; the webhook uses service_role.
drop policy if exists "Authenticated users can view WhatsApp flow sessions"
  on public.whatsapp_flow_sessions;

create policy "WhatsApp flow sessions visible to authorized chat users"
  on public.whatsapp_flow_sessions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.whatsapp_chats c
      join public.whatsapp_instances i on i.id = c.instance_id
      where c.id = whatsapp_flow_sessions.chat_id
        and c.instance_id = whatsapp_flow_sessions.instance_id
        and (
          i.owner_id = (select auth.uid())
          or c.assigned_to = (select auth.uid())
        )
    )
  );
