import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Search, Edit2, Trash2, Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

interface Vendedor {
  id: string;
  nome: string;
  cidade: string | null;
  percentual_comissao: number;
  email: string | null;
  chave_pix: string | null;
  dados_bancarios: string | null;
}

const CadastroVendedores = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState<Vendedor | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    nome: '',
    cidade: '',
    percentual_comissao: 0,
    email: '',
    chave_pix: '',
    dados_bancarios: '',
  });

  const { data: vendedores, isLoading } = useQuery({
    queryKey: ['vendedores_comissoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedores_comissoes')
        .select('*')
        .order('nome');
      
      if (error) {
        toast.error('Erro ao carregar vendedores');
        throw error;
      }
      return data as Vendedor[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newVendedor: Omit<Vendedor, 'id'>) => {
      const { data, error } = await supabase
        .from('vendedores_comissoes')
        .insert([newVendedor])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores_comissoes'] });
      toast.success('Vendedor cadastrado com sucesso');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar vendedor: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (vendedor: Vendedor) => {
      const { data, error } = await supabase
        .from('vendedores_comissoes')
        .update({
          nome: vendedor.nome,
          cidade: vendedor.cidade,
          percentual_comissao: vendedor.percentual_comissao,
          email: vendedor.email,
          chave_pix: vendedor.chave_pix,
          dados_bancarios: vendedor.dados_bancarios,
        })
        .eq('id', vendedor.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores_comissoes'] });
      toast.success('Vendedor atualizado com sucesso');
      setIsDialogOpen(false);
      setEditingVendedor(null);
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao atualizar vendedor: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vendedores_comissoes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores_comissoes'] });
      toast.success('Vendedor excluído com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao excluir vendedor: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({ 
      nome: '', 
      cidade: '', 
      percentual_comissao: 0,
      email: '',
      chave_pix: '',
      dados_bancarios: '',
    });
    setEditingVendedor(null);
  };

  const handleEdit = (vendedor: Vendedor) => {
    setEditingVendedor(vendedor);
    setFormData({
      nome: vendedor.nome,
      cidade: vendedor.cidade || '',
      percentual_comissao: vendedor.percentual_comissao,
      email: vendedor.email || '',
      chave_pix: vendedor.chave_pix || '',
      dados_bancarios: vendedor.dados_bancarios || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVendedor) {
      updateMutation.mutate({ ...editingVendedor, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredVendedores = vendedores?.filter(v => 
    v.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.cidade?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="text-primary" size={24} />
          <h1 className="text-2xl font-bold text-foreground">Cadastro de Vendedores</h1>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition">
              <UserPlus size={18} />
              Cadastrar Vendedor
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingVendedor ? 'Editar Vendedor' : 'Novo Vendedor'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome do Vendedor</label>
                <input 
                  required
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  className="w-full p-2 rounded-md border border-input bg-background"
                  placeholder="Ex: João Silva"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full p-2 rounded-md border border-input bg-background"
                  placeholder="Ex: joao@email.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cidade</label>
                <input 
                  type="text"
                  value={formData.cidade}
                  onChange={(e) => setFormData({...formData, cidade: e.target.value})}
                  className="w-full p-2 rounded-md border border-input bg-background"
                  placeholder="Ex: Porto Alegre"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Comissão (%)</label>
                <input 
                  required
                  type="number"
                  step="0.01"
                  value={formData.percentual_comissao}
                  onChange={(e) => setFormData({...formData, percentual_comissao: parseFloat(e.target.value)})}
                  className="w-full p-2 rounded-md border border-input bg-background"
                  placeholder="Ex: 5.0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Chave PIX</label>
                <input 
                  type="text"
                  value={formData.chave_pix}
                  onChange={(e) => setFormData({...formData, chave_pix: e.target.value})}
                  className="w-full p-2 rounded-md border border-input bg-background"
                  placeholder="CPF, Email, Telefone..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Dados Bancários (Depósito)</label>
                <textarea 
                  value={formData.dados_bancarios}
                  onChange={(e) => setFormData({...formData, dados_bancarios: e.target.value})}
                  className="w-full p-2 rounded-md border border-input bg-background min-h-[80px]"
                  placeholder="Banco, Agência, Conta..."
                />
              </div>
              <DialogFooter>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Save size={18} />
                  )}
                  {editingVendedor ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
        <Search className="text-muted-foreground" size={20} />
        <input 
          type="text" 
          placeholder="Pesquisar por nome ou cidade..."
          className="bg-transparent border-none outline-none w-full text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-3">Nome / Email</th>
                <th className="px-6 py-3">Cidade</th>
                <th className="px-6 py-3">Comissão (%)</th>
                <th className="px-6 py-3">Pagamento</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-primary" size={32} />
                  </td>
                </tr>
              ) : filteredVendedores?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhum vendedor encontrado.
                  </td>
                </tr>
              ) : (
                filteredVendedores?.map((vendedor) => (
                  <tr key={vendedor.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium">{vendedor.nome}</div>
                      <div className="text-[10px] text-muted-foreground">{vendedor.email || 'Sem email'}</div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{vendedor.cidade || '-'}</td>
                    <td className="px-6 py-4">{vendedor.percentual_comissao}%</td>
                    <td className="px-6 py-4">
                      <div className="text-[10px] space-y-1">
                        {vendedor.chave_pix && (
                          <div className="flex flex-col">
                            <span className="font-bold text-primary">PIX:</span>
                            <span className="truncate max-w-[120px]">{vendedor.chave_pix}</span>
                          </div>
                        )}
                        {vendedor.dados_bancarios && (
                          <div className="flex flex-col">
                            <span className="font-bold text-primary">Banco:</span>
                            <span className="truncate max-w-[120px]">{vendedor.dados_bancarios}</span>
                          </div>
                        )}
                        {!vendedor.chave_pix && !vendedor.dados_bancarios && '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(vendedor)}
                          className="p-2 text-primary hover:bg-primary/10 rounded-full transition"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            if (window.confirm('Deseja realmente excluir este vendedor?')) {
                              deleteMutation.mutate(vendedor.id);
                            }
                          }}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-full transition"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CadastroVendedores;
