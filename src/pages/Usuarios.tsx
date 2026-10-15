import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, RefreshCw, Save, ShieldCheck, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DEFAULT_MODULES_BY_ROLE, USER_MODULES, type UserModuleKey } from '@/lib/userModules';

type UserRole = 'vendedor' | 'gestor' | 'atendimento';
type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at?: string;
  permissions: { module_key: string; can_access: boolean }[];
};

const roleLabels: Record<UserRole, string> = {
  vendedor: 'Vendedor',
  gestor: 'Gestor',
  atendimento: 'Atendimento',
};

const UsersPage = () => {
  const { user, canManageUsers } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [selectedModules, setSelectedModules] = useState<UserModuleKey[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('vendedor');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('user-admin', { body: { action: 'list' } });
    if (error) {
      toast.error(data?.error || error.message || 'Não foi possível carregar usuários.');
      setLoading(false);
      return;
    }
    setUsers((data?.users || []) as ManagedUser[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (canManageUsers) void loadUsers(); }, [canManageUsers, loadUsers]);

  const toggleModule = (key: UserModuleKey) => {
    setSelectedModules((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  };

  const startPermissions = (managedUser: ManagedUser) => {
    setEditingUser(managedUser);
    const saved = managedUser.permissions.filter((item) => item.can_access).map((item) => item.module_key as UserModuleKey);
    setSelectedModules(managedUser.permissions.length ? saved : DEFAULT_MODULES_BY_ROLE[managedUser.role]);
  };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const modules = DEFAULT_MODULES_BY_ROLE[newRole];
    const { data, error } = await supabase.functions.invoke('user-admin', {
      body: { action: 'create', name: name.trim(), email: email.trim().toLowerCase(), password, role: newRole, modules },
    });
    setSaving(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Não foi possível criar o usuário.');
      return;
    }
    toast.success('Usuário criado. Ele já pode entrar com e-mail e senha.');
    setName('');
    setEmail('');
    setPassword('');
    setNewRole('vendedor');
    setShowForm(false);
    await loadUsers();
  };

  const savePermissions = async () => {
    if (!editingUser) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('user-admin', {
      body: { action: 'permissions', user_id: editingUser.id, modules: selectedModules },
    });
    setSaving(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Não foi possível salvar as permissões.');
      return;
    }
    toast.success('Permissões atualizadas.');
    setEditingUser(null);
    await loadUsers();
  };


  if (!canManageUsers) {
    return <div className="p-8 text-center"><ShieldCheck className="mx-auto mb-3" /><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="text-muted-foreground mt-2">Somente o responsável principal ou um gestor pode administrar usuários.</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><Users className="text-primary" size={25} /><h1 className="text-2xl font-bold">Usuários</h1></div>
          <p className="text-sm text-muted-foreground mt-1">Crie acessos e defina os módulos permitidos para cada pessoa.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void loadUsers()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted" disabled={loading}><RefreshCw size={16} /> Atualizar</button>
          <button onClick={() => { setShowForm((value) => !value); setEditingUser(null); }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"><Plus size={17} /> Novo usuário</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={createUser} className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-lg">Novo usuário</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm"><span>Nome</span><input className="w-full rounded-lg border bg-background px-3 py-2.5" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
            <label className="space-y-1 text-sm"><span>E-mail</span><input className="w-full rounded-lg border bg-background px-3 py-2.5" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
            <label className="space-y-1 text-sm"><span>Senha inicial</span><input className="w-full rounded-lg border bg-background px-3 py-2.5" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required /><span className="text-xs text-muted-foreground">Mínimo de 6 caracteres.</span></label>
            <label className="space-y-1 text-sm"><span>Tipo de usuário</span><select className="w-full rounded-lg border bg-background px-3 py-2.5" value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}><option value="vendedor">Vendedor</option>{user?.email?.toLowerCase() === 'dalprapf1@gmail.com' && <option value="gestor">Gestor</option>}<option value="atendimento">Atendimento</option></select></label>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Criar acesso</button>
          </div>
        </form>
      )}

      {editingUser && (
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="font-semibold text-lg">Permissões de módulos</h2><p className="text-sm text-muted-foreground">{editingUser.name} · {editingUser.email} · {roleLabels[editingUser.role]}</p></div>
            <button onClick={() => setEditingUser(null)} className="rounded-lg p-2 hover:bg-muted" aria-label="Fechar"><X size={18} /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedModules(USER_MODULES.map((item) => item.key))} className="rounded-lg border px-3 py-1.5 text-sm">Selecionar todos</button>
            <button type="button" onClick={() => setSelectedModules(['dashboard', 'perfil'])} className="rounded-lg border px-3 py-1.5 text-sm">Somente básico</button>
            <span className="self-center text-xs text-muted-foreground">{selectedModules.length} de {USER_MODULES.length} módulos selecionados</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {USER_MODULES.map((module) => (
              <label key={module.key} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
                <input type="checkbox" className="mt-1 accent-primary" checked={selectedModules.includes(module.key)} onChange={() => toggleModule(module.key)} />
                <span><span className="block text-sm font-medium">{module.label}</span><span className="block text-xs text-muted-foreground">{module.description}</span></span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditingUser(null)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
            <button onClick={() => void savePermissions()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar permissões</button>
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b px-5 py-4"><h2 className="font-semibold">Contas cadastradas</h2><p className="text-xs text-muted-foreground mt-1">O acesso fica ativo imediatamente, sem confirmação de e-mail.</p></div>
        {loading ? <div className="p-10 text-center text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={18} />Carregando usuários...</div> : users.length === 0 ? <div className="p-10 text-center text-muted-foreground">Nenhum usuário encontrado.</div> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-left"><tr><th className="px-4 py-3 font-medium">Nome</th><th className="px-4 py-3 font-medium">E-mail</th><th className="px-4 py-3 font-medium">Tipo</th><th className="px-4 py-3 font-medium">Módulos</th><th className="px-4 py-3 font-medium">Ação</th></tr></thead><tbody className="divide-y">{users.map((managedUser) => {
            const allowed = managedUser.permissions.filter((item) => item.can_access).length;
            return <tr key={managedUser.id} className="hover:bg-muted/20"><td className="px-4 py-3 font-medium">{managedUser.name || '—'}{managedUser.id === user?.id && <span className="ml-2 text-xs text-primary">(você)</span>}</td><td className="px-4 py-3">{managedUser.email}</td><td className="px-4 py-3">{roleLabels[managedUser.role] || managedUser.role}</td><td className="px-4 py-3">{managedUser.permissions.length ? `${allowed}/${USER_MODULES.length}` : 'Padrão do perfil'}</td><td className="px-4 py-3"><button onClick={() => startPermissions(managedUser)} disabled={managedUser.role === 'gestor' && user?.email?.toLowerCase() !== 'dalprapf1@gmail.com'} title={managedUser.role === 'gestor' && user?.email?.toLowerCase() !== 'dalprapf1@gmail.com' ? 'Somente o responsável principal pode alterar outro gestor.' : undefined} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"><ShieldCheck size={14} /> Permissões</button></td></tr>;
          })}</tbody></table></div>
        )}
      </section>
      <p className="text-xs text-muted-foreground">Nota de segurança: usuários Gestores podem administrar acessos; somente o responsável principal pode conceder o perfil Gestor a outra conta.</p>
    </div>
  );
};

export default UsersPage;
