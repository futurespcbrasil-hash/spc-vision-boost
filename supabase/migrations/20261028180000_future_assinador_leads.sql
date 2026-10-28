create table if not exists public.future_assinador_leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 120),
  telefone text not null check (char_length(telefone) between 8 and 30),
  email text not null check (char_length(email) between 5 and 254),
  interesse text not null check (interesse in ('certificado-digital', 'emissor-fiscal', 'spc-brasil', 'assinatura-pdf', 'outro')),
  consentimento boolean not null default false check (consentimento = true),
  origem text not null default 'future-assinador',
  created_at timestamptz not null default now()
);

create index if not exists future_assinador_leads_email_created_idx
  on public.future_assinador_leads (lower(email), created_at desc);

alter table public.future_assinador_leads enable row level security;
revoke all on table public.future_assinador_leads from anon, authenticated;
grant all on table public.future_assinador_leads to service_role;

comment on table public.future_assinador_leads is
  'Leads recebidos pela página pública Future Assinador. Acesso exclusivo à Edge Function com service_role; não armazenar PDFs ou certificados nesta tabela.';
