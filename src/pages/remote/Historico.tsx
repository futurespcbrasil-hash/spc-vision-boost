import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge, fmtDateTime, fmtDuration } from './statusUtils';

const Historico = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('future_remote_sessions')
        .select('*, future_remote_requests(client_name, client_company, computer_name), future_remote_devices(device_name)')
        .order('started_at', { ascending: false });
      setRows(data ?? []);
    })();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      const req = r.future_remote_requests ?? {};
      const texto = [req.client_name, req.client_company, req.computer_name, r.future_remote_devices?.device_name, r.attended_by_name]
        .filter(Boolean).join(' ').toLowerCase();
      if (q && !texto.includes(q)) return false;
      const t = new Date(r.started_at).getTime();
      if (de && t < new Date(`${de}T00:00:00`).getTime()) return false;
      if (ate && t > new Date(`${ate}T23:59:59`).getTime()) return false;
      return true;
    });
  }, [rows, busca, de, ate]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Histórico</h1>
        <p className="text-sm text-muted-foreground">Atendimentos realizados pelo Future Remote</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div><Label>Pesquisar</Label><Input placeholder="Cliente, empresa, computador, funcionário" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          <div><Label>De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
          <div><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filtrados.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum atendimento encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Computador</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Finalização</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.future_remote_requests?.client_name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{r.future_remote_requests?.client_company || ''}</div>
                      </TableCell>
                      <TableCell>{r.future_remote_devices?.device_name || r.future_remote_requests?.computer_name || '—'}</TableCell>
                      <TableCell>{r.attended_by_name || '—'}</TableCell>
                      <TableCell>{fmtDateTime(r.started_at)}</TableCell>
                      <TableCell>{fmtDateTime(r.finished_at)}</TableCell>
                      <TableCell>{fmtDuration(r.duration_seconds)}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.notes || '—'}</TableCell>
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

export default Historico;
