import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Monitor, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { meshStatus, syncDevices } from '@/services/meshCentralService';
import { DeviceStatus, fmtDateTime } from './statusUtils';
import { toast } from 'sonner';

const FutureRemoteDashboard = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [mesh, setMesh] = useState<{ connected: boolean; configured: boolean; message?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    const [{ data, error }, status] = await Promise.all([
      supabase.from('future_remote_devices').select('*').order('updated_at', { ascending: false }),
      meshStatus().catch(() => ({ connected: false, configured: false, message: 'Não foi possível testar a conexão.' })),
    ]);
    if (error) toast.error('Não foi possível carregar os computadores: ' + error.message);
    setDevices(data ?? []);
    setMesh(status);
  };

  useEffect(() => { void load(); }, []);

  const sincronizar = async () => {
    setSyncing(true);
    try {
      const res = await syncDevices();
      if ((res as any)?.error) {
        toast.error((res as any).message || 'Não foi possível sincronizar com o MeshCentral');
        return;
      }
      toast.success(`${res.total} computador(es) sincronizado(s)`);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível sincronizar com o MeshCentral');
    } finally {
      setSyncing(false);
    }
  };

  const online = devices.filter((d) => d.status === 'online').length;
  const offline = devices.length - online;
  const semCadastro = devices.filter((d) => !d.client_name && !d.client_company).length;

  const cards = [
    { label: 'Total de computadores', value: devices.length, icon: Monitor },
    { label: 'Online', value: online, icon: Wifi },
    { label: 'Offline', value: offline, icon: WifiOff },
    { label: 'Sem identificação de cliente', value: semCadastro, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Future Remote</h1>
          <p className="text-sm text-muted-foreground">Visão geral dos computadores e do suporte remoto</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={sincronizar} disabled={syncing}>
            <RefreshCw size={16} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
          <Button asChild><Link to="/future-remote/computadores">Gerenciar computadores</Link></Button>
        </div>
      </div>

      {mesh && !mesh.connected && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          <AlertTriangle size={16} />
          {mesh.configured ? 'O teste de status do MeshCentral não confirmou a conexão. Se o acesso remoto estiver funcionando, confira o teste de status antes de alterar as credenciais.' : 'Configuração do MeshCentral pendente — confira a configuração do servidor.'}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><c.icon size={18} /></div>
              <div>
                <div className="text-xl font-bold text-foreground">{c.value}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Computadores sincronizados recentemente</CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Nenhum computador cadastrado ainda. Sincronize com o MeshCentral para importar os dispositivos.</p>
              <Button variant="outline" onClick={sincronizar} disabled={syncing}>
                <RefreshCw size={16} className="mr-2" />Sincronizar computadores
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {devices.slice(0, 8).map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-[180px]">
                    <div className="font-medium text-foreground">{d.device_name || 'Computador sem nome'}</div>
                    <div className="text-xs text-muted-foreground">{d.client_name || 'Cliente não identificado'} · {d.client_company || 'Empresa não informada'}</div>
                    <div className="text-xs text-muted-foreground">{d.operating_system || 'Sistema não informado'}</div>
                  </div>
                  <DeviceStatus status={d.status} />
                  <div className="text-xs text-muted-foreground">Último contato: {fmtDateTime(d.last_seen)}</div>
                </div>
              ))}
              <div className="pt-3">
                <Button asChild variant="outline"><Link to="/future-remote/computadores">Ver todos os computadores</Link></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FutureRemoteDashboard;
