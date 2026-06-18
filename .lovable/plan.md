## Módulo "Parceiros SPC"

Novo módulo independente (sem funil/pipeline) para gestão de parceiros indicadores e clientes já convertidos.

### 1. Banco de Dados (migração Lovable Cloud)

Criar duas tabelas em `public`:

**`parceiros_spc`**
- razao_social, nome_fantasia, cnpj, responsavel
- whatsapp, email, cidade, endereco, observacoes
- tipo_parceiro (enum: contabilidade, software, certificadora, consultoria, outro)
- percentual_comissao (numeric)
- status (ativo/inativo)
- user_id (dono do cadastro)

**`clientes_indicados`**
- razao_social, nome_fantasia, cnpj, responsavel, telefone, whatsapp, email, cidade
- parceiro_id (FK → parceiros_spc)
- data_indicacao, produto_vendido, valor_venda, comissao_gerada, observacoes
- user_id

RLS por `user_id` para vendedor; gestor vê tudo via `has_role`. GRANTs para `authenticated` e `service_role`. Triggers de `updated_at`.

### 2. Navegação

- `src/components/AppSidebar.tsx`: adicionar item "Parceiros SPC" (ícone `Handshake`) com submenus expansíveis: Dashboard, Parceiros, Clientes Indicados, Relatórios.
- `src/components/MobileBottomNav.tsx`: adicionar entrada no menu "Ver mais".
- `src/App.tsx`: 4 novas rotas:
  - `/parceiros-spc` (dashboard)
  - `/parceiros-spc/parceiros`
  - `/parceiros-spc/clientes`
  - `/parceiros-spc/relatorios`

### 3. Páginas (em `src/pages/parceiros-spc/`)

**`Dashboard.tsx`** — 4 cards (Parceiros Ativos, Clientes Indicados, Valor Total, Comissões) + tabela Ranking de Parceiros (ordenada por valor gerado desc).

**`Parceiros.tsx`** — tabela (Empresa, Responsável, Cidade, Telefone, Total Indicados, Valor Gerado, Status) + FAB "Novo Parceiro" abrindo Dialog com formulário completo (validação zod).

**`ClientesIndicados.tsx`** — tabela (Cliente, CNPJ, Parceiro, Produto, Valor, Comissão, Data) + FAB "Novo Cliente Indicado" com Dialog. Select de Parceiro carregado da tabela. Select de Produto com opções fixas (SPC Brasil, SPC Maxi, Certificado Digital, Emissor de Notas, Consulta de Crédito, Cobrança, Outro). Cálculo automático da comissão sugerida a partir do `percentual_comissao` do parceiro.

**`Relatorios.tsx`** — filtros (período, parceiro, produto) + indicadores agregados + botões Exportar PDF (jsPDF+autoTable) e Excel (xlsx — já no projeto).

### 4. Padrão visual

- Cards e tabelas idênticos ao Dashboard atual (roxo primário, `Card`/`Table` do shadcn).
- FAB roxo flutuante para ação primária (memória de design).
- Ícones Lucide: `Handshake`, `Building2`, `Users`, `DollarSign`, `TrendingUp`.
- Responsivo: tabelas com `overflow-auto`, grid de cards `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`.

### Observações técnicas

- Sem funil/pipeline/kanban — somente CRUD + dashboards.
- RBAC: vendedor vê só os próprios; gestor vê tudo (via `has_role(auth.uid(),'gestor')`).
- Reaproveitar `supabase` client e padrões dos módulos atuais (Leads, Metas).
