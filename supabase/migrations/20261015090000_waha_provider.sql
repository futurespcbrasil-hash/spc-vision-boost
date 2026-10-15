-- WAHA provider support and tenant-safe instance mapping.
alter table public.whatsapp_instances
  add column if not exists provider text not null default 'ryze',
  add column if not exists provider_instance_name text;

create index if not exists whatsapp_instances_owner_provider_idx
  on public.whatsapp_instances (owner_id, provider);

-- Keep existing instances marked as Ryze until each is migrated explicitly.
update public.whatsapp_instances
set provider = 'ryze'
where provider is null;
