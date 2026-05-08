import { useEffect, useState, useCallback } from 'react';
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

const mergeSectors = (rows: any[] = []): Sector[] => {
  const map = new Map<string, Sector>();
  DEFAULT_SECTORS.forEach(s => map.set(s.key, s));
  rows.forEach(row => {
    if (!map.has(row.key)) map.set(row.key, { key: row.key, label: row.label, userId: row.user_id });
  });
  return Array.from(map.values());
};

export const useSectors = () => {
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

    if (!data || data.length === 0) {
      // seed defaults for this user
      const rows = DEFAULT_SECTORS.map((s, i) => ({
        user_id: user.id, key: s.key, label: s.label, position: i,
      }));
      const { data: inserted } = await supabase.from('sectors').insert(rows).select();
      setSectors(mergeSectors(inserted || []));
    } else {
      setSectors(mergeSectors(data));
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
    setSectors([...sectors, { key: data.key, label: data.label, userId: data.user_id }]);
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
    setSectors(sectors.filter(s => s.key !== key));
    if (activeSector === key) setActiveSector('spc');
  };

  return { sectors, activeSector, setActiveSector, addSector, deleteSector, loading, currentUserId };
};
