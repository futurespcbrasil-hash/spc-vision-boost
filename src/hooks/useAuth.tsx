import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { USER_MODULES } from '@/lib/userModules';

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
  const profileRequestId = useRef(0);

  // Use the User already delivered by Supabase Auth. Calling auth.getUser() here
  // would add another network request to the critical path after the profile queries.
  const fetchProfile = async (authUser: User, requestId: number) => {
    try {
      const userId = authUser.id;
      const [{ data: p, error: profileError }, { data: roles, error: rolesError }, { data: permissions, error: permissionsError }] = await Promise.all([
        (supabase as any).from('profiles').select('display_name, email').eq('user_id', userId).maybeSingle(),
        (supabase as any).from('user_roles').select('role').eq('user_id', userId),
        (supabase as any).from('user_module_permissions').select('module_key, can_access').eq('user_id', userId),
      ]);

      // Ignore responses from an older login if the user signed out or switched accounts.
      if (requestId !== profileRequestId.current) return;
      if (profileError) throw profileError;
      if (rolesError) throw rolesError;
      if (permissionsError) throw permissionsError;

      setProfile(p ? {
        display_name: p.display_name || '',
        email: p.email || authUser.email || '',
      } : {
        display_name: String(authUser.user_metadata?.display_name || ''),
        email: authUser.email || '',
      });

      const roleRows = roles || [];
      const resolvedRole: AppRole = roleRows.some((item: { role: string }) => item.role === 'gestor')
        ? 'gestor'
        : roleRows.some((item: { role: string }) => item.role === 'atendimento')
          ? 'atendimento'
          : 'vendedor';
      setRole(resolvedRole);

      // Missing permission rows are denied by default. Only an explicit saved
      // can_access=true grants access; role defaults must never bypass saved settings.
      const permissionRows = permissions || [];
      const savedPermissions = Object.fromEntries(
        permissionRows.map((item: { module_key: string; can_access: boolean }) => [item.module_key, item.can_access])
      ) as Record<string, boolean>;
      const completedPermissions = Object.fromEntries(
        USER_MODULES.map(({ key }) => [key, savedPermissions[key] === true])
      );
      setModulePermissions(completedPermissions);
      setAccountType(null);
    } catch (e) {
      if (requestId !== profileRequestId.current) return;
      console.error('fetchProfile error', e);
      setProfile(null);
      setRole('vendedor');
      setModulePermissions({});
      setAccountType(null);
    } finally {
      if (requestId === profileRequestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    // INITIAL_SESSION supplies the persisted session, so a second getSession() call
    // is unnecessary and can trigger duplicate profile/permission queries on startup.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);

      if (!sess?.user) {
        profileRequestId.current += 1;
        setProfile(null);
        setRole('vendedor');
        setModulePermissions(null);
        setAccountType(null);
        setLoading(false);
        return;
      }

      // A token refresh does not change roles or module permissions. Reload profile
      // data only when the session is initialized or the authenticated user changes.
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        const requestId = ++profileRequestId.current;
        setLoading(true);
        setTimeout(() => void fetchProfile(sess.user, requestId), 0);
      }
    });

    return () => {
      profileRequestId.current += 1;
      subscription.unsubscribe();
    };
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

  // Somente a conta responsável pode administrar usuários e permissões.
  const canManageUsers = user?.email?.toLowerCase() === OWNER_EMAIL;

  // Para todos os demais usuários, o acesso é definido exclusivamente pelas
  // permissões salvas. Cargo Gestor/Atendimento não concede módulos implícitos.
  const canAccessModule = (moduleKey: string) => {
    if (user?.email?.toLowerCase() === OWNER_EMAIL) return true;
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
