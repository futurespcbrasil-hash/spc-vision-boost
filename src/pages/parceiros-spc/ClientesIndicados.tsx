import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Building2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n: number) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-';

const PRODUTOS = ['SPC Brasil', 'SPC Maxi', 'Certificado Digital', 'Emissor de Notas', 'Consulta de Crédito', 'Cobrança', 'Outro'];

const emptyForm = {
  parceiro_id: '', razao_social: '', nome_fantasia: '', cnpj: '', responsavel: '',
  telefone: '', whatsapp: '', email: '', cidade: '',
  data_indicacao: new Date().toISOString().slice(0, 10),
  produto_vendido: 'SPC Brasil', valor_venda: 0, comissao_gerada: 0, observacoes: '',
};

const ClientesIndicados = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [parceiros, setParceiros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const load = async () => {
    setLoading(true);
    const [c, p] = await Promise.all([
      supabase.from('clientes_indicados').select('*').order('data_indicacao', { ascending: false }),
      supabase.from('parceiros_spc').select('id, razao_social, nome_fantasia, percentual_comissao'),
    ]);
    setRows(c.data ?? []);
    setParceiros(p.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const parceiroMap = useMemo(() => Object.fromEntries(parceiros.map((p) => [p.id, p])), [parceiros]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (r: any) => { setEditing(r); setForm({ ...r }); setOpen(true); };

  const onParceiroChange = (id: string) => {
    const p = parceiroMap[id];
    const valor = Number(form.valor_venda || 0);
    const comissao = p ? +(valor * Number(p.percentual_comissao || 0) / 100).toFixed(2) : form.comissao_gerada;
    setForm({ ...form, parceiro_id: id, comissao_gerada: comissao });
  };

  const onValorChange = (v: string) => {
    const valor = Number(v || 0);
    const p = parceiroMap[form.parceiro_id];
    const comissao = p ? +(valor * Number(p.percentual_comissao || 0) / 100).toFixed(2) : Number(form.comissao_gerada || 0);
    setForm({ ...form, valor_venda: valor, comissao_gerada: comissao });
  };

  const save = async () => {
    if (!form.parceiro_id) { toast.error('Selecione um parceiro'); return; }
    if (!form.razao_social?.trim()) { toast.error('Razão Social é obrigatória'); return; }
    if (!user) return;
    const payload = {
      ...form,
      valor_venda: Number(form.valor_venda || 0),
      comissao_gerada: Number(form.comissao_gerada || 0),
      user_id: user.id,
    };
    const { error } = editing
      ? await supabase.from('clientes_indicados').update(payload).eq('id', editing.id)
      : await supabase.from('clientes_indicados').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? 'Indicação atualizada' : 'Cliente indicado cadastrado');
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta indicação?')) return;
    const { error } = await supabase.from('clientes_indicados').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Indicação removida');
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="text-primary" /> Clientes Indicados</h1>
        <p className="text-muted-foreground text-sm">Clientes já fechados indicados pelos parceiros</p>
      </div>

      <Card className="p-4 md:p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Parceiro</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>Data</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum cliente indicado</TableCell></TableRow>
              ) : rows.map((r) => {
                const p = parceiroMap[r.parceiro_id];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nome_fantasia || r.razao_social}</TableCell>
                    <TableCell>{r.cnpj || '-'}</TableCell>
                    <TableCell>{p ? (p.nome_fantasia || p.razao_social) : '-'}</TableCell>
                    <TableCell>{r.produto_vendido || '-'}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(r.valor_venda))}</TableCell>
                    <TableCell className="text-right text-green-600">{fmt(Number(r.comissao_gerada))}</TableCell>
                    <TableCell>{fmtDate(r.data_indicacao)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil size={14} /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 size={14} className="text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <button
        onClick={openNew}
        className="fixed bottom-20 md:bottom-6 right-6 z-30 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-14 w-14 shadow-lg flex items-center justify-center transition"
        title="Novo Cliente Indicado"
      >
        <Plus size={26} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Indicação' : 'Novo Cliente Indicado'}</DialogTitle>
          </DialogHeader>

          <h3 className="font-semibold text-sm text-muted-foreground mt-2">Dados do Cliente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Razão Social *</Label>
              <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
            </div>
            <div>
              <Label>Nome Fantasia</Label>
              <Input value={form.nome_fantasia ?? ''} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj ?? ''} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={form.responsavel ?? ''} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone ?? ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp ?? ''} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Cidade</Label>
              <Input value={form.cidade ?? ''} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </div>
          </div>

          <h3 className="font-semibold text-sm text-muted-foreground mt-4">Dados da Indicação</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Parceiro *</Label>
              <Select value={form.parceiro_id} onValueChange={onParceiroChange}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {parceiros.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome_fantasia || p.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data da Indicação</Label>
              <Input type="date" value={form.data_indicacao}
                onChange={(e) => setForm({ ...form, data_indicacao: e.target.value })} />
            </div>
            <div>
              <Label>Produto Vendido</Label>
              <Select value={form.produto_vendido} onValueChange={(v) => setForm({ ...form, produto_vendido: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRODUTOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor da Venda (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_venda}
                onChange={(e) => onValorChange(e.target.value)} />
            </div>
            <div>
              <Label>Comissão Gerada (R$)</Label>
              <Input type="number" step="0.01" value={form.comissao_gerada}
                onChange={(e) => setForm({ ...form, comissao_gerada: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea rows={3} value={form.observacoes ?? ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? 'Salvar' : 'Cadastrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientesIndicados;
