import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Copy, Monitor, CheckCircle2, PlayCircle, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateCode, formatCode, getRemoteUrl } from '@/services/meshCentralService';
import { StatusBadge, fmtDateTime, countdown } from './statusUtils';

const PUBLIC_PATH = '/suporte';

export const useRequests = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    const { data } = await supabase.from('future_remote_requests').select('*').order('created_at', { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  return { requests, loading, reload: load };
};

const emptyForm = { client_name: '', client_company: '', client_phone: '', notes: '' };

const Solicitacoes = () => {
  const { user, profile } = useAuth();
  const { requests, loading, reload } = useRequests();
  const [devices, setDevices] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [ttl, setTtl] = useState(10);
  const [tick, setTick] = useState(Date.now());
  const [created, setCreated] = useState<any | null>(null);
  const [linking, setLinking] = useState<any | null>(null);
  const [selectedDevice, setSelectedDevice] = useState('');

  const loadDevices = async () => {
    const { data } = await supabase.from('future_remote_devices').select('*').order('status', { ascending: false }).order('device_name', { ascending: true });
    setDevices(data ?? []);
  };

  useEffect(() => {
    const i = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    supabase.from('future_remote_settings').select('code_ttl_minutes').maybeSingle().then(({ data }) => { if (data?.code_ttl_minutes) setTtl(data.code_ttl_minutes); });
    loadDevices();
  }, []);

  const publicUrl = useMemo(() => `${window.location.origin}${PUBLIC_PATH}`, []);

  const save = async () => {
    if (!form.client_name.trim()) { toast.error('Informe o nome do cliente'); return; }
    if (!user) return;
    const code = generateCode();
    const { data, error } = await supabase.from('future_remote_requests').insert({
      code, client_name: form.client_name, client_company: form.client_company || null,
      client_phone: form.client_phone || null, notes: form.notes || null, status: 'aguardando',
      created_by: user.id, expires_at: new Date(Date.now() + ttl * 60_000).toISOString(),
    }).select().maybeSingle();
    if (error) { toast.error(error.message); return; }
    setOpen(false); setForm(emptyForm); setCreated(data); reload();
  };

  const atender = async (r: any) => {
    if (!user) return;
    const nome = profile?.display_name || profile?.email || 'Funcionário';
    const started = new Date().toISOString();
    const { error } = await supabase.from('future_remote_requests').update({ status: 'em_atendimento', attended_by: user.id, attended_by_name: nome, started_at: started }).eq('id', r.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from('future_remote_sessions').insert({ request_id: r.id, attended_by: user.id, attended_by_name: nome, status: 'em_atendimento', started_at: started });
    toast.success('Atendimento iniciado'); reload();
  };

  const vincular = async () => {
    if (!linking || !selectedDevice) return;
    const device = devices.find((d) => d.id === selectedDevice);
    if (!device) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('future_remote_requests').update({ mesh_device_id: device.mesh_device_id, computer_name: device.device_name, linked_at: now }).eq('id', linking.id).is('mesh_device_id', null);
    if (error) { toast.error(error.message); return; }
    await supabase.from('future_remote_devices').update({ request_id: linking.id, linked_at: now }).eq('id', device.id);
    setLinking(null); setSelectedDevice(''); toast.success(`Computador "${device.device_name}" vinculado ao atendimento`); await Promise.all([reload(), loadDevices()]);
  };

  const acessar = async (r: any) => {
    if (!r.mesh_device_id) { toast.error('Este atendimento ainda não tem um computador conectado no MeshCentral. Sincronize os computadores e vincule o dispositivo.'); return; }
    try { const res = await getRemoteUrl(r.mesh_device_id); if (!res?.url) { toast.error(res?.message || 'MeshCentral não conectado'); return; } window.open(res.url, '_blank', 'noopener'); }
    catch (e: any) { toast.error(e.message || 'MeshCentral não conectado'); }
  };

  const finalizar = async (r: any) => {
    const now = new Date().toISOString();
    await supabase.from('future_remote_requests').update({ status: 'finalizado', finished_at: now }).eq('id', r.id);
    const { data: sess } = await supabase.from('future_remote_sessions').select('*').eq('request_id', r.id).eq('status', 'em_atendimento').maybeSingle();
    if (sess) { const dur = Math.max(0, Math.round((Date.now() - new Date(sess.started_at).getTime()) / 1000)); await supabase.from('future_remote_sessions').update({ status: 'finalizado', finished_at: now, duration_seconds: dur }).eq('id', sess.id); }
    toast.success('Atendimento finalizado'); reload(); loadDevices();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-foreground">Solicitações</h1><p className="text-sm text-muted-foreground">Link do cliente: {publicUrl}</p></div>
        <Button onClick={() => setOpen(true)}><Plus size={16} className="mr-2" />Nova solicitação</Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : requests.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhuma solicitação criada ainda.</CardContent></Card> : (
        <div className="grid gap-3">{requests.map((r) => (
          <Card key={r.id}><CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="min-w-[200px]"><div className="font-mono text-lg font-bold tracking-wider text-primary">{formatCode(r.code)}</div><div className="text-sm font-medium text-foreground">{r.client_name}</div><div className="text-xs text-muted-foreground">{r.client_company || '—'}</div></div>
            <div className="text-xs text-muted-foreground"><div className="flex items-center gap-1"><Monitor size={12} />{r.computer_name || 'Sem computador'}</div><div>Criado: {fmtDateTime(r.created_at)}</div><div>Expira em: {countdown(r.expires_at, tick) ?? '—'}</div><div>Atendido por: {r.attended_by_name || '—'}</div></div>
            <StatusBadge status={r.status} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(formatCode(r.code)); toast.success('Código copiado'); }}><Copy size={14} className="mr-1" />Código</Button>
              {r.status !== 'finalizado' && r.status !== 'em_atendimento' && <Button size="sm" onClick={() => atender(r)}><PlayCircle size={14} className="mr-1" />Atender</Button>}
              {!r.mesh_device_id && r.status !== 'finalizado' && <Button size="sm" variant="outline" onClick={() => { setLinking(r); setSelectedDevice(''); loadDevices(); }}><Link2 size={14} className="mr-1" />Vincular PC</Button>}
              <Button size="sm" variant="outline" onClick={() => acessar(r)}><Monitor size={14} className="mr-1" />Acessar computador</Button>
              {r.status !== 'finalizado' && <Button size="sm" variant="secondary" onClick={() => finalizar(r)}><CheckCircle2 size={14} className="mr-1" />Finalizar</Button>}
            </div>
          </CardContent></Card>
        ))}</div>
      )}

      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Nova solicitação</DialogTitle></DialogHeader><div className="space-y-3">
        <div><Label>Nome do cliente</Label><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
        <div><Label>Empresa</Label><Input value={form.client_company} onChange={(e) => setForm({ ...form, client_company: e.target.value })} /></div>
        <div><Label>Telefone</Label><Input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} /></div>
        <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <p className="text-xs text-muted-foreground">O código gerado vale {ttl} minutos.</p>
      </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Gerar código</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={!!linking} onOpenChange={() => { setLinking(null); setSelectedDevice(''); }}><DialogContent><DialogHeader><DialogTitle>Vincular computador</DialogTitle></DialogHeader><div className="space-y-3">
        <p className="text-sm text-muted-foreground">Selecione o computador que apareceu no MeshCentral após o cliente instalar o agente.</p>
        <div><Label>Computador MeshCentral</Label><select className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}><option value="">Selecione...</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.device_name} — {d.operating_system || 'SO não informado'} — {d.status}</option>)}</select></div>
        <p className="text-xs text-muted-foreground">Confira o nome do computador antes de vincular para evitar acessar o PC errado.</p>
      </div><DialogFooter><Button variant="outline" onClick={() => { setLinking(null); setSelectedDevice(''); }}>Cancelar</Button><Button onClick={vincular} disabled={!selectedDevice}>Vincular computador</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={!!created} onOpenChange={() => setCreated(null)}><DialogContent><DialogHeader><DialogTitle>Código de atendimento</DialogTitle></DialogHeader><div className="space-y-3 text-center">
        <div className="font-mono text-3xl font-bold tracking-widest text-primary">{formatCode(created?.code)}</div><p className="text-sm text-muted-foreground">Envie ao cliente:</p><p className="rounded-lg bg-muted p-3 text-left text-sm">Para iniciar o suporte remoto, acesse:<br />{publicUrl}<br />e informe o código: {formatCode(created?.code)}</p>
      </div><DialogFooter><Button onClick={() => { navigator.clipboard.writeText(`Para iniciar o suporte remoto, acesse: ${publicUrl} e informe o código: ${formatCode(created?.code)}`); toast.success('Mensagem copiada'); }}>Copiar mensagem</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
};

export default Solicitacoes;
