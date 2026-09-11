import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plug, Save } from 'lucide-react';
import { toast } from 'sonner';
import { meshStatus } from '@/services/meshCentralService';

const Configuracoes = () => {
  const { role } = useAuth();
  const isGestor = role === 'gestor';
  const [settings, setSettings] = useState<any>({ mesh_group: 'Future Remote', code_ttl_minutes: 10, public_support_url: '' });
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);

  const publicUrl = useMemo(() => `${window.location.origin}/suporte`, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('future_remote_settings').select('*').maybeSingle();
      if (data) setSettings(data);
    })();
  }, []);

  const salvar = async () => {
    const payload = {
      mesh_group: settings.mesh_group,
      code_ttl_minutes: Number(settings.code_ttl_minutes) || 10,
      public_support_url: settings.public_support_url || publicUrl,
      singleton: true,
    };
    const { error } = settings.id
      ? await supabase.from('future_remote_settings').update(payload).eq('id', settings.id)
      : await supabase.from('future_remote_settings').insert(payload);
    if (error) toast.error(error.message);
    else toast.success('Configurações salvas');
  };

  const testar = async () => {
    setTestando(true);
    try {
      const res = await meshStatus();
      setResultado(res.connected
        ? { ok: true, msg: '🟢 Conectado com sucesso' }
        : { ok: false, msg: res.configured ? '🔴 MeshCentral não conectado' : '🔴 Configuração pendente' });
    } catch (e: any) {
      setResultado({ ok: false, msg: '🔴 Falha na conexão' });
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Future Remote · MeshCentral</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Servidor MeshCentral</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            O endereço e as credenciais do MeshCentral ficam guardados com segurança no servidor
            (MESH_SERVER_URL, MESH_USER, MESH_PASS) e nunca aparecem aqui no navegador.
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={testar} disabled={testando}>
              <Plug size={16} className="mr-2" />{testando ? 'Testando...' : 'Testar conexão'}
            </Button>
            {resultado && <span className={`text-sm ${resultado.ok ? 'text-emerald-600' : 'text-red-600'}`}>{resultado.msg}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Preferências do módulo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Grupo MeshCentral</Label>
            <Input value={settings.mesh_group ?? ''} disabled={!isGestor}
              onChange={(e) => setSettings({ ...settings, mesh_group: e.target.value })} /></div>
          <div><Label>Tempo padrão do código (minutos)</Label>
            <Input type="number" min={1} value={settings.code_ttl_minutes ?? 10} disabled={!isGestor}
              onChange={(e) => setSettings({ ...settings, code_ttl_minutes: e.target.value })} /></div>
          <div><Label>Link público de suporte</Label>
            <Input value={settings.public_support_url || publicUrl} disabled={!isGestor}
              onChange={(e) => setSettings({ ...settings, public_support_url: e.target.value })} /></div>
          {isGestor ? (
            <Button onClick={salvar}><Save size={16} className="mr-2" />Salvar</Button>
          ) : (
            <p className="text-xs text-muted-foreground">Somente gestores podem alterar estas configurações.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Configuracoes;
