import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Monitor, Pencil, Search, Copy, ExternalLink, Trash2, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { syncDevices, getRemoteUrl } from '@/services/meshCentralService';
import { DeviceStatus, fmtDateTime } from './statusUtils';

const Computadores = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ client_name: '', client_company: '' });
  const [showNewAccess, setShowNewAccess] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [availableSearch, setAvailableSearch] = useState('');

  const load = async () => {
    // Carrega o inventário completo do MeshCentral e o histórico pessoal em separado.
    // Assim os acessos antigos continuam visíveis em "Todos", mesmo sem vínculo histórico.
    const [{ data: inventory, error: inventoryError }, { data: accessRows, error: accessError }] = await Promise.all([
      supabase.from('future_remote_devices').select('*').order('device_name'),
      (supabase as any).from('future_remote_device_access')
        .select('id, device_id, first_accessed_at, last_accessed_at, access_count')
        .order('last_accessed_at', { ascending: false }),
    ]);
    if (inventoryError) {
      toast.error('Não foi possível carregar o inventário de computadores: ' + inventoryError.message);
      return;
    }
    if (accessError) {
      toast.error('Não foi possível carregar seus acessos pessoais: ' + accessError.message);
      return;
    }
    const accessByDevice = new Map((accessRows ?? []).map((row: any) => [row.device_id, row]));
    setDevices((inventory ?? []).map((device: any) => {
      const access: any = accessByDevice.get(device.id);
      return {
        ...device,
        access_id: access?.id ?? null,
        first_accessed_at: access?.first_accessed_at ?? null,
        last_accessed_at: access?.last_accessed_at ?? null,
        access_count: access?.access_count ?? 0,
        accessed_by_current_user: Boolean(access),
      };
    }));
  };

  useEffect(() => { void load(); }, []);

  const filteredDevices = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = filterMode === 'mine' ? devices.filter((d) => d.accessed_by_current_user) : devices;
    const filtered = !query ? [...source] : source.filter((d) =>
      [d.device_name, d.client_name, d.client_company, d.operating_system, d.mesh_device_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
    // Ordena pelo último acesso deste usuário, não pelo cadastro global do dispositivo.
    return filtered.sort((a, b) => {
      const dateA = new Date(a.last_accessed_at || a.last_seen || a.created_at || 0).getTime();
      const dateB = new Date(b.last_accessed_at || b.last_seen || b.created_at || 0).getTime();
      return dateB - dateA || String(a.device_name || '').localeCompare(String(b.device_name || ''));
    });
  }, [devices, search, filterMode]);

  const groupedDevices = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const device of filteredDevices) {
      const activityDate = filterMode === 'mine'
        ? (device.last_accessed_at || device.last_seen || device.created_at)
        : (device.last_seen || device.last_accessed_at || device.created_at);
      const key = activityDate
        ? new Date(activityDate).toLocaleDateString('sv-SE')
        : 'sem-data';
      groups.set(key, [...(groups.get(key) ?? []), device]);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      items,
      label: key === 'sem-data'
        ? 'Data do acesso não disponível'
        : new Date(`${key}T12:00:00`).toLocaleDateString('pt-BR', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
          }),
    }));
  }, [filteredDevices, filterMode]);

  const openNewAccess = async () => {
    setShowNewAccess(true);
    setAvailableLoading(true);
    try {
      const { data, error } = await supabase
        .from('future_remote_devices')
        .select('id, mesh_device_id, device_name, client_name, client_company, operating_system, status')
        .order('device_name');
      if (error) {
        toast.error('Não foi possível carregar o inventário para novo acesso: ' + error.message);
        return;
      }
      setAvailableDevices(data ?? []);
    } finally {
      setAvailableLoading(false);
    }
  };

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

  const excluirConexao = async (device: any) => {
    const confirmed = window.confirm(
      `Remover "${device.device_name || 'computador'}" da sua lista de acessos?\n\nIsso afeta somente a sua lista pessoal. O computador continua cadastrado no inventário global e no MeshCentral.`
    );
    if (!confirmed) return;

    setDeletingId(device.access_id);
    try {
      const { error } = await (supabase as any)
        .from('future_remote_device_access')
        .delete()
        .eq('id', device.access_id);

      if (error) {
        toast.error('Não foi possível remover o computador da sua lista: ' + error.message);
        return;
      }

      toast.success('Computador removido da sua lista de acessos');
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  const acessar = async (d: any) => {
    try {
      const res = await getRemoteUrl(d.mesh_device_id);
      if (!res?.url) { toast.error(res?.message || 'MeshCentral não conectado'); return; }
      window.open(res.url, '_blank', 'noopener');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'MeshCentral não conectado');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Computadores</h1>
          <p className="text-sm text-muted-foreground">Consulte todo o inventário sincronizado ou filtre somente os computadores que você acessou pelo CRM.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openNewAccess}>
            <Monitor size={16} className="mr-2" />Novo acesso
          </Button>
          <Button variant="outline" onClick={sync} disabled={syncing}>
            <RefreshCw size={16} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />Sincronizar
          </Button>
        </div>
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Pesquisar por computador, cliente, empresa, sistema ou ID Mesh..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Filtrar computadores"
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as 'all' | 'mine')}
            >
              <option value="all">Todos os computadores</option>
              <option value="mine">Somente meus acessos</option>
            </select>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Exibindo {filteredDevices.length} de {devices.length} computador(es) do inventário. {filterMode === 'all' ? 'A lista inclui todos os computadores sincronizados com o MeshCentral.' : 'A lista inclui somente os computadores registrados nos seus acessos pelo CRM.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {devices.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhum computador cadastrado no inventário. Clique em Sincronizar para carregar os computadores do MeshCentral.
            </p>
          ) : filteredDevices.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum computador corresponde ao filtro ou à pesquisa.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome do computador</TableHead>
                    <TableHead>Cliente / empresa</TableHead>
                    <TableHead>Sistema operacional</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>{filterMode === 'mine' ? 'Último acesso' : 'Último contato / atividade'}</TableHead>
                    <TableHead>Mesh Device ID</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedDevices.flatMap((group) => [
                    <TableRow key={`date-${group.key}`} className="bg-muted/60 hover:bg-muted/60">
                      <TableCell colSpan={7} className="py-2">
                        <div className="flex items-center gap-2 text-sm font-semibold capitalize text-foreground">
                          <CalendarDays size={15} className="text-primary" />
                          {group.label}
                          <span className="font-normal text-muted-foreground">· {group.items.length} computador(es)</span>
                        </div>
                      </TableCell>
                    </TableRow>,
                    ...group.items.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.device_name || 'Sem nome'}</TableCell>
                      <TableCell>
                        <div className="font-medium">{d.client_name || 'Cliente não identificado'}</div>
                        <div className="text-xs text-muted-foreground">{d.client_company || 'Empresa não informada'}</div>
                      </TableCell>
                      <TableCell>{d.operating_system || '—'}</TableCell>
                      <TableCell><DeviceStatus status={d.status} /></TableCell>
                      <TableCell>{fmtDateTime(filterMode === 'mine' ? (d.last_accessed_at || d.last_seen) : (d.last_seen || d.last_accessed_at))}</TableCell>
                      <TableCell className="max-w-[180px] truncate font-mono text-xs">{d.mesh_device_id}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => editar(d)}>
                            <Pencil size={14} className="mr-1" />Editar
                          </Button>
                          {d.access_id && <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => excluirConexao(d)}
                            disabled={deletingId === d.access_id}
                            title="Remover somente da sua lista pessoal"
                          >
                            <Trash2 size={14} className="mr-1" />
                            {deletingId === d.access_id ? 'Removendo...' : 'Remover da minha lista'}
                          </Button>}
                          <Button size="sm" onClick={() => acessar(d)}>
                            <Monitor size={14} className="mr-1" />Conectar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    ))
                  ])}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>


      <Dialog open={showNewAccess} onOpenChange={setShowNewAccess}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Iniciar novo acesso remoto</DialogTitle>
            <DialogDescription>
              Escolha um computador do inventário global. Ele será adicionado à sua lista pessoal quando você iniciar o acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Pesquisar computador, cliente ou empresa..."
              value={availableSearch}
              onChange={(e) => setAvailableSearch(e.target.value)}
            />
            <div className="max-h-[55vh] space-y-2 overflow-y-auto">
              {availableLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Carregando computadores...</p>
              ) : availableDevices.filter((d) =>
                [d.device_name, d.client_name, d.client_company, d.operating_system]
                  .filter(Boolean).some((v) => String(v).toLowerCase().includes(availableSearch.trim().toLowerCase()))
              ).length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Nenhum computador encontrado. Clique em Sincronizar para atualizar o inventário.</p>
              ) : availableDevices.filter((d) =>
                [d.device_name, d.client_name, d.client_company, d.operating_system]
                  .filter(Boolean).some((v) => String(v).toLowerCase().includes(availableSearch.trim().toLowerCase()))
              ).map((d) => (
                <div key={d.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium">{d.device_name || 'Sem nome'}</div>
                    <div className="text-sm text-muted-foreground">{d.client_name || 'Cliente não identificado'} · {d.client_company || 'Empresa não informada'}</div>
                    <div className="text-xs text-muted-foreground">{d.operating_system || 'Sistema operacional não informado'}</div>
                  </div>
                  <Button size="sm" onClick={() => { setShowNewAccess(false); void acessar(d); }}>
                    <Monitor size={14} className="mr-1" />Conectar
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewAccess(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
