create table if not exists public.atendimento_indicacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  razao_social text,
  cnpj text,
  responsavel text,
  telefone text,
  email text,
  cidade text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atendimento_indicacoes_nome_not_blank check (length(trim(nome)) > 0)
);
create index if not exists atendimento_indicacoes_user_created_idx on public.atendimento_indicacoes (user_id, created_at desc);
create unique index if not exists atendimento_indicacoes_cnpj_unique
  on public.atendimento_indicacoes ((regexp_replace(cnpj, '\D', '', 'g')))
  where cnpj is not null and length(regexp_replace(cnpj, '\D', '', 'g')) > 0;
alter table public.atendimento_indicacoes enable row level security;
grant select, insert, update, delete on public.atendimento_indicacoes to authenticated;

drop policy if exists "Atendimento vê próprias indicações e gestor vê todas" on public.atendimento_indicacoes;
create policy "Atendimento vê próprias indicações e gestor vê todas" on public.atendimento_indicacoes for select to authenticated
using ((user_id = (select auth.uid()) and has_role((select auth.uid()), 'atendimento'::app_role))
  or has_role((select auth.uid()), 'gestor'::app_role)
  or lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail.com');

drop policy if exists "Atendimento e gestores inserem indicações" on public.atendimento_indicacoes;
create policy "Atendimento e gestores inserem indicações" on public.atendimento_indicacoes for insert to authenticated
with check ((user_id = (select auth.uid()) and has_role((select auth.uid()), 'atendimento'::app_role))
  or has_role((select auth.uid()), 'gestor'::app_role)
  or lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail.com');

drop policy if exists "Atendimento atualiza próprias indicações e gestor todas" on public.atendimento_indicacoes;
create policy "Atendimento atualiza próprias indicações e gestor todas" on public.atendimento_indicacoes for update to authenticated
using ((user_id = (select auth.uid()) and has_role((select auth.uid()), 'atendimento'::app_role))
  or has_role((select auth.uid()), 'gestor'::app_role)
  or lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail.com')
with check ((user_id = (select auth.uid()) and has_role((select auth.uid()), 'atendimento'::app_role))
  or has_role((select auth.uid()), 'gestor'::app_role)
  or lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail.com');

drop policy if exists "Atendimento exclui próprias indicações e gestor todas" on public.atendimento_indicacoes;
create policy "Atendimento exclui próprias indicações e gestor todas" on public.atendimento_indicacoes for delete to authenticated
using ((user_id = (select auth.uid()) and has_role((select auth.uid()), 'atendimento'::app_role))
  or has_role((select auth.uid()), 'gestor'::app_role)
  or lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail.com');

create table if not exists public.atendimento_comissao_config (
  id integer primary key default 1 check (id = 1),
  valor_mensal numeric(10,2) not null default 10.00 check (valor_mensal >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.atendimento_comissao_config (id, valor_mensal) values (1, 10.00) on conflict (id) do nothing;
alter table public.atendimento_comissao_config enable row level security;
grant select, insert, update on public.atendimento_comissao_config to authenticated;

drop policy if exists "Gestor consulta configuração de comissão Atendimento" on public.atendimento_comissao_config;
create policy "Gestor consulta configuração de comissão Atendimento" on public.atendimento_comissao_config for select to authenticated
using (has_role((select auth.uid()), 'gestor'::app_role)
  or lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail.com');

drop policy if exists "Gestor altera configuração de comissão Atendimento" on public.atendimento_comissao_config;
create policy "Gestor altera configuração de comissão Atendimento" on public.atendimento_comissao_config for all to authenticated
using (has_role((select auth.uid()), 'gestor'::app_role)
  or lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail.com')
with check (has_role((select auth.uid()), 'gestor'::app_role)
  or lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail.com');
