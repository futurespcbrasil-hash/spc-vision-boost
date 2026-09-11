import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Headphones, CheckCircle2, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { meshStatus } from '@/services/meshCentralService';
import { StatusBadge, fmtDateTime, countdown } from './statusUtils';

const FutureRemoteDashboard = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [mesh, setMesh] = useState<{ connected: boolean; configured: boolean; message?: string } | null>(null);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: r }, { data: d }] = await Promise.all([
        supabase.from('future_remote_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('future_remote_devices').select('*'),
      ]);
      setRequests(r ?? []);
      setDevices(d ?? []);
      try { setMesh(await meshStatus()); } catch { setMesh({ connected: false, configured: false }); }
    })();
  }, []);

  const count = (s: string) => requests.filter((r) => r.status === s).length;
  const aguardando = requests.filter((r) => ['aguardando', 'codigo_validado', 'computador_conectado'].includes(r.status)).length;

  const cards = [
    { label: 'Aguardando atendimento', value: aguardando, icon: Clock },
    { label: 'Em atendimento', value: count('em_atendimento'), icon: Headphones },
    { label: 'Finalizadas', value: count('finalizado'), icon: CheckCircle2 },
    { label: 'Computadores online', value: devices.filter((d) => d.status === 'online').length, icon: Wifi },
    { label: 'Computadores offline', value: devices.filter((d) => d.status !== 'online').length, icon: WifiOff },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Future Remote</h1>
          <p className="text-sm text-muted-foreground">Suporte remoto Future Soluções</p>
        </div>
        <Button asChild><Link to="/future-remote/solicitacoes">Nova solicitação</Link></Button>
      </div>

      {mesh && !mesh.connected && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          <AlertTriangle size={16} />
          {mesh.configured ? 'MeshCentral não conectado' : 'Configuração pendente — informe o endereço e as credenciais do MeshCentral.'}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        <CardHeader><CardTitle className="text-base">Solicitações recentes</CardTitle></CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação registrada.</p>
          ) : (
            <div className="divide-y divide-border">
              {requests.slice(0, 8).map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="font-mono font-semibold text-primary">{(r.code ?? '').replace(/(\d{3})(?=\d)/g, '$1 ')}</span>
                  <span className="text-foreground">{r.client_name}</span>
                  <span className="text-muted-foreground">{r.client_company || '—'}</span>
                  <span className="text-muted-foreground">{r.computer_name || '—'}</span>
                  <StatusBadge status={r.status} />
                  <span className="text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</span>
                  <span className="text-xs text-muted-foreground">Expira: {countdown(r.expires_at, tick) ?? '—'}</span>
                  <span className="text-xs text-muted-foreground">{r.attended_by_name || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FutureRemoteDashboard;
