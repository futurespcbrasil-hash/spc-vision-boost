import { useEffect, useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Sector {
  key: string;
  label: string;
  userId?: string;
}

const STORAGE_KEY_PREFIX = 'active_sector_';

const dedupeSectors = (rows: any[] = [], userId?: string): Sector[] => {
  const map = new Map<string, Sector>();
  rows.forEach(row => {
    if (!row?.key || (userId && row.user_id !== userId)) return;
    if (!map.has(row.key)) {
      map.set(row.key, { key: row.key, label: row.label, userId: row.user_id });
    }
  });
  return Array.from(map.values());
};

interface SectorsCtx {
  sectors: Sector[];
  activeSector: string;
  setActiveSector: (key: string) => void;
  addSector: (label: string) => Promise<void>;
  deleteSector: (key: string) => Promise<void>;
  loading: boolean;
  currentUserId: string | null;
}

const SectorsContext = createContext<SectorsCtx | null>(null);

export const SectorsProvider = ({ children }: { children: ReactNode }) => {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeSector, setActiveSectorState] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const setActiveSector = (key: string) => {
    setActiveSectorState(key);
    if (currentUserId) localStorage.setItem(`${STORAGE_KEY_PREFIX}${currentUserId}`, key);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('sectors')
      .select('*')
      .order('position', { ascending: true });

    if (error) {
      console.error('Erro ao carregar setores', error);
      setLoading(false);
      return;
    }

    // Get role and allowed_sectors for this user
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role, allowed_sectors')
      .eq('user_id', user.id)
      .maybeSingle();

    const userRole = roleData?.role || 'vendedor';
    const allowedSectors: string[] = roleData?.allowed_sectors || [];

    // Every profile sees only the sectors it owns. Do not auto-create SPC Brasil
    // or Comercial: a sector appears only after that profile explicitly creates it.
    // Keep the existing SPC Brasil sector for this profile, but never auto-show the generic Comercial sector.
    const ownSectors = dedupeSectors(data || [], user.id).filter(s => s.key !== 'comercial');
    setSectors(ownSectors);

    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${user.id}`);
    setActiveSectorState(saved && ownSectors.some(s => s.key === saved) ? saved : (ownSectors[0]?.key || ''));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Keep the selected sector valid for this profile; empty means the profile has not created one yet.
  useEffect(() => {
    if (loading) return;
    if (activeSector && !sectors.some(s => s.key === activeSector)) {
      setActiveSector(sectors[0]?.key || '');
    }
    if (!activeSector && sectors.length > 0) setActiveSector(sectors[0].key);
  }, [activeSector, loading, sectors]);

  const addSector = async (label: string) => {
    if (!label.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const key = `sector_${Date.now()}`;
    const { data, error } = await supabase
      .from('sectors')
      .insert({ user_id: user.id, key, label: label.trim(), position: sectors.length })
      .select().single();
    if (error || !data) {
      toast({ title: 'Erro ao criar setor', description: error?.message, variant: 'destructive' });
      return;
    }
    setSectors(prev => {
      if (prev.some(s => s.key === data.key)) return prev;
      return [...prev, { key: data.key, label: data.label, userId: data.user_id }];
    });
    setActiveSector(data.key);
    toast({ title: 'Setor criado', description: `"${data.label}" adicionado.` });
  };

  const deleteSector = async (key: string) => {
    const target = sectors.find(s => s.key === key);
    if (!currentUserId || !target || target.userId !== currentUserId) {
      toast({ title: 'Não permitido', description: 'Você só pode excluir setores criados pelo seu perfil.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('sectors').delete().eq('key', key).eq('user_id', currentUserId);
    if (error) {
      toast({ title: 'Erro ao excluir setor', description: error.message, variant: 'destructive' });
      return;
    }
    setSectors(prev => prev.filter(s => s.key !== key));
    if (activeSector === key) {
      const next = sectors.find(s => s.key !== key)?.key || '';
      setActiveSector(next);
    }
  };

  return (
    <SectorsContext.Provider value={{ sectors, activeSector, setActiveSector, addSector, deleteSector, loading, currentUserId }}>
      {children}
    </SectorsContext.Provider>
  );
};

export const useSectors = (): SectorsCtx => {
  const ctx = useContext(SectorsContext);
  if (ctx) return ctx;
  // Fallback for components rendered outside provider — return safe defaults
  return {
    sectors: [],
    activeSector: '',
    setActiveSector: () => {},
    addSector: async () => {},
    deleteSector: async () => {},
    loading: false,
    currentUserId: null,
  };
};
