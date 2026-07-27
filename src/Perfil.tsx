import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { User, Lock, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const Perfil = () => {
  const { profile, role, user } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('user_id', user!.id);
    setSavingName(false);
    if (error) {
      toast.error('Erro ao atualizar nome');
    } else {
      toast.success('Nome atualizado com sucesso!');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast.error('Erro ao redefinir senha: ' + error.message);
    } else {
      toast.success('Senha redefinida com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas informações pessoais</p>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <User size={24} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate">{profile?.display_name || 'Usuário'}</div>
          <div className="text-sm text-muted-foreground truncate">{profile?.email || user?.email}</div>
        </div>
        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium capitalize">{role}</span>
      </div>

      {/* Edit name */}
      <form onSubmit={handleUpdateName} className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <User size={18} /> Editar Nome
        </h2>
        <input
          className={inputClass}
          placeholder="Nome completo"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={savingName}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition disabled:opacity-50"
        >
          {savingName ? (
            <span className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
          ) : (
            <Save size={16} />
          )}
          Salvar nome
        </button>
      </form>

      {/* Change password */}
      <form onSubmit={handleUpdatePassword} className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Lock size={18} /> Redefinir Senha
        </h2>
        <input
          className={inputClass}
          type="password"
          placeholder="Nova senha"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          required
          minLength={6}
        />
        <input
          className={inputClass}
          type="password"
          placeholder="Confirmar nova senha"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
          minLength={6}
        />
        <button
          type="submit"
          disabled={savingPassword}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition disabled:opacity-50"
        >
          {savingPassword ? (
            <span className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
          ) : (
            <Lock size={16} />
          )}
          Redefinir senha
        </button>
      </form>
    </div>
  );
};

export default Perfil;
