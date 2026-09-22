import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

type AppRole = 'vendedor' | 'gestor';
type AccountType = 'dono_app' | 'revenda' | 'parceiro' | 'usuario_final' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { display_name: string; email: string } | null;
  role: AppRole;
  accountType: AccountType;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, displayName: string, role: AppRole) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ display_name: string; email: string } | null>(null);
  const [role, setRole] = useState<AppRole>('vendedor');
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: p } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle();

      if (p) {
        setProfile({
          display_name: p.full_name || '',
          email: (await supabase.auth.getUser()).data.user?.email || '',
        });
      }

      const { data: membership } = await supabase
        .from('account_members')
        .select('role, account_id')
        .eq('user_id', userId)
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (membership) {
        setRole(membership.role === 'administrador' || membership.role === 'gestor' ? 'gestor' : 'vendedor');
        const { data: account } = await supabase
          .from('accounts')
          .select('account_type')
          .eq('id', membership.account_id)
          .maybeSingle();
        setAccountType((account?.account_type as AccountType) || null);
      } else {
        setAccountType(null);
      }
    } catch (e) {
      console.error('fetchProfile error', e);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => fetchProfile(sess.user.id), 0);
      } else {
        setProfile(null);
        setRole('vendedor');
        setAccountType(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchProfile(s.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, displayName: string, selectedRole: AppRole) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, role: selectedRole } },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, accountType, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
