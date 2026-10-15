import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { USER_MODULES, DEFAULT_MODULES_BY_ROLE } from '@/lib/userModules';

export type AppRole = 'vendedor' | 'gestor' | 'atendimento';
type AccountType = 'dono_app' | 'revenda' | 'parceiro' | 'usuario_final' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { display_name: string; email: string } | null;
  role: AppRole;
  accountType: AccountType;
  loading: boolean;
  canManageUsers: boolean;
  modulePermissions: Record<string, boolean> | null;
  canAccessModule: (moduleKey: string) => boolean;
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

const OWNER_EMAIL = 'dalprapf1@gmail.com';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ display_name: string; email: string } | null>(null);
  const [role, setRole] = useState<AppRole>('vendedor');
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [modulePermissions, setModulePermissions] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const [{ data: p, error: profileError }, { data: roles, error: rolesError }, { data: permissions, error: permissionsError }] = await Promise.all([
        (supabase as any).from('profiles').select('display_name, email').eq('user_id', userId).maybeSingle(),
        (supabase as any).from('user_roles').select('role').eq('user_id', userId),
        (supabase as any).from('user_module_permissions').select('module_key, can_access').eq('user_id', userId),
      ]);

      if (profileError) throw profileError;
      if (rolesError) throw rolesError;
      if (permissionsError) throw permissionsError;

      const authUser = (await supabase.auth.getUser()).data.user;
      setProfile(p ? {
        display_name: p.display_name || '',
        email: p.email || authUser?.email || '',
      } : {
        display_name: String(authUser?.user_metadata?.display_name || ''),
        email: authUser?.email || '',
      });

      const roleRows = roles || [];
      const resolvedRole: AppRole = roleRows.some((item: { role: string }) => item.role === 'gestor')
        ? 'gestor'
        : roleRows.some((item: { role: string }) => item.role === 'atendimento')
          ? 'atendimento'
          : 'vendedor';
      setRole(resolvedRole);

      // Complete older/incomplete permission sets with role defaults. Explicit saved
      // false values remain false, while missing Gestor modules receive their defaults.
      const permissionRows = permissions || [];
      const savedPermissions = Object.fromEntries(
        permissionRows.map((item: { module_key: string; can_access: boolean }) => [item.module_key, item.can_access])
      ) as Record<string, boolean>;
      const completedPermissions = Object.fromEntries(
        USER_MODULES.map(({ key }) => [
          key,
          savedPermissions[key] ?? DEFAULT_MODULES_BY_ROLE[resolvedRole].includes(key),
        ])
      );
      setModulePermissions(completedPermissions);
      setAccountType(null);
    } catch (e) {
      console.error('fetchProfile error', e);
      setProfile(null);
      setRole('vendedor');
      setModulePermissions({});
      setAccountType(null);
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
        setModulePermissions(null);
        setAccountType(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchProfile(s.user.id);
      else setModulePermissions(null);
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
      options: {
        data: { display_name: displayName, role: selectedRole },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const canManageUsers = Boolean(
    user?.email?.toLowerCase() === OWNER_EMAIL || role === 'gestor'
  );

  const canAccessModule = (moduleKey: string) => {
    if (user?.email?.toLowerCase() === OWNER_EMAIL) return true;
    if (role === 'gestor' && moduleKey === 'usuarios') return true;
    if (modulePermissions === null) return false;
    return modulePermissions[moduleKey] === true;
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, role, accountType, loading, canManageUsers,
      modulePermissions, canAccessModule, signIn, signUp, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
