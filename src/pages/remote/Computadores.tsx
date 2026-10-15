import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Monitor, Pencil, Search, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { syncDevices, getRemoteUrl } from '@/services/meshCentralService';
import { DeviceStatus, fmtDateTime } from './statusUtils';

const Computadores = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ client_name: '', client_company: '' });

  const load = async () => {
    const { data, error } = await supabase.from('future_remote_devices').select('*').order('device_name');
    if (error) {
      toast.error('Não foi possível carregar os computadores: ' + error.message);
      return;
    }
    setDevices(data ?? []);
  };

  useEffect(() => { void load(); }, []);

  const filteredDevices = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return devices;
    return devices.filter((d) =>
      [d.device_name, d.client_name, d.client_company, d.operating_system, d.mesh_device_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [devices, search]);

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

  const editar = (device: any) => {
    setEditing(device);
    setForm({
      client_name: device.client_name ?? '',
      client_company: device.client_company ?? '',
    });
  };

  const salvarCadastro = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('future_remote_devices')
        .update({
          client_name: form.client_name.trim() || null,
          client_company: form.client_company.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editing.id);

      if (error) {
        toast.error('Não foi possível salvar o cadastro: ' + error.message);
        return;
      }

      toast.success('Cadastro do computador atualizado');
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
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
          <p className="text-sm text-muted-foreground">Dispositivos sincronizados com o MeshCentral e cadastro dos clientes atendidos.</p>
        </div>
        <Button variant="outline" onClick={sync} disabled={syncing}>
          <RefreshCw size={16} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />Sincronizar
        </Button>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">Link público para enviar aos clientes</h2>
            <p className="mt-1 text-sm text-muted-foreground">Envie este endereço para o cliente baixar o agente e seguir as instruções de acesso remoto.</p>
            <a
              href="https://crm.futuresolucoes.com.br/suporte"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block break-all text-sm font-medium text-primary underline underline-offset-4"
            >
              https://crm.futuresolucoes.com.br/suporte
            </a>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" onClick={async () => {
              try {
                await navigator.clipboard.writeText('https://crm.futuresolucoes.com.br/suporte');
                toast.success('Link público copiado');
              } catch {
                toast.error('Não foi possível copiar automaticamente. Selecione e copie o link exibido.');
              }
            }}>
              <Copy size={16} className="mr-2" />Copiar link
            </Button>
            <Button onClick={() => window.open('https://crm.futuresolucoes.com.br/suporte', '_blank', 'noopener')}>
              <ExternalLink size={16} className="mr-2" />Abrir página
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Pesquisar por computador, cliente, empresa, sistema ou ID Mesh..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {filteredDevices.length} de {devices.length} computador(es). Sincronize para atualizar os dispositivos vindos do MeshCentral.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {devices.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhum computador sincronizado. Configure o MeshCentral e clique em Sincronizar.
            </p>
          ) : filteredDevices.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum computador corresponde à pesquisa.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome do computador</TableHead>
                    <TableHead>Cliente / empresa</TableHead>
                    <TableHead>Sistema operacional</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último contato</TableHead>
                    <TableHead>Mesh Device ID</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.device_name || 'Sem nome'}</TableCell>
                      <TableCell>
                        <div className="font-medium">{d.client_name || 'Cliente não identificado'}</div>
                        <div className="text-xs text-muted-foreground">{d.client_company || 'Empresa não informada'}</div>
                      </TableCell>
                      <TableCell>{d.operating_system || '—'}</TableCell>
                      <TableCell><DeviceStatus status={d.status} /></TableCell>
                      <TableCell>{fmtDateTime(d.last_seen)}</TableCell>
                      <TableCell className="max-w-[180px] truncate font-mono text-xs">{d.mesh_device_id}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => editar(d)}>
                            <Pencil size={14} className="mr-1" />Editar
                          </Button>
                          <Button size="sm" onClick={() => acessar(d)}>
                            <Monitor size={14} className="mr-1" />Conectar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open && !saving) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastro do computador</DialogTitle>
            <DialogDescription>
              O nome técnico e o ID vêm do MeshCentral. Informe os dados do cliente para localizar este equipamento com facilidade.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="font-medium">{editing.device_name}</div>
                <div className="break-all font-mono text-xs text-muted-foreground">{editing.mesh_device_id}</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remote-client-name">Nome do cliente / responsável</Label>
                <Input
                  id="remote-client-name"
                  value={form.client_name}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  placeholder="Ex.: João da Silva"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remote-client-company">Empresa</Label>
                <Input
                  id="remote-client-company"
                  value={form.client_company}
                  onChange={(e) => setForm({ ...form, client_company: e.target.value })}
                  placeholder="Ex.: Empresa Cliente Ltda."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={salvarCadastro} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar cadastro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Computadores;
