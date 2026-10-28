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


-- Mirror consented contacts into the existing CRM leads funnel.
-- The trigger runs in the same transaction as the intake insert, so the records cannot drift apart.
create or replace function public.sync_future_assinador_lead_to_crm()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  product_label text;
begin
  product_label := case new.interesse
    when 'certificado-digital' then 'Certificado Digital'
    when 'emissor-fiscal' then 'Emissor Fiscal'
    when 'spc-brasil' then 'SPC Brasil'
    when 'assinatura-pdf' then 'Future Assinador Digital'
    else 'Future Soluções'
  end;

  insert into public.leads (
    name, company, phone, whatsapp, email, type, origin, product,
    status, observations, funnel, created_at, updated_at
  ) values (
    new.nome, '', new.telefone, new.telefone, new.email, 'PJ',
    'Future Assinador Digital', product_label, 'lead_novo',
    'Contato captado pela página pública Future Assinador. Consentimento para retorno registrado em future_assinador_leads.',
    'spc', new.created_at, new.created_at
  );

  return new;
end;
$$;

drop trigger if exists trg_future_assinador_lead_to_crm on public.future_assinador_leads;
create trigger trg_future_assinador_lead_to_crm
after insert on public.future_assinador_leads
for each row execute function public.sync_future_assinador_lead_to_crm();

revoke all on function public.sync_future_assinador_lead_to_crm() from public, anon, authenticated;
