-- Restrict WhatsApp CRM data to the instance owner, assigned agent, or gestor.
-- Webhooks use the service role and are unaffected by these client-facing policies.

drop policy if exists "Atendente atualiza seus chats" on public.whatsapp_chats;
drop policy if exists "Atendente ve chats atribuidos ou livres" on public.whatsapp_chats;
drop policy if exists "Autenticado cria chats" on public.whatsapp_chats;
drop policy if exists "Gestor gerencia todos os chats" on public.whatsapp_chats;
drop policy if exists "Gestor ve todos os chats" on public.whatsapp_chats;

create policy "WhatsApp chats visible to owner agent or manager"
on public.whatsapp_chats for select to authenticated
using (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  or assigned_to = auth.uid()
  or exists (
    select 1 from public.whatsapp_instances i
    where i.id = whatsapp_chats.instance_id and i.owner_id = auth.uid()
  )
);

create policy "WhatsApp chats insert by owner or manager"
on public.whatsapp_chats for insert to authenticated
with check (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  or exists (
    select 1 from public.whatsapp_instances i
    where i.id = whatsapp_chats.instance_id and i.owner_id = auth.uid()
  )
);

create policy "WhatsApp chats update by owner agent or manager"
on public.whatsapp_chats for update to authenticated
using (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  or assigned_to = auth.uid()
  or exists (
    select 1 from public.whatsapp_instances i
    where i.id = whatsapp_chats.instance_id and i.owner_id = auth.uid()
  )
)
with check (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  or assigned_to = auth.uid()
  or exists (
    select 1 from public.whatsapp_instances i
    where i.id = whatsapp_chats.instance_id and i.owner_id = auth.uid()
  )
);

create policy "WhatsApp chats delete by owner or manager"
on public.whatsapp_chats for delete to authenticated
using (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  or exists (
    select 1 from public.whatsapp_instances i
    where i.id = whatsapp_chats.instance_id and i.owner_id = auth.uid()
  )
);

drop policy if exists "Autenticados gerenciam contatos" on public.whatsapp_contacts;
drop policy if exists "Autenticados veem contatos" on public.whatsapp_contacts;

create policy "WhatsApp contacts scoped to owner or manager"
on public.whatsapp_contacts for all to authenticated
using (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  or exists (
    select 1 from public.whatsapp_instances i
    where i.id = whatsapp_contacts.instance_id and i.owner_id = auth.uid()
  )
)
with check (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  or exists (
    select 1 from public.whatsapp_instances i
    where i.id = whatsapp_contacts.instance_id and i.owner_id = auth.uid()
  )
);

drop policy if exists "Atendente ve mensagens dos seus chats" on public.whatsapp_messages;
drop policy if exists "Autenticado insere mensagens" on public.whatsapp_messages;
drop policy if exists "Gestor atualiza mensagens" on public.whatsapp_messages;
drop policy if exists "Gestor ve todas as mensagens" on public.whatsapp_messages;

create policy "WhatsApp messages visible to owner assigned agent or manager"
on public.whatsapp_messages for select to authenticated
using (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  or exists (
    select 1 from public.whatsapp_instances i
    where i.id = whatsapp_messages.instance_id and i.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.whatsapp_chats c
    where c.id = whatsapp_messages.chat_id and c.assigned_to = auth.uid()
  )
);

create policy "WhatsApp messages insert by owner assigned agent or manager"
on public.whatsapp_messages for insert to authenticated
with check (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  or exists (
    select 1 from public.whatsapp_instances i
    where i.id = whatsapp_messages.instance_id and i.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.whatsapp_chats c
    where c.id = whatsapp_messages.chat_id and c.assigned_to = auth.uid()
  )
);

create policy "WhatsApp messages update by owner or manager"
on public.whatsapp_messages for update to authenticated
using (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  or exists (
    select 1 from public.whatsapp_instances i
    where i.id = whatsapp_messages.instance_id and i.owner_id = auth.uid()
  )
)
with check (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  or exists (
    select 1 from public.whatsapp_instances i
    where i.id = whatsapp_messages.instance_id and i.owner_id = auth.uid()
  )
);
