import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { syncDevices, getRemoteUrl } from '@/services/meshCentralService';
import { DeviceStatus, fmtDateTime } from './statusUtils';

const Computadores = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('future_remote_devices').select('*').order('device_name');
    setDevices(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await syncDevices();
      if ((res as any)?.error) { toast.error((res as any).message || 'MeshCentral não conectado'); return; }
      toast.success(`${res.total} computador(es) sincronizado(s)`);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'MeshCentral não conectado');
    } finally {
      setSyncing(false);
    }
  };

  const acessar = async (d: any) => {
    try {
      const res = await getRemoteUrl(d.mesh_device_id);
      if (!res?.url) { toast.error(res?.message || 'MeshCentral não conectado'); return; }
      window.open(res.url, '_blank', 'noopener');
    } catch (e: any) {
      toast.error(e.message || 'MeshCentral não conectado');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Computadores</h1>
          <p className="text-sm text-muted-foreground">Dados obtidos do MeshCentral</p>
        </div>
        <Button variant="outline" onClick={sync} disabled={syncing}>
          <RefreshCw size={16} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />Sincronizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {devices.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhum computador sincronizado. Configure o MeshCentral e clique em Sincronizar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Computador</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Sistema operacional</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última conexão</TableHead>
                    <TableHead>Mesh Device ID</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.device_name}</TableCell>
                      <TableCell>{d.client_name || '—'}</TableCell>
                      <TableCell>{d.operating_system || '—'}</TableCell>
                      <TableCell><DeviceStatus status={d.status} /></TableCell>
                      <TableCell>{fmtDateTime(d.last_seen)}</TableCell>
                      <TableCell className="max-w-[180px] truncate font-mono text-xs">{d.mesh_device_id}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => acessar(d)}>
                          <Monitor size={14} className="mr-1" />Acessar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Computadores;
