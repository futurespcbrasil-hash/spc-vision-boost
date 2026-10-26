import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Bot, Check, CircleAlert, GitBranch, Loader2, MessageSquareText, Plus, Save, Trash2, Users } from 'lucide-react';

type Instance = { id: string; name: string; status: string; phone: string | null };
type Agent = { user_id: string; display_name: string; email?: string | null };
type FlowOption = { id: string; key: string; label: string; target_label: string; target_user_id: string; reply_message: string };
type Flow = {
  id: string; instance_id: string; name: string; welcome_message: string; menu_message: string;
  fallback_message: string; options: FlowOption[]; is_active: boolean; created_at: string; updated_at: string;
};
const makeOption = (index: number): FlowOption => ({
  id: crypto.randomUUID(), key: String(index + 1), label: '', target_label: '', target_user_id: '', reply_message: 'Certo! Estamos encaminhando seu atendimento.',
});
const newFlow = (instanceId = ''): Omit<Flow, 'id' | 'created_at' | 'updated_at'> => ({
  instance_id: instanceId, name: 'Novo fluxo de atendimento',
  welcome_message: 'Olá! Bom dia, tudo bem? 😊\nSeja muito bem-vindo(a) à Future Soluções!',
  menu_message: 'Para agilizar seu atendimento, selecione uma opção:',
  fallback_message: 'Não consegui identificar sua opção. Digite o número de uma das opções do menu.',
  options: [makeOption(0), makeOption(1), makeOption(2)], is_active: false,
});

const WhatsAppFluxos = () => {
  const { user } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Omit<Flow, 'id' | 'created_at' | 'updated_at'> & { id?: string }>({ ...newFlow() });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [instanceResult, flowResult, agentResult] = await Promise.all([
        (supabase as any).from('whatsapp_instances').select('id,name,status,phone').order('created_at', { ascending: false }),
        (supabase as any).from('whatsapp_flows').select('*').order('created_at', { ascending: false }),
        supabase.rpc('get_assignable_users'),
      ]);
      if (instanceResult.error) throw instanceResult.error;
      if (flowResult.error) throw flowResult.error;
      setInstances((instanceResult.data || []) as Instance[]);
      setFlows((flowResult.data || []).map((f: any) => ({ ...f, options: Array.isArray(f.options) ? f.options : [] })) as Flow[]);
      if (!agentResult.error) setAgents((agentResult.data || []) as Agent[]);
    } catch (e) {
      toast.error('Não foi possível carregar os fluxos. Verifique se a migração do banco já foi aplicada e se seu perfil pode gerenciá-los.');
      console.error('[WhatsAppFluxos] load failed', e);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const activeCount = useMemo(() => flows.filter(f => f.is_active).length, [flows]);
  const chooseFlow = (flow: Flow) => {
    setSelectedId(flow.id);
    setDraft({
      id: flow.id, instance_id: flow.instance_id, name: flow.name,
      welcome_message: flow.welcome_message, menu_message: flow.menu_message,
      fallback_message: flow.fallback_message, options: flow.options.map((o, i) => ({ ...makeOption(i), ...o })),
      is_active: flow.is_active,
    });
  };
  const startNew = () => {
    const instanceId = instances[0]?.id || '';
    setSelectedId('');
    setDraft(newFlow(instanceId));
  };
  const updateDraft = (key: string, value: unknown) => setDraft(current => ({ ...current, [key]: value }));
  const updateOption = (id: string, key: keyof FlowOption, value: string) => {
    setDraft(current => ({ ...current, options: current.options.map(o => o.id === id ? { ...o, [key]: value } : o) }));
  };
  const addOption = () => setDraft(current => ({ ...current, options: [...current.options, makeOption(current.options.length)] }));
  const removeOption = (id: string) => setDraft(current => ({ ...current, options: current.options.filter(o => o.id !== id) }));
  const moveOption = (id: string, direction: -1 | 1) => setDraft(current => {
    const from = current.options.findIndex(o => o.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= current.options.length) return current;
    const options = [...current.options];
    [options[from], options[to]] = [options[to], options[from]];
    return { ...current, options: options.map((o, i) => ({ ...o, key: String(i + 1) })) };
  });

  const save = async () => {
    if (!draft.name.trim() || !draft.instance_id) { toast.error('Informe o nome do fluxo e selecione uma instância WhatsApp.'); return; }
    if (!draft.options.length) { toast.error('Adicione pelo menos uma opção ao menu.'); return; }
    if (draft.options.some(o => !o.label.trim() || !o.target_label.trim() || !o.target_user_id)) { toast.error('Preencha o texto, o setor e o responsável de todas as opções.'); return; }
    const keys = draft.options.map((o, i) => String(i + 1));
    const options = draft.options.map((o, i) => ({ ...o, key: keys[i], label: o.label.trim(), target_label: o.target_label.trim() }));
    setSaving(true);
    try {
      if (draft.is_active) {
        const { error: deactivateError } = await (supabase as any).from('whatsapp_flows').update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('instance_id', draft.instance_id).neq('id', draft.id || '00000000-0000-0000-0000-000000000000');
        if (deactivateError) throw deactivateError;
      }
      const payload = {
        instance_id: draft.instance_id, name: draft.name.trim(),
        welcome_message: draft.welcome_message, menu_message: draft.menu_message,
        fallback_message: draft.fallback_message, options, is_active: draft.is_active,
        updated_at: new Date().toISOString(),
      };
      const result = draft.id
        ? await (supabase as any).from('whatsapp_flows').update(payload).eq('id', draft.id).select('*').single()
        : await (supabase as any).from('whatsapp_flows').insert({ ...payload, created_by: user?.id }).select('*').single();
      if (result.error) throw result.error;
      toast.success('Fluxo salvo com sucesso.');
      await load();
      const saved = { ...result.data, options: Array.isArray(result.data.options) ? result.data.options : [] } as Flow;
      chooseFlow(saved);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível salvar o fluxo.');
    } finally { setSaving(false); }
  };

  const deleteFlow = async () => {
    if (!draft.id || !window.confirm('Excluir este fluxo? As sessões vinculadas também serão removidas.')) return;
    setDeleting(true);
    try {
      const { error } = await (supabase as any).from('whatsapp_flows').delete().eq('id', draft.id);
      if (error) throw error;
      toast.success('Fluxo excluído.');
      setSelectedId('');
      setDraft(newFlow(instances[0]?.id || ''));
      await load();
    } catch (e: any) { toast.error(e?.message || 'Não foi possível excluir o fluxo.'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><Bot className="h-7 w-7 text-primary" /><h1 className="text-2xl font-bold">Fluxos de atendimento</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">Crie menus automáticos para receber, classificar e direcionar conversas do WhatsApp.</p>
        </div>
        <Button onClick={startNew}><Plus className="mr-2 h-4 w-4" /> Novo fluxo</Button>
      </div>

      <Alert>
        <CircleAlert className="h-4 w-4" />
        <AlertDescription>Somente um fluxo pode ficar ativo por instância. Ao ativá-lo, o CRM envia o menu para novas conversas e direciona a escolha para o setor e responsável configurados. Conversas já assumidas por uma pessoa não devem ser interrompidas pelo bot.</AlertDescription>
      </Alert>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle className="flex items-center justify-between text-base">Seus fluxos <Badge variant="secondary">{flows.length}</Badge></CardTitle><CardDescription>{activeCount} fluxo(s) ativo(s)</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
              : flows.length === 0 ? <p className="py-6 text-sm text-muted-foreground">Nenhum fluxo criado. Clique em “Novo fluxo” para começar.</p>
              : flows.map(flow => {
                const instance = instances.find(i => i.id === flow.instance_id);
                return <button key={flow.id} onClick={() => chooseFlow(flow)} className={`w-full rounded-lg border p-3 text-left transition hover:bg-muted/50 ${selectedId === flow.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <div className="flex items-center justify-between gap-2"><span className="font-medium">{flow.name}</span><Badge variant={flow.is_active ? 'default' : 'secondary'}>{flow.is_active ? 'Ativo' : 'Inativo'}</Badge></div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{instance?.name || 'Instância não disponível'}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{flow.options.length} opções de menu</p>
                </button>;
              })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{draft.id ? 'Editar fluxo' : 'Criar fluxo'}</CardTitle>
            <CardDescription>Configure as mensagens, opções e para quem cada opção será encaminhada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Nome interno do fluxo</Label><Input value={draft.name} onChange={e => updateDraft('name', e.target.value)} placeholder="Ex.: Atendimento principal" /></div>
              <div className="space-y-2"><Label>Instância WhatsApp</Label>
                <Select value={draft.instance_id} onValueChange={value => updateDraft('instance_id', value)}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma instância" /></SelectTrigger>
                  <SelectContent>{instances.map(i => <SelectItem key={i.id} value={i.id}>{i.name} · {i.status === 'connected' ? 'Online' : i.status}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><Label className="font-semibold">Ativar fluxo</Label><p className="text-xs text-muted-foreground">O fluxo ativo responde a novas conversas desta instância.</p></div>
              <Switch checked={draft.is_active} onCheckedChange={value => updateDraft('is_active', value)} />
            </div>

            <div className="space-y-2"><Label>Mensagem de boas-vindas</Label><Textarea rows={3} value={draft.welcome_message} onChange={e => updateDraft('welcome_message', e.target.value)} /></div>
            <div className="space-y-2"><Label>Instrução do menu</Label><Textarea rows={2} value={draft.menu_message} onChange={e => updateDraft('menu_message', e.target.value)} /></div>

            <div className="space-y-3">
              <div className="flex items-center justify-between"><div><h3 className="font-semibold">Opções e direcionamento</h3><p className="text-xs text-muted-foreground">A numeração é gerada automaticamente pela ordem das opções.</p></div><Button variant="outline" size="sm" onClick={addOption}><Plus className="mr-1 h-4 w-4" /> Adicionar opção</Button></div>
              {draft.options.map((option, index) => <div key={option.id} className="space-y-3 rounded-xl border p-4">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Badge variant="secondary">{index + 1}</Badge><span className="font-medium">Opção do menu</span></div><div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => moveOption(option.id, -1)} aria-label="Mover opção para cima"><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" disabled={index === draft.options.length - 1} onClick={() => moveOption(option.id, 1)} aria-label="Mover opção para baixo"><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeOption(option.id)} aria-label="Remover opção"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div></div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1"><Label>Texto exibido ao cliente</Label><Input value={option.label} onChange={e => updateOption(option.id, 'label', e.target.value)} placeholder="Ex.: Financeiro - Contas a pagar" /></div>
                  <div className="space-y-1"><Label>Setor de destino</Label><Input value={option.target_label} onChange={e => updateOption(option.id, 'target_label', e.target.value)} placeholder="Ex.: Financeiro" /></div>
                  <div className="space-y-1"><Label>Responsável pelo atendimento</Label><Select value={option.target_user_id || 'none'} onValueChange={value => updateOption(option.id, 'target_user_id', value === 'none' ? '' : value)}><SelectTrigger><SelectValue placeholder="Selecione o responsável" /></SelectTrigger><SelectContent><SelectItem value="none">Selecione um responsável</SelectItem>{agents.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.display_name || a.email || a.user_id}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label>Resposta ao selecionar</Label><Input value={option.reply_message} onChange={e => updateOption(option.id, 'reply_message', e.target.value)} placeholder="Mensagem de confirmação" /></div>
                </div>
              </div>)}
            </div>

            <div className="space-y-2"><Label>Mensagem para opção inválida</Label><Textarea rows={2} value={draft.fallback_message} onChange={e => updateDraft('fallback_message', e.target.value)} /></div>

            <div className="rounded-xl bg-muted/50 p-4">
              <div className="mb-2 flex items-center gap-2 font-medium"><MessageSquareText className="h-4 w-4" /> Prévia do menu</div>
              <div className="whitespace-pre-wrap rounded-lg bg-background p-3 text-sm">{draft.welcome_message}{'\n\n'}{draft.menu_message}{'\n'}{draft.options.map((o, i) => `${i + 1} — ${o.label || 'Nome da opção'}`).join('\n')}{'\n\n'}Digite o número da opção desejada.</div>
            </div>

            <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
              <div>{draft.id && <Button variant="destructive" onClick={deleteFlow} disabled={deleting || saving}><Trash2 className="mr-2 h-4 w-4" />{deleting ? 'Excluindo...' : 'Excluir fluxo'}</Button>}</div>
              <div className="flex gap-2"><Button variant="outline" onClick={() => void load()} disabled={saving}>Cancelar alterações</Button><Button onClick={save} disabled={saving || loading}><Save className="mr-2 h-4 w-4" />{saving ? 'Salvando...' : 'Salvar fluxo'}</Button></div>
            </div>
          </CardContent>
        </Card>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-4 w-4" /> Cada opção encaminha a conversa para o setor e para o responsável selecionado. As opções ficam salvas no banco, não no navegador.</p>
    </div>
  );
};

export default WhatsAppFluxos;
