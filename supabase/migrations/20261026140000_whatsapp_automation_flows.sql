-- Configurable WhatsApp welcome/menu flows for Future SPC Vision.
create table if not exists public.whatsapp_flows (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.whatsapp_instances(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  welcome_message text not null default 'Olá! Seja bem-vindo(a).',
  menu_message text not null default 'Para continuar, selecione uma opção:',
  fallback_message text not null default 'Não consegui identificar sua opção. Digite o número de uma das opções do menu.',
  options jsonb not null default '[]'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_flows_name_nonempty check (length(trim(name)) > 0),
  constraint whatsapp_flows_options_array check (jsonb_typeof(options) = 'array')
);

create unique index if not exists whatsapp_flows_one_active_per_instance
  on public.whatsapp_flows(instance_id) where is_active = true;

create table if not exists public.whatsapp_flow_sessions (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.whatsapp_flows(id) on delete cascade,
  instance_id uuid not null references public.whatsapp_instances(id) on delete cascade,
  chat_id uuid not null references public.whatsapp_chats(id) on delete cascade,
  wa_chat_id text not null,
  status text not null default 'awaiting_choice'
    check (status in ('awaiting_choice','routed','paused')),
  selected_option_key text,
  target_label text,
  assigned_to uuid references auth.users(id) on delete set null,
  last_inbound_message_id text,
  last_interaction_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(instance_id, wa_chat_id)
);

alter table public.whatsapp_flows enable row level security;
alter table public.whatsapp_flow_sessions enable row level security;

drop policy if exists "Authenticated users can view WhatsApp flows" on public.whatsapp_flows;
create policy "Authenticated users can view WhatsApp flows"
  on public.whatsapp_flows for select to authenticated
  using (true);

drop policy if exists "Managers manage WhatsApp flows" on public.whatsapp_flows;
create policy "Managers manage WhatsApp flows"
  on public.whatsapp_flows for all to authenticated
  using (has_role((select auth.uid()), 'gestor'::app_role) or (select auth.uid()) = '33b9e710-594d-4811-8e94-ba87507cf556'::uuid)
  with check (has_role((select auth.uid()), 'gestor'::app_role) or (select auth.uid()) = '33b9e710-594d-4811-8e94-ba87507cf556'::uuid);

drop policy if exists "Authenticated users can view WhatsApp flow sessions" on public.whatsapp_flow_sessions;
create policy "Authenticated users can view WhatsApp flow sessions"
  on public.whatsapp_flow_sessions for select to authenticated
  using (true);

drop policy if exists "Managers manage WhatsApp flow sessions" on public.whatsapp_flow_sessions;
create policy "Managers manage WhatsApp flow sessions"
  on public.whatsapp_flow_sessions for all to authenticated
  using (has_role((select auth.uid()), 'gestor'::app_role) or (select auth.uid()) = '33b9e710-594d-4811-8e94-ba87507cf556'::uuid)
  with check (has_role((select auth.uid()), 'gestor'::app_role) or (select auth.uid()) = '33b9e710-594d-4811-8e94-ba87507cf556'::uuid);

create index if not exists whatsapp_flow_sessions_status_idx
  on public.whatsapp_flow_sessions(instance_id, status, updated_at desc);
