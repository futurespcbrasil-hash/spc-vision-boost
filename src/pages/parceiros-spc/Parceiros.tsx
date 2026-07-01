import { useEffect, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Handshake } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n: number) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TIPOS = [
  { value: 'contabilidade', label: 'Contabilidade' },
  { value: 'software', label: 'Empresa de Software' },
  { value: 'certificadora', label: 'Certificadora' },
  { value: 'consultoria', label: 'Consultoria' },
  { value: 'outro', label: 'Outro' },
];

const emptyForm = {
  razao_social: '', nome_fantasia: '', cnpj: '', responsavel: '',
  whatsapp: '', email: '', cidade: '', endereco: '', observacoes: '',
  tipo_parceiro: 'outro', percentual_comissao: 0, status: 'ativo',
};

const Parceiros = () => {
  const { user } = useAuth();
  const [parceiros, setParceiros] = useState<any[]>([]);
  const [indicados, setIndicados] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const load = async () => {
    setLoading(true);
    const [p, c, v] = await Promise.all([
      supabase.from('parceiros_spc').select('*').order('created_at', { ascending: false }),
      supabase.from('clientes_indicados').select('id, parceiro_id'),
      supabase.from('vendas_indicadas').select('cliente_indicado_id, valor'),
    ]);
    setParceiros(p.data ?? []);
    setIndicados(c.data ?? []);
    setVendas(v.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p: any) => { setEditing(p); setForm({ ...p }); setOpen(true); };

  const save = async () => {
    if (!form.razao_social?.trim()) { toast.error('Razão Social é obrigatória'); return; }
    if (!user) return;
    const payload = { ...form, percentual_comissao: Number(form.percentual_comissao || 0), user_id: user.id };
    const { error } = editing
      ? await supabase.from('parceiros_spc').update(payload).eq('id', editing.id)
      : await supabase.from('parceiros_spc').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? 'Parceiro atualizado' : 'Parceiro cadastrado');
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este parceiro? Todos os clientes indicados serão removidos.')) return;
    const { error } = await supabase.from('parceiros_spc').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Parceiro removido');
    load();
  };

  const totalsByParceiro = (id: string) => {
    const arr = indicados.filter((i) => i.parceiro_id === id);
    return { qtd: arr.length, valor: arr.reduce((s, i) => s + Number(i.valor_venda || 0), 0) };
  };

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Handshake className="text-primary" /> Parceiros</h1>
          <p className="text-muted-foreground text-sm">Empresas que indicam clientes para a Future Soluções</p>
        </div>
      </div>

      <Card className="p-4 md:p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Indicados</TableHead>
                <TableHead className="text-right">Valor Gerado</TableHead>
                <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : parceiros.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum parceiro cadastrado</TableCell></TableRow>
              ) : parceiros.map((p) => {
                const t = totalsByParceiro(p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome_fantasia || p.razao_social}</TableCell>
                    <TableCell>{p.responsavel || '-'}</TableCell>
                    <TableCell>{p.cidade || '-'}</TableCell>
                    <TableCell>{p.whatsapp || '-'}</TableCell>
                    <TableCell className="text-right">{t.qtd}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(t.valor)}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'ativo' ? 'default' : 'secondary'}>{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)} className="mr-1 h-8">
                        <Pencil size={14} className="mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p.id)} className="h-8 text-destructive hover:text-destructive">
                        <Trash2 size={14} className="mr-1" /> Excluir
                      </Button>
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
        title="Novo Parceiro"
      >
        <Plus size={26} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Parceiro' : 'Novo Parceiro'}</DialogTitle>
          </DialogHeader>
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
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp ?? ''} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={form.cidade ?? ''} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Endereço</Label>
              <Input value={form.endereco ?? ''} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </div>
            <div>
              <Label>Tipo de Parceiro</Label>
              <Select value={form.tipo_parceiro} onValueChange={(v) => setForm({ ...form, tipo_parceiro: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Percentual de Comissão (%)</Label>
              <Input type="number" step="0.01" value={form.percentual_comissao}
                onChange={(e) => setForm({ ...form, percentual_comissao: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
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

export default Parceiros;
