import { useEffect, useState } from 'react';
import { Building2, Plus, RefreshCw, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Revenda = { id: string; name: string; document: string | null; email: string | null; phone: string | null; status: string; };
const emptyForm = { name: '', document: '', person_type: 'pj', email: '', phone: '', password: '' };

const Revendas = () => {
  const [revendas, setRevendas] = useState<Revenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('accounts').select('id, name, document, email, phone, status').eq('account_type', 'revenda').order('name');
    if (error) toast.error(error.message);
    setRevendas((data as Revenda[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updateField = (field: keyof typeof emptyForm, value: string) => setForm(current => ({ ...current, [field]: value }));

  const createRevenda = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.password.length < 6) return toast.error('A senha precisa ter pelo menos 6 caracteres.');
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('create-revenda', { body: form });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Não foi possível criar a revenda.');
      setSaving(false);
      return;
    }
    toast.success('Revenda criada e acesso liberado.');
    setForm(emptyForm);
    setOpen(false);
    setSaving(false);
    await load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-foreground">Revendas</h1><p className="text-sm text-muted-foreground mt-1">Cadastre a revenda e já entregue o acesso ao sistema.</p></div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted transition"><RefreshCw size={16} /> Atualizar</button>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"><Plus size={16} /> Nova Revenda</button>
        </div>
      </div>

      <div className="stat-card">
        {loading ? <div className="flex justify-center py-12"><span className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div> :
        revendas.length === 0 ? <div className="text-center py-12"><Building2 size={40} className="mx-auto text-muted-foreground mb-3" /><h3 className="font-semibold text-foreground">Nenhuma revenda cadastrada</h3><p className="text-sm text-muted-foreground mt-1">Clique em “Nova Revenda” para cadastrar a primeira.</p></div> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">
          <th className="text-left py-3">Revenda</th><th className="text-left py-3">CNPJ/CPF</th><th className="text-left py-3">E-mail de acesso</th><th className="text-left py-3">Telefone</th><th className="text-left py-3">Status</th>
        </tr></thead><tbody>{revendas.map(r => <tr key={r.id} className="border-b border-border/50"><td className="py-3 font-medium">{r.name}</td><td className="py-3">{r.document || '-'}</td><td className="py-3">{r.email || '-'}</td><td className="py-3">{r.phone || '-'}</td><td className="py-3 capitalize">{r.status}</td></tr>)}</tbody></table></div>}
      </div>

      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-2xl rounded-xl bg-background border border-border shadow-xl">
          <div className="flex items-center justify-between p-5 border-b border-border"><div><h2 className="text-lg font-semibold">Nova Revenda</h2><p className="text-sm text-muted-foreground mt-1">O e-mail e a senha informados serão o acesso da revenda.</p></div><button onClick={() => !saving && setOpen(false)} className="p-2 rounded-lg hover:bg-muted"><X size={18} /></button></div>
          <form onSubmit={createRevenda} className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1.5"><span className="text-sm font-medium">Nome / Razão Social *</span><input required value={form.name} onChange={e => updateField('name', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" placeholder="Nome da revenda" /></label>
              <label className="space-y-1.5"><span className="text-sm font-medium">CNPJ / CPF</span><input value={form.document} onChange={e => updateField('document', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" placeholder="00.000.000/0000-00" /></label>
              <label className="space-y-1.5"><span className="text-sm font-medium">Tipo</span><select value={form.person_type} onChange={e => updateField('person_type', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5"><option value="pj">Pessoa Jurídica</option><option value="pf">Pessoa Física</option></select></label>
              <label className="space-y-1.5"><span className="text-sm font-medium">Telefone</span><input value={form.phone} onChange={e => updateField('phone', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" placeholder="(54) 99999-9999" /></label>
              <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-medium">E-mail de acesso *</span><input required type="email" value={form.email} onChange={e => updateField('email', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" placeholder="revenda@empresa.com.br" /></label>
              <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-medium">Senha de acesso *</span><input required minLength={6} type="password" value={form.password} onChange={e => updateField('password', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" placeholder="Mínimo de 6 caracteres" /></label>
            </div>
            <div className="flex justify-end gap-2 pt-2"><button type="button" disabled={saving} onClick={() => setOpen(false)} className="px-4 py-2.5 rounded-lg border border-border hover:bg-muted">Cancelar</button><button type="submit" disabled={saving} className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">{saving ? 'Criando...' : 'Criar Revenda e Acesso'}</button></div>
          </form>
        </div>
      </div>}
    </div>
  );
};
export default Revendas;
