import { useEffect, useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Sector {
  key: string;
  label: string;
  userId?: string;
}

const DEFAULT_SECTORS: Sector[] = [
  { key: 'spc', label: 'SPC Brasil' },
  { key: 'comercial', label: 'Comercial' },
];

const STORAGE_KEY = 'active_sector';

const dedupeSectors = (rows: any[] = []): Sector[] => {
  const map = new Map<string, Sector>();
  // defaults always first
  DEFAULT_SECTORS.forEach(s => map.set(s.key, s));
  rows.forEach(row => {
    if (!row?.key) return;
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
  const [sectors, setSectors] = useState<Sector[]>(DEFAULT_SECTORS);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeSector, setActiveSectorState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || 'spc';
  });
  const [loading, setLoading] = useState(true);

  const setActiveSector = (key: string) => {
    setActiveSectorState(key);
    localStorage.setItem(STORAGE_KEY, key);
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

    const ownRows = (data || []).filter((r: any) => r.user_id === user.id);
    if (ownRows.length === 0) {
      const rows = DEFAULT_SECTORS.map((s, i) => ({
        user_id: user.id, key: s.key, label: s.label, position: i,
      }));
      const { data: inserted } = await supabase.from('sectors').insert(rows).select();
      const merged = [...(data || []), ...(inserted || [])];
      setSectors(dedupeSectors(merged));
    } else {
      setSectors(dedupeSectors(data || []));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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
    if (key === 'spc' || key === 'comercial') {
      toast({ title: 'Não permitido', description: 'Setores padrão não podem ser excluídos.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('sectors').delete().eq('key', key);
    if (error) {
      toast({ title: 'Erro ao excluir setor', description: error.message, variant: 'destructive' });
      return;
    }
    setSectors(prev => prev.filter(s => s.key !== key));
    if (activeSector === key) setActiveSector('spc');
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
    sectors: DEFAULT_SECTORS,
    activeSector: 'spc',
    setActiveSector: () => {},
    addSector: async () => {},
    deleteSector: async () => {},
    loading: false,
    currentUserId: null,
  };
};
