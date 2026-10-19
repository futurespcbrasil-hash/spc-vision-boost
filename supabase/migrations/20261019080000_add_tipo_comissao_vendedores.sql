alter table public.vendedores_comissoes add column if not exists tipo_comissao text not null default 'percentual';

alter table public.vendedores_comissoes drop constraint if exists vendedores_comissoes_tipo_comissao_check;
alter table public.vendedores_comissoes add constraint vendedores_comissoes_tipo_comissao_check check (tipo_comissao in ('percentual', 'fixo', 'custo'));
