import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, FileSpreadsheet, Loader2, Pencil, Plus, Search, Trash2, Upload, Users, Download } from 'lucide-react';
import { toast } from 'sonner';

type Indicacao = {
  id: string; user_id: string; nome: string; razao_social: string | null; cnpj: string | null;
  responsavel: string | null; telefone: string | null; email: string | null; cidade: string | null;
  observacoes: string | null; created_at: string;
};
type FormData = {
  nome: string; razao_social: string; cnpj: string; responsavel: string;
  telefone: string; email: string; cidade: string; observacoes: string;
};
const emptyForm: FormData = { nome: '', razao_social: '', cnpj: '', responsavel: '', telefone: '', email: '', cidade: '', observacoes: '' };
const normalizeCnpj = (value: unknown) => String(value ?? '').replace(/\D/g, '');
const normalizeHeader = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const fmtDate = (value: string) => value ? new Date(value).toLocaleDateString('pt-BR') : '—';
const columnAliases: Record<keyof FormData, string[]> = {
  nome: ['nome', 'nomefantasia', 'nomecomercial', 'cliente'],
  razao_social: ['razaosocial', 'razaosocialempresa'],
  cnpj: ['cnpj', 'documento'],
  responsavel: ['responsavel', 'nomedoresponsavel', 'contato'],
  telefone: ['telefone', 'fone', 'celular', 'whatsapp'],
  email: ['email'],
  cidade: ['cidade', 'municipio'],
  observacoes: ['obs', 'observacao', 'observacoes', 'comentario'],
};

const ClientesIndicadosAtendimento = () => {
  const { user, role, canManageUsers } = useAuth();
  const [rows, setRows] = useState<Indicacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Indicacao | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any).from('atendimento_indicacoes')
      .select('id,user_id,nome,razao_social,cnpj,responsavel,telefone,email,cidade,observacoes,created_at')
      .order('created_at', { ascending: false });

    // Usuários comuns, incluindo dalprapf1, visualizam somente os próprios cadastros.
    // Apenas o perfil gestor mantém a visão consolidada de todas as indicações.
    if (user && role !== 'gestor') query = query.eq('user_id', user.id);
    const { data, error } = await query;
    if (error) {
      toast.error('Não foi possível carregar as indicações: ' + error.message);
      setRows([]);
    } else setRows((data ?? []) as Indicacao[]);
    setLoading(false);
  }, [user?.id, role]);
  useEffect(() => { void load(); }, [load]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return rows;
    return rows.filter((row) => [row.nome, row.razao_social, row.cnpj, row.responsavel, row.telefone, row.email, row.cidade]
      .some((value) => String(value ?? '').toLocaleLowerCase('pt-BR').includes(term)));
  }, [rows, search]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (row: Indicacao) => {
    setEditing(row);
    setForm({
      nome: row.nome ?? '', razao_social: row.razao_social ?? '', cnpj: row.cnpj ?? '',
      responsavel: row.responsavel ?? '', telefone: row.telefone ?? '', email: row.email ?? '',
      cidade: row.cidade ?? '', observacoes: row.observacoes ?? '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.nome.trim()) { toast.error('Informe o nome do cliente.'); return; }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { toast.error('Informe um e-mail válido.'); return; }
    const cnpj = normalizeCnpj(form.cnpj);
    if (cnpj && cnpj.length !== 14) { toast.error('O CNPJ deve conter 14 dígitos.'); return; }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(), razao_social: form.razao_social.trim() || null, cnpj: cnpj || null,
      responsavel: form.responsavel.trim() || null, telefone: form.telefone.trim() || null,
      email: form.email.trim() || null, cidade: form.cidade.trim() || null,
      observacoes: form.observacoes.trim() || null, updated_at: new Date().toISOString(),
    };
    const table = (supabase as any).from('atendimento_indicacoes');
    const result = editing ? await table.update(payload).eq('id', editing.id) : await table.insert({ ...payload, user_id: user.id });
    setSaving(false);
    if (result.error) {
      toast.error(result.error.code === '23505' ? 'Já existe uma indicação cadastrada com este CNPJ.' : 'Não foi possível salvar: ' + result.error.message);
      return;
    }
    toast.success(editing ? 'Indicação atualizada.' : 'Cliente indicado cadastrado.');
    setDialogOpen(false);
    await load();
  };

  const remove = async (row: Indicacao) => {
    if (!window.confirm(`Deseja excluir a indicação de "${row.nome}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await (supabase as any).from('atendimento_indicacoes').delete().eq('id', row.id);
    if (error) { toast.error('Não foi possível excluir: ' + error.message); return; }
    toast.success('Indicação excluída.');
    await load();
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Nome', 'Razão Social', 'CNPJ', 'Nome do Responsável', 'Telefone', 'E-mail', 'Cidade', 'Observações'],
      ['Exemplo Cliente', 'Exemplo Comércio Ltda', '00000000000000', 'Maria da Silva', '(54) 99999-9999', 'contato@exemplo.com.br', 'Passo Fundo', 'Cliente indicado pelo atendimento'],
    ]);
    worksheet['!cols'] = [{ wch: 24 }, { wch: 30 }, { wch: 18 }, { wch: 24 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 38 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes indicados');
    XLSX.writeFile(workbook, 'modelo_clientes_indicados_atendimento.xlsx');
  };

  const importFile = async (file?: File) => {
    if (!file || !user) return;
    setImporting(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (!rawRows.length) { toast.error('A planilha está vazia ou não contém linhas de dados.'); return; }
      const existingCnpjs = new Set(rows.map((row) => normalizeCnpj(row.cnpj)).filter(Boolean));
      const incomingCnpjs = new Set<string>();
      const toInsert: Record<string, unknown>[] = [];
      let skipped = 0, invalid = 0;
      for (const raw of rawRows) {
        const normalized = Object.fromEntries(Object.entries(raw).map(([key, value]) => [normalizeHeader(key), value]));
        const record = {} as Record<keyof FormData, string>;
        (Object.keys(columnAliases) as (keyof FormData)[]).forEach((field) => {
          const alias = columnAliases[field].find((item) => Object.prototype.hasOwnProperty.call(normalized, normalizeHeader(item)));
          record[field] = alias ? String(normalized[normalizeHeader(alias)] ?? '').trim() : '';
        });
        const nome = record.nome || record.razao_social;
        if (!nome) { invalid++; continue; }
        const cnpj = normalizeCnpj(record.cnpj);
        if (cnpj && cnpj.length !== 14) { invalid++; continue; }
        if (cnpj && (existingCnpjs.has(cnpj) || incomingCnpjs.has(cnpj))) { skipped++; continue; }
        if (cnpj) incomingCnpjs.add(cnpj);
        toInsert.push({
          user_id: user.id, nome, razao_social: record.razao_social || null, cnpj: cnpj || null,
          responsavel: record.responsavel || null, telefone: record.telefone || null,
          email: record.email || null, cidade: record.cidade || null, observacoes: record.observacoes || null,
        });
      }
      if (!toInsert.length) { toast.warning(`Nenhum registro novo para importar. Ignorados: ${skipped}; inválidos: ${invalid}.`); return; }
      let inserted = 0;
      let duplicateSkipped = 0;
      const errors: string[] = [];
      for (let i = 0; i < toInsert.length; i += 100) {
        const batch = toInsert.slice(i, i + 100);
        const { error } = await (supabase as any).from('atendimento_indicacoes').insert(batch);
        if (!error) {
          inserted += batch.length;
          continue;
        }
        // A duplicate CNPJ under another Atendimento user must not discard valid rows.
        if (error.code === '23505') {
          for (const item of batch) {
            const { error: rowError } = await (supabase as any).from('atendimento_indicacoes').insert(item);
            if (!rowError) inserted++;
            else if (rowError.code === '23505') duplicateSkipped++;
            else errors.push(rowError.message);
          }
        } else errors.push(error.message);
      }
      await load();
      if (errors.length) toast.error(`Importação parcial: ${inserted} inseridos, ${skipped + duplicateSkipped} duplicados ignorados. Erro: ${errors[0]}`);
      else toast.success(`Importação concluída: ${inserted} inseridos, ${skipped + duplicateSkipped} duplicados ignorados e ${invalid} linhas inválidas.`);
    } catch {
      toast.error('Falha ao ler a planilha. Use um arquivo Excel (.xlsx/.xls) válido.');
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  if (role !== 'atendimento' && !canManageUsers) return (
    <div className="p-6"><Card><CardContent className="py-10 text-center">
      <h1 className="text-lg font-semibold">Acesso restrito</h1>
      <p className="mt-2 text-sm text-muted-foreground">Este módulo é destinado ao perfil Atendimento.</p>
    </CardContent></Card></div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Clientes Indicados</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cadastre os clientes que você indicou para o Sistema de Notas.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" />Modelo Excel</Button>
          <Button variant="outline" disabled={importing} onClick={() => fileInput.current?.click()}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Importar Excel
          </Button>
          <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])} />
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Cliente Indicado</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-3 text-primary"><Users className="h-5 w-5" /></div>
          <div><p className="text-sm text-muted-foreground">Total de indicações</p><p className="text-2xl font-bold">{rows.length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-3 text-primary"><Building2 className="h-5 w-5" /></div>
          <div><p className="text-sm text-muted-foreground">Com CNPJ informado</p><p className="text-2xl font-bold">{rows.filter((row) => row.cnpj).length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-3 text-primary"><FileSpreadsheet className="h-5 w-5" /></div>
          <div><p className="text-sm text-muted-foreground">Cadastrados neste mês</p><p className="text-2xl font-bold">{rows.filter((row) => row.created_at?.slice(0, 7) === new Date().toISOString().slice(0, 7)).length}</p></div></CardContent></Card>
      </div>

      <Card><CardHeader className="pb-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg">Lista de clientes indicados</CardTitle>
        <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, CNPJ, cidade..." className="pl-9" /></div>
      </div></CardHeader><CardContent>
        {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          : filteredRows.length === 0 ? <div className="flex flex-col items-center py-12 text-center"><Building2 className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">{search ? 'Nenhum resultado encontrado' : 'Nenhum cliente indicado cadastrado'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{search ? 'Tente buscar por outro termo.' : 'Use “Novo Cliente Indicado” ou importe uma planilha Excel para começar.'}</p></div>
          : <div className="overflow-x-auto"><Table><TableHeader><TableRow>
            <TableHead>Nome / Razão Social</TableHead><TableHead>CNPJ</TableHead><TableHead>Responsável</TableHead><TableHead>Telefone / E-mail</TableHead><TableHead>Cidade</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader><TableBody>{filteredRows.map((row) => <TableRow key={row.id}>
            <TableCell><div className="font-medium">{row.nome}</div><div className="text-xs text-muted-foreground">{row.razao_social || '—'}</div></TableCell>
            <TableCell className="whitespace-nowrap">{row.cnpj || '—'}</TableCell><TableCell>{row.responsavel || '—'}</TableCell>
            <TableCell><div>{row.telefone || '—'}</div><div className="text-xs text-muted-foreground">{row.email || ''}</div></TableCell>
            <TableCell>{row.cidade || '—'}</TableCell><TableCell className="whitespace-nowrap">{fmtDate(row.created_at?.slice(0, 10))}</TableCell>
            <TableCell><div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" aria-label="Editar indicação" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" aria-label="Excluir indicação" onClick={() => void remove(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div></TableCell>
          </TableRow>)}</TableBody></Table></div>}
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? 'Editar cliente indicado' : 'Novo cliente indicado'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="indicacao-nome">Nome *</Label><Input id="indicacao-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome comercial do cliente" /></div>
          <div className="space-y-2"><Label htmlFor="indicacao-razao">Razão Social</Label><Input id="indicacao-razao" value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} placeholder="Razão social" /></div>
          <div className="space-y-2"><Label htmlFor="indicacao-cnpj">CNPJ</Label><Input id="indicacao-cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="CNPJ" maxLength={18} /></div>
          <div className="space-y-2"><Label htmlFor="indicacao-responsavel">Nome do responsável</Label><Input id="indicacao-responsavel" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} placeholder="Nome do contato" /></div>
          <div className="space-y-2"><Label htmlFor="indicacao-telefone">Telefone</Label><Input id="indicacao-telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" /></div>
          <div className="space-y-2"><Label htmlFor="indicacao-email">E-mail</Label><Input id="indicacao-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@empresa.com.br" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="indicacao-cidade">Cidade</Label><Input id="indicacao-cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Cidade/UF" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="indicacao-observacoes">Observações</Label><Textarea id="indicacao-observacoes" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Informações adicionais sobre a indicação" rows={3} /></div>
        </div>
        <p className="text-xs text-muted-foreground">O usuário responsável e a data da indicação são registrados automaticamente.</p>
        <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? 'Salvar alterações' : 'Cadastrar cliente'}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
};
export default ClientesIndicadosAtendimento;
