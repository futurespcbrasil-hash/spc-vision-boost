import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, Wifi, WifiOff, Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { syncDevices } from '@/services/tacticalRmmService';
import { StatusDot, fmtDateTime, fmtDuration } from './statusUtils';

const RemoteDashboard = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    const [{ data: d }, { data: s }, { data: cfg }] = await Promise.all([
      supabase.from('remote_devices').select('*'),
      supabase.from('remote_sessions').select('*').order('started_at', { ascending: false }).limit(10),
      supabase.from('remote_settings').select('last_sync_at').maybeSingle(),
    ]);
    setDevices(d ?? []);
    setSessions(s ?? []);
    setLastSync((cfg as any)?.last_sync_at ?? null);
  };

  useEffect(() => { load(); }, []);

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const r = await syncDevices(user.id);
      toast.success(`${r.sincronizados} computador(es) sincronizado(s)`);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const online = devices.filter((d) => d.status === 'online').length;
  const offline = devices.filter((d) => d.status !== 'online').length;
  const ativas = sessions.filter((s) => s.status === 'ativa').length;

  const cards = [
    { label: 'Total de computadores', value: devices.length, icon: Monitor },
    { label: 'Online', value: online, icon: Wifi },
    { label: 'Offline', value: offline, icon: WifiOff },
    { label: 'Sessões ativas', value: ativas, icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Future Remote</h1>
          <p className="text-sm text-muted-foreground">
            Última sincronização: {fmtDateTime(lastSync)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw size={16} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar computadores
          </Button>
          <Button asChild><Link to="/future-remote/computadores">Ver computadores</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-primary/10 p-3 text-primary"><c.icon size={20} /></div>
              <div>
                <div className="text-2xl font-bold text-foreground">{c.value}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimas sessões</CardTitle></CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma sessão registrada ainda.</p>
          ) : (
            <div className="divide-y divide-border">
              {sessions.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="font-medium text-foreground">{s.device_hostname || 'Computador'}</span>
                  <span className="text-muted-foreground">{s.operator_name || '—'}</span>
                  <span className="text-muted-foreground">{fmtDateTime(s.started_at)}</span>
                  <span className="text-muted-foreground">{fmtDuration(s.duration_seconds)}</span>
                  <StatusDot status={s.status === 'ativa' ? 'online' : 'offline'} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RemoteDashboard;
