import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LogIn, UserPlus, Mail, Lock, User } from 'lucide-react';
import logoFuture from '@/assets/logo-future.png';

const Auth = () => {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'vendedor' | 'gestor'>('vendedor');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isLogin) {
      const { error: err } = await signIn(email, password);
      if (err) setError(err.message);
    } else {
      if (!name.trim()) { setError('Preencha o nome'); setLoading(false); return; }
      const { error: err } = await signUp(email, password, name, role);
      if (err) setError(err.message);
    }
    setLoading(false);
  };

  const inputClass = "w-full px-4 py-3 pl-11 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logoFuture} alt="Future Soluções" className="h-16 w-auto mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-foreground">
            {isLogin ? 'Bem-vindo de volta 👋' : 'Criar conta no sistema'}
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            {isLogin
              ? 'Acesse seu painel e acompanhe suas vendas em tempo real'
              : 'Leva menos de 1 minuto 🚀'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className={inputClass}
                placeholder="Nome completo"
                value={name}
                onChange={e => setName(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}

          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className={inputClass}
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className={inputClass}
              type="password"
              placeholder="Senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tipo de acesso:</label>
              <div className="flex gap-3">
                <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition ${role === 'vendedor' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'}`}>
                  <input type="radio" name="role" value="vendedor" checked={role === 'vendedor'} onChange={() => setRole('vendedor')} className="sr-only" />
                  <span className="text-sm font-medium">Vendedor</span>
                </label>
                <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition ${role === 'gestor' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'}`}>
                  <input type="radio" name="role" value="gestor" checked={role === 'gestor'} onChange={() => setRole('gestor')} className="sr-only" />
                  <span className="text-sm font-medium">Gestor</span>
                </label>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
            ) : isLogin ? (
              <><LogIn size={18} /> Entrar no sistema</>
            ) : (
              <><UserPlus size={18} /> Criar conta e acessar</>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {isLogin ? (
            <>Ainda não tem acesso?{' '}<button onClick={() => { setIsLogin(false); setError(''); }} className="text-primary font-medium hover:underline">Criar conta</button></>
          ) : (
            <>Já tem conta?{' '}<button onClick={() => { setIsLogin(true); setError(''); }} className="text-primary font-medium hover:underline">Entrar</button></>
          )}
        </p>
      </div>
    </div>
  );
};

export default Auth;
