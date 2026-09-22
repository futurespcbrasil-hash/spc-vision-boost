import { useEffect, useState } from 'react';
import { Building2, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Revenda = {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

const Revendas = () => {
  const [revendas, setRevendas] = useState<Revenda[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('accounts')
      .select('id, name, document, email, phone, status')
      .eq('account_type', 'revenda')
      .order('name');
    setRevendas((data as Revenda[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Revendas</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastre e acompanhe as revendas da Future Soluções.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted transition">
            <RefreshCw size={16} /> Atualizar
          </button>
          <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition">
            <Plus size={16} /> Nova Revenda
          </button>
        </div>
      </div>

      <div className="stat-card">
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : revendas.length === 0 ? (
          <div className="text-center py-12">
            <Building2 size={40} className="mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold text-foreground">Nenhuma revenda cadastrada</h3>
            <p className="text-sm text-muted-foreground mt-1">Use “Nova Revenda” para iniciar o cadastro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left py-3">Revenda</th><th className="text-left py-3">CNPJ/CPF</th>
                <th className="text-left py-3">E-mail</th><th className="text-left py-3">Telefone</th><th className="text-left py-3">Status</th>
              </tr></thead>
              <tbody>{revendas.map(r => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-3 font-medium">{r.name}</td><td className="py-3">{r.document || '-'}</td>
                  <td className="py-3">{r.email || '-'}</td><td className="py-3">{r.phone || '-'}</td>
                  <td className="py-3 capitalize">{r.status}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Revendas;
