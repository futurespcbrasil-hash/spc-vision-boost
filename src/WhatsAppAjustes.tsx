import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Trash2, Zap, Tag, Smartphone, QrCode, RefreshCcw, LogOut,
  Webhook, Users, Settings, Layers, Shield, UserPlus, Edit2, Eye, EyeOff, Check
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ryze } from '@/services/ryzeService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

/* ─── Types ─── */
interface Instance { id: string; name: string; status: string; phone: string | null; qr_code: string | null; ryze_instance_id: string | null; }
interface UserRow { id: string; user_id: string; display_name: string; email: string; role: string; allowed_sectors: string[]; }
interface SectorRow { id: string; key: string; label: string; color: string; position: number; }

const statusColor = (s: string) => {
  if (s === 'connected') return 'bg-green-500';
  if (s === 'qr' || s === 'connecting') return 'bg-yellow-500';
  return 'bg-slate-400';
};
const statusLabel = (s: string) => ({ connected: 'Online', disconnected: 'Offline', qr: 'Aguardando QR', connecting: 'Conectando', created: 'Criada' } as Record<string, string>)[s] || s;

const SECTOR_COLORS = ['#8B5CF6', '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];

/* ═══════════════════════════════════════════════════════════════ */
const WhatsAppAjustes = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isGestor = role === 'gestor';

  /* ── Quick replies ── */
  const [qrShortcut, setQrShortcut] = useState('');
  const [qrText, setQrText] = useState('');
  const [replies, setReplies] = useState<any[]>([]);

  /* ── Labels ── */
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#8B5CF6');
  const [labels, setLabels] = useState<any[]>([]);

  /* ── Instances ── */
  const [instances, setInstances] = useState<Instance[]>([]);
  const [instLoading, setInstLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [qrOpen, setQrOpen] = useState<Instance | null>(null);

  /* ── Users (gestor only) ── */
  const [users, setUsers] = useState<UserRow[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPwd, setNewUserPwd] = useState('');
  const [newUserRole, setNewUserRole] = useState<'vendedor' | 'gestor'>('vendedor');
  const [showPwd, setShowPwd] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [permDialog, setPermDialog] = useState<UserRow | null>(null);
  const [permSectors, setPermSectors] = useState<string[]>([]);

  /* ── Sectors (gestor only) ── */
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [newSectorLabel, setNewSectorLabel] = useState('');
  const [newSectorColor, setNewSectorColor] = useState('#8B5CF6');
  const [editSector, setEditSector] = useState<SectorRow | null>(null);

  /* ─── Loaders ─── */
  const loadAll = async () => {
    const [r, l, inst] = await Promise.all([
      supabase.from('whatsapp_quick_replies').select('*').order('shortcut'),
      supabase.from('whatsapp_labels').select('*').order('name'),
      supabase.from('whatsapp_instances').select('*').order('created_at', { ascending: false }),
    ]);
    setReplies(r.data || []);
    setLabels(l.data || []);
    setInstances((inst.data as Instance[]) || []);

    if (isGestor) {
      const [u, s] = await Promise.all([
        supabase.from('profiles').select('id, user_id, display_name, email'),
        supabase.from('sectors').select('*').order('position'),
      ]);
      const profiles = u.data || [];
      // fetch roles for each user
      const rolesData = await supabase.from('user_roles').select('user_id, role, allowed_sectors');
      const roleMap: Record<string, { role: string; allowed_sectors: string[] }> = {};
      (rolesData.data || []).forEach((r: any) => {
        roleMap[r.user_id] = { role: r.role, allowed_sectors: r.allowed_sectors || [] };
      });
      setUsers(profiles.map((p: any) => ({
        ...p,
        role: roleMap[p.user_id]?.role || 'vendedor',
        allowed_sectors: roleMap[p.user_id]?.allowed_sectors || [],
      })));
      setSectors((s.data as SectorRow[]) || []);
    }
  };

  useEffect(() => { loadAll(); }, [isGestor]);

  /* ─── Quick Replies ─── */
  const addReply = async () => {
    if (!qrShortcut.trim() || !qrText.trim() || !user) return;
    const { error } = await supabase.from('whatsapp_quick_replies').insert({ user_id: user.id, shortcut: qrShortcut.trim(), text: qrText.trim() });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setQrShortcut(''); setQrText(''); loadAll();
    toast({ title: 'Resposta rápida adicionada!' });
  };
  const delReply = async (id: string) => { await supabase.from('whatsapp_quick_replies').delete().eq('id', id); loadAll(); };

  /* ─── Labels ─── */
  const addLabel = async () => {
    if (!labelName.trim() || !user) return;
    const { error } = await supabase.from('whatsapp_labels').insert({ user_id: user.id, name: labelName.trim(), color: labelColor });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setLabelName(''); loadAll();
    toast({ title: 'Etiqueta criada!' });
  };
  const delLabel = async (id: string) => { await supabase.from('whatsapp_labels').delete().eq('id', id); loadAll(); };

  /* ─── Instances ─── */
  const canCreate = instances.length === 0;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await ryze.createInstance(newName.trim());
      setNewName('');
      toast({ title: 'Instância criada!' });
      await loadAll();
    } catch (e: any) {
      toast({ title: 'Erro ao criar', description: e.message, variant: 'destructive' });
    } finally { setCreating(false); }
  };

  const handleConnect = async (inst: Instance) => {
    setInstLoading(true);
    try {
      const r = await ryze.connect(inst.id);
      await loadAll();
      const qrCode = r.qr || r.raw?.base64 || r.raw?.data?.base64 || r.raw?.code;
      setQrOpen({ ...inst, qr_code: qrCode });
      const iv = setInterval(async () => {
        const s = await ryze.status(inst.id).catch(() => null);
        const connected = s?.status === 'connected' || s?.raw?.connection?.state === 'open';
        if (connected) {
          clearInterval(iv);
          setQrOpen(null);
          await ryze.registerWebhook(inst.id).catch(() => null);
          await ryze.getChats(inst.id).catch(() => null);
          await loadAll();
          toast({ title: 'WhatsApp Conectado!', description: `Número: ${s?.phone || 'Dispositivo conectado'}` });
        }
      }, 3000);
      setTimeout(() => clearInterval(iv), 120000);
    } catch (e: any) {
      toast({ title: 'Erro ao conectar', description: e.message, variant: 'destructive' });
    } finally { setInstLoading(false); }
  };

  const handleStatus = async (inst: Instance) => {
    try {
      const s = await ryze.status(inst.id);
      loadAll();
      toast({ title: s?.status === 'connected' ? 'Instância Online!' : `Status: ${statusLabel(s?.status || inst.status)}` });
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
  };

  const handleWebhook = async (inst: Instance) => {
    try { await ryze.registerWebhook(inst.id); toast({ title: 'Webhook registrado!' }); }
    catch (e: any) { toast({ title: 'Erro webhook', description: e.message, variant: 'destructive' }); }
  };

  const handleDisconnect = async (inst: Instance) => {
    try { await ryze.disconnect(inst.id); await loadAll(); toast({ title: 'Desconectado!' }); }
    catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
  };

  const handleDelete = async (inst: Instance) => {
    if (!confirm(`Excluir instância "${inst.name}"?`)) return;
    try { await ryze.deleteInstance(inst.id); await loadAll(); toast({ title: 'Excluída!' }); }
    catch {
      const { error } = await supabase.from('whatsapp_instances').delete().eq('id', inst.id);
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      else { await loadAll(); toast({ title: 'Instância removida!' }); }
    }
  };

  /* ─── Users ─── */
  const handleCreateUser = async () => {
    if (!newUserEmail.trim() || !newUserName.trim() || !newUserPwd.trim()) return;
    setCreatingUser(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: newUserEmail.trim(),
        password: newUserPwd,
        options: { data: { display_name: newUserName.trim(), role: newUserRole } },
      });
      if (error) throw error;
      toast({ title: 'Usuário criado!', description: `${newUserEmail} cadastrado. Verifique o email de confirmação.` });
      setNewUserEmail(''); setNewUserName(''); setNewUserPwd('');
      setTimeout(() => loadAll(), 1500);
    } catch (e: any) {
      toast({ title: 'Erro ao criar usuário', description: e.message, variant: 'destructive' });
    } finally { setCreatingUser(false); }
  };

  const openPermDialog = (u: UserRow) => { setPermDialog(u); setPermSectors(u.allowed_sectors || []); };

  const savePermissions = async () => {
    if (!permDialog) return;
    const { error } = await supabase.from('user_roles')
      .update({ allowed_sectors: permSectors })
      .eq('user_id', permDialog.user_id);
    if (error) {
      toast({ title: 'Erro ao salvar permissões', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Permissões atualizadas!' });
      setPermDialog(null);
      loadAll();
    }
  };

  const togglePermSector = (key: string) => {
    setPermSectors(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  /* ─── Sectors ─── */
  const addSector = async () => {
    if (!newSectorLabel.trim() || !user) return;
    const key = `sector_${Date.now()}`;
    const { error } = await supabase.from('sectors').insert({
      user_id: user.id, key, label: newSectorLabel.trim(), color: newSectorColor, position: sectors.length,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setNewSectorLabel(''); loadAll();
    toast({ title: 'Setor criado!' });
  };

  const deleteSector = async (s: SectorRow) => {
    if (s.key === 'spc' || s.key === 'comercial') {
      return toast({ title: 'Não permitido', description: 'Setores padrão não podem ser excluídos.', variant: 'destructive' });
    }
    if (!confirm(`Excluir setor "${s.label}"?`)) return;
    await supabase.from('sectors').delete().eq('id', s.id);
    loadAll();
    toast({ title: 'Setor excluído!' });
  };

  const saveSector = async () => {
    if (!editSector) return;
    const { error } = await supabase.from('sectors')
      .update({ label: editSector.label, color: editSector.color })
      .eq('id', editSector.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setEditSector(null); loadAll();
    toast({ title: 'Setor atualizado!' });
  };

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ajustes WhatsApp</h1>
        <p className="text-sm text-muted-foreground">Configure instâncias, usuários, setores, respostas e etiquetas.</p>
      </div>

      <Tabs defaultValue="instancias" className="space-y-4">
        <TabsList className={`grid w-full ${isGestor ? 'grid-cols-5' : 'grid-cols-3'}`}>
          <TabsTrigger value="instancias" className="gap-1 text-xs"><Smartphone size={14}/>Instância</TabsTrigger>
          <TabsTrigger value="respostas" className="gap-1 text-xs"><Zap size={14}/>Respostas</TabsTrigger>
          <TabsTrigger value="etiquetas" className="gap-1 text-xs"><Tag size={14}/>Etiquetas</TabsTrigger>
          {isGestor && <TabsTrigger value="usuarios" className="gap-1 text-xs"><Users size={14}/>Usuários</TabsTrigger>}
          {isGestor && <TabsTrigger value="setores" className="gap-1 text-xs"><Layers size={14}/>Setores</TabsTrigger>}
        </TabsList>

        {/* ── TAB: INSTÂNCIAS ── */}
        <TabsContent value="instancias" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Smartphone size={16}/>Nova Instância</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {canCreate ? (
                <div className="flex gap-2">
                  <Input placeholder="Nome (ex: atendimento-01)" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                  <Button onClick={handleCreate} disabled={creating} className="gap-1 whitespace-nowrap"><Plus size={14}/>Criar</Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  <Settings size={16} className="flex-shrink-0"/>
                  <p>Já existe uma instância configurada. Exclua a atual para criar uma nova.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {instances.map(inst => (
              <Card key={inst.id}>
                <CardContent className="flex items-center justify-between py-4 gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Smartphone size={20} className="text-green-600"/>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{inst.name}</p>
                      <p className="text-xs text-muted-foreground">{inst.phone || 'Sem número vinculado'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={statusColor(inst.status)}>{statusLabel(inst.status)}</Badge>
                    <Button variant="outline" size="sm" onClick={() => handleStatus(inst)} className="gap-1"><RefreshCcw size={13}/>Status</Button>
                    {inst.status !== 'connected' ? (
                      <Button size="sm" onClick={() => handleConnect(inst)} disabled={instLoading} className="gap-1"><QrCode size={13}/>Conectar</Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleWebhook(inst)} className="gap-1"><Webhook size={13}/>Webhook</Button>
                        <Button size="sm" variant="outline" onClick={() => handleDisconnect(inst)} className="gap-1 text-orange-600 hover:bg-orange-50"><LogOut size={13}/>Desconectar</Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleDelete(inst)} className="gap-1 text-red-600 hover:bg-red-50"><Trash2 size={13}/>Excluir</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {instances.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma instância criada. Crie uma acima.</p>}
          </div>
        </TabsContent>

        {/* ── TAB: RESPOSTAS RÁPIDAS ── */}
        <TabsContent value="respostas">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap size={16}/>Respostas Rápidas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-[160px_1fr_auto]">
                <Input placeholder="atalho (ex: ola)" value={qrShortcut} onChange={e => setQrShortcut(e.target.value)}/>
                <Textarea placeholder="Texto da resposta rápida..." value={qrText} onChange={e => setQrText(e.target.value)} rows={2}/>
                <Button onClick={addReply} className="gap-1"><Plus size={14}/>Adicionar</Button>
              </div>
              <div className="space-y-2">
                {replies.map(r => (
                  <div key={r.id} className="flex items-center justify-between border rounded-lg p-2.5 text-sm bg-muted/20">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-purple-700">/{r.shortcut}</span>
                      <span className="text-muted-foreground"> — </span>
                      <span className="text-muted-foreground truncate">{r.text}</span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => delReply(r.id)} className="h-7 w-7 text-muted-foreground hover:text-red-500"><Trash2 size={13}/></Button>
                  </div>
                ))}
                {replies.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma resposta rápida cadastrada.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: ETIQUETAS ── */}
        <TabsContent value="etiquetas">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Tag size={16}/>Etiquetas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-[1fr_80px_auto]">
                <Input placeholder="Nome da etiqueta" value={labelName} onChange={e => setLabelName(e.target.value)}/>
                <input type="color" value={labelColor} onChange={e => setLabelColor(e.target.value)} className="w-full h-10 rounded-md border cursor-pointer"/>
                <Button onClick={addLabel} className="gap-1"><Plus size={14}/>Adicionar</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {labels.map(l => (
                  <Badge key={l.id} style={{ backgroundColor: l.color }} className="text-white gap-2 cursor-pointer pl-3 pr-2 py-1.5 text-xs">
                    {l.name}
                    <button onClick={() => delLabel(l.id)} className="ml-1 opacity-70 hover:opacity-100"><Trash2 size={11}/></button>
                  </Badge>
                ))}
                {labels.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhuma etiqueta criada.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: USUÁRIOS (gestor) ── */}
        {isGestor && (
          <TabsContent value="usuarios" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus size={16}/>Criar Novo Usuário</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input placeholder="Nome completo" value={newUserName} onChange={e => setNewUserName(e.target.value)}/>
                  <Input placeholder="Email" type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)}/>
                  <div className="relative">
                    <Input placeholder="Senha" type={showPwd ? 'text' : 'password'} value={newUserPwd} onChange={e => setNewUserPwd(e.target.value)}/>
                    <button onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                  <Select value={newUserRole} onValueChange={(v: any) => setNewUserRole(v)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vendedor">Atendente / Vendedor</SelectItem>
                      <SelectItem value="gestor">Gestor (Admin)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateUser} disabled={creatingUser} className="gap-2">
                  <UserPlus size={14}/>{creatingUser ? 'Criando...' : 'Criar Usuário'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users size={16}/>Usuários Cadastrados</CardTitle></CardHeader>
              <CardContent>
                <div className="divide-y">
                  {users.map(u => (
                    <div key={u.user_id} className="flex items-center justify-between py-3 gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{u.display_name || u.email}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{u.role === 'gestor' ? 'Gestor' : 'Atendente'}</Badge>
                          {(u.allowed_sectors || []).length > 0
                            ? (u.allowed_sectors || []).map(k => (
                                <Badge key={k} className="text-[10px] bg-purple-100 text-purple-700 border-purple-200">{sectors.find(s => s.key === k)?.label || k}</Badge>
                              ))
                            : <Badge className="text-[10px] bg-emerald-50 text-emerald-700">Todos os setores</Badge>
                          }
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openPermDialog(u)} className="gap-1 text-xs">
                        <Shield size={13}/>Permissões
                      </Button>
                    </div>
                  ))}
                  {users.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum usuário encontrado.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── TAB: SETORES (gestor) ── */}
        {isGestor && (
          <TabsContent value="setores" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Layers size={16}/>Novo Setor</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 items-center flex-wrap">
                  <Input placeholder="Nome do setor (ex: Suporte)" value={newSectorLabel} onChange={e => setNewSectorLabel(e.target.value)} className="flex-1 min-w-40"/>
                  <div className="flex gap-1">
                    {SECTOR_COLORS.map(c => (
                      <button key={c} onClick={() => setNewSectorColor(c)}
                        className={`w-7 h-7 rounded-full border-2 transition ${newSectorColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <Button onClick={addSector} className="gap-1"><Plus size={14}/>Criar</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Setores Existentes</CardTitle></CardHeader>
              <CardContent>
                <div className="divide-y">
                  {sectors.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-3 gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }}/>
                        <span className="text-sm font-medium">{s.label}</span>
                        {(s.key === 'spc' || s.key === 'comercial') && (
                          <Badge variant="outline" className="text-[10px]">Padrão</Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditSector(s)}><Edit2 size={13}/></Button>
                        {s.key !== 'spc' && s.key !== 'comercial' && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => deleteSector(s)}><Trash2 size={13}/></Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {sectors.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum setor encontrado.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* ─── QR Code Modal ─── */}
      <Dialog open={!!qrOpen} onOpenChange={o => !o && setQrOpen(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader><DialogTitle>Escaneie o QR Code</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-3 py-4">
            {qrOpen?.qr_code ? (
              <>
                <img src={qrOpen.qr_code} alt="QR Code" className="w-64 h-64 rounded-lg border bg-white p-2 object-contain"
                  onError={e => {
                    const img = e.currentTarget;
                    if (qrOpen?.qr_code && !img.src.includes('qrserver.com'))
                      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrOpen.qr_code)}`;
                  }}
                />
                <p className="text-xs font-medium text-green-600 animate-pulse">Aguardando leitura do QR Code...</p>
              </>
            ) : (
              <div className="w-64 h-64 flex flex-col items-center justify-center bg-muted rounded-lg gap-2">
                <QrCode size={64} className="text-muted-foreground/30 animate-pulse"/>
                <p className="text-xs text-muted-foreground">Gerando QR Code pela API Ryze...</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">WhatsApp → Dispositivos conectados → Vincular dispositivo</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Permissions Dialog ─── */}
      <Dialog open={!!permDialog} onOpenChange={o => !o && setPermDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield size={16}/>Permissões de Setores</DialogTitle>
            <p className="text-sm text-muted-foreground">{permDialog?.display_name || permDialog?.email}</p>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-xs text-muted-foreground mb-3">Selecione os setores que este usuário pode ver. Se nenhum for selecionado, o usuário terá acesso a todos.</p>
            {sectors.map(s => (
              <button key={s.key} onClick={() => togglePermSector(s.key)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border text-sm transition-all ${
                  permSectors.includes(s.key) ? 'border-purple-500 bg-purple-50' : 'border-border hover:bg-muted/50'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}/>
                  <span className="font-medium">{s.label}</span>
                </div>
                {permSectors.includes(s.key) && <Check size={16} className="text-purple-600"/>}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermDialog(null)}>Cancelar</Button>
            <Button onClick={savePermissions} className="gap-1"><Check size={14}/>Salvar Permissões</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Sector Dialog ─── */}
      <Dialog open={!!editSector} onOpenChange={o => !o && setEditSector(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Setor</DialogTitle></DialogHeader>
          {editSector && (
            <div className="space-y-3 py-2">
              <Input value={editSector.label} onChange={e => setEditSector({ ...editSector, label: e.target.value })} placeholder="Nome do setor"/>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Cor do setor</p>
                <div className="flex gap-2 flex-wrap">
                  {SECTOR_COLORS.map(c => (
                    <button key={c} onClick={() => setEditSector({ ...editSector, color: c })}
                      className={`w-8 h-8 rounded-full border-2 transition ${editSector.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSector(null)}>Cancelar</Button>
            <Button onClick={saveSector} className="gap-1"><Check size={14}/>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppAjustes;
