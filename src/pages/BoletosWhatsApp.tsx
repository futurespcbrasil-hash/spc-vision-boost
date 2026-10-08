import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase as typedSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ryze } from '@/services/ryzeService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Upload, FileText, Send, Eye, Pencil, Trash2, RefreshCw, Plus, Loader2, AlertTriangle } from 'lucide-react';

const supabase = typedSupabase as any;

type Boleto = {
  id: string; user_id: string; client_id: string | null; arquivo_path: string; arquivo_nome: string; arquivo_hash: string;
  nome_extraido: string | null; cpf_cnpj_extraido: string | null; valor: number | null; vencimento: string | null;
  nosso_numero: string | null; linha_digitavel: string | null; codigo_barras: string | null; numero_documento: string | null;
  data_emissao: string | null; banco: string | null; whatsapp: string | null; mensagem: string | null; match_info: string | null;
  status: string; api_message_id: string | null; api_resposta: string | null; enviado_em: string | null; erro: string | null; created_at: string;
};
type Cliente = { id: string; nome: string; razao_social: string | null; cpf_cnpj: string | null; whatsapp: string | null; email: string | null; observacoes: string | null };
type Template = { id: string; nome: string; mensagem: string; ativo: boolean };
type Log = { id: string; boleto_id: string; status: string; whatsapp: string | null; resposta: string | null; created_at: string };

const DEFAULT_TEMPLATE = `Olá, {nome}! Tudo bem?

Estamos encaminhando seu boleto referente à cobrança deste mês.

💰 Valor: {valor}
📅 Vencimento: {vencimento}

O boleto segue em anexo.

Qualquer dúvida, estamos à disposição.

Future Soluções`;

const STATUS: Record<string, { label: string; cls: string }> = {
  importado: { label: 'Importado', cls: 'bg-muted text-muted-foreground' },
  processando: { label: 'Processando', cls: 'bg-blue-100 text-blue-800' },
  processado: { label: 'Processado', cls: 'bg-blue-100 text-blue-800' },
  aguardando_revisao: { label: 'Em revisão', cls: 'bg-amber-100 text-amber-800' },
  pronto_envio: { label: 'Pronto', cls: 'bg-green-100 text-green-800' },
  enviando: { label: 'Enviando', cls: 'bg-blue-100 text-blue-800' },
  enviado: { label: 'Enviado', cls: 'bg-green-600 text-white' },
  erro: { label: 'Erro', cls: 'bg-red-100 text-red-800' },
  cancelado: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' },
};

const brl = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateBR = (d: string | null) => d ? d.split('-').reverse().join('/') : '—';
const dtBR = (d: string | null) => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const digits = (s: string | null | undefined) => (s || '').replace(/\D/g, '');
const fmtDoc = (s: string | null) => {
  const d = digits(s);
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return s || '—';
};
const fmtPhone = (s: string | null) => {
  let d = digits(s); if (!d) return '—';
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  return d.length === 11 ? d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : d.length === 10 ? d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3') : d;
};
const waNumber = (s: string | null) => { const d = digits(s); if (d.length < 10) return null; return d.startsWith('55') && d.length >= 12 ? d : '55' + d; };

async function sha256(file: File) {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function renderMensagem(tpl: string, b: Boleto, c?: Cliente | null) {
  const nome = c?.nome || b.nome_extraido || '';
  const vars: Record<string, string> = {
    nome, razao_social: c?.razao_social || b.nome_extraido || nome, cpf_cnpj: fmtDoc(c?.cpf_cnpj || b.cpf_cnpj_extraido),
    valor: brl(b.valor), vencimento: dateBR(b.vencimento), numero_documento: b.numero_documento || '', nosso_numero: b.nosso_numero || '',
  };
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

const FILTROS = [
  { key: 'todos', label: 'Todos' }, { key: 'pronto_envio', label: 'Prontos' }, { key: 'aguardando_revisao', label: 'Em revisão' },
  { key: 'sem_cliente', label: 'Sem cliente' }, { key: 'sem_whatsapp', label: 'Sem WhatsApp' }, { key: 'erro', label: 'Erro' }, { key: 'enviado', label: 'Já enviados' },
];

export default function BoletosWhatsApp() {
  const { user } = useAuth();
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [instances, setInstances] = useState<{ id: string; name: string; status: string; phone: string | null }[]>([]);
  const [instanceId, setInstanceId] = useState<string>(() => localStorage.getItem('boletos_instance') || '');
  const [templateId, setTemplateId] = useState<string>('');
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [review, setReview] = useState<Boleto | null>(null);
  const [preview, setPreview] = useState<Boleto | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState<Boleto[] | null>(null);
  const [sending, setSending] = useState<{ total: number; ok: number; err: number; done: number } | null>(null);
  const [clienteEdit, setClienteEdit] = useState<Partial<Cliente> | null>(null);
  const [tplEdit, setTplEdit] = useState<Partial<Template> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [b, c, t, l, i] = await Promise.all([
      supabase.from('boleto_envios').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(2000),
      supabase.from('boleto_clientes').select('*').eq('user_id', user.id).order('nome'),
      supabase.from('boleto_mensagem_templates').select('*').order('created_at'),
      supabase.from('boleto_envio_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1000),
      supabase.from('whatsapp_instances').select('id,name,status,phone').order('created_at'),
    ]);
    setBoletos(b.data || []); setClientes(c.data || []); setLogs(l.data || []); setInstances(i.data || []);
    let tpls: Template[] = t.data || [];
    if (!tpls.length) {
      const { data } = await supabase.from('boleto_mensagem_templates').insert({ nome: 'Padrão', mensagem: DEFAULT_TEMPLATE }).select();
      tpls = data || [];
    }
    setTemplates(tpls);
    setTemplateId((cur) => cur || tpls.find((x) => x.ativo)?.id || tpls[0]?.id || '');
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (instanceId) localStorage.setItem('boletos_instance', instanceId); }, [instanceId]);

  const clienteById = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c])), [clientes]);
  const template = templates.find((t) => t.id === templateId)?.mensagem || DEFAULT_TEMPLATE;

  const stats = useMemo(() => ({
    total: boletos.length,
    prontos: boletos.filter((b) => b.status === 'pronto_envio').length,
    revisao: boletos.filter((b) => b.status === 'aguardando_revisao').length,
    enviados: boletos.filter((b) => b.status === 'enviado').length,
    erros: boletos.filter((b) => b.status === 'erro').length,
    identificados: boletos.filter((b) => b.client_id).length,
  }), [boletos]);

  const filtrados = useMemo(() => boletos.filter((b) => {
    if (filtro === 'sem_cliente' && b.client_id) return false;
    if (filtro === 'sem_whatsapp' && (!b.client_id || b.whatsapp)) return false;
    if (['pronto_envio', 'aguardando_revisao', 'erro', 'enviado'].includes(filtro) && b.status !== filtro) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const c = b.client_id ? clienteById[b.client_id] : null;
      if (![b.arquivo_nome, b.nome_extraido, c?.nome, b.cpf_cnpj_extraido].some((x) => x?.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [boletos, filtro, busca, clienteById]);

  // ---------- Upload ----------
  const processar = async (id: string) => {
    const { error } = await supabase.functions.invoke('boletos-extrair', { body: { boleto_id: id } });
    if (error) console.error(error);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || !user) return;
    const pdfs = Array.from(files).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) return toast.error('Selecione arquivos PDF');
    setUploading({ done: 0, total: pdfs.length });
    const novos: string[] = []; let dup = 0;
    for (const f of pdfs) {
      try {
        if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name}: arquivo maior que 20MB`); continue; }
        const hash = await sha256(f);
        const existente = boletos.find((b) => b.arquivo_hash === hash && b.status !== 'cancelado');
        if (existente) {
          dup++;
          const msg = existente.status === 'enviado'
            ? `${f.name}: este boleto já foi enviado em ${dtBR(existente.enviado_em)}. Importado novamente apenas se confirmado.`
            : `${f.name}: este boleto já foi importado.`;
          if (!window.confirm(`⚠️ ${msg}\n\nDeseja importar mesmo assim?`)) continue;
        }
        const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.pdf`;
        const up = await supabase.storage.from('boletos').upload(path, f, { contentType: 'application/pdf' });
        if (up.error) throw up.error;
        const { data, error } = await supabase.from('boleto_envios').insert({ arquivo_path: path, arquivo_nome: f.name, arquivo_hash: hash, status: 'importado' }).select('id').single();
        if (error) throw error;
        novos.push(data.id);
      } catch (e: any) {
        toast.error(`${f.name}: ${e.message || 'falha no envio'}`);
      } finally {
        setUploading((u) => u && { ...u, done: u.done + 1 });
      }
    }
    setUploading(null);
    if (fileRef.current) fileRef.current.value = '';
    await load();
    if (novos.length) {
      toast.info(`Lendo ${novos.length} boleto(s)...`);
      // 3 por vez para não sobrecarregar a leitura
      for (let i = 0; i < novos.length; i += 3) {
        await Promise.all(novos.slice(i, i + 3).map(processar));
        await load();
      }
      toast.success('Leitura concluída. Confira os boletos.');
    } else if (dup) toast.warning('Nenhum boleto novo importado.');
  };

  // ---------- PDF ----------
  const openPdf = async (b: Boleto) => {
    setPdfUrl(null);
    const { data } = await supabase.storage.from('boletos').createSignedUrl(b.arquivo_path, 600);
    setPdfUrl(data?.signedUrl || null);
  };

  // ---------- Envio ----------
  const pedirEnvio = (lista: Boleto[]) => {
    if (!instanceId) return toast.error('Escolha o WhatsApp de envio na aba Configurações');
    const validos = lista.filter((b) => b.status === 'pronto_envio' && waNumber(b.whatsapp));
    if (!validos.length) return toast.error('Nenhum boleto pronto para envio');
    setConfirmSend(validos);
  };

  const jaEnviado = (b: Boleto) => boletos.find((o) => o.id !== b.id && o.status === 'enviado' && (
    o.arquivo_hash === b.arquivo_hash ||
    (o.client_id && o.client_id === b.client_id && o.valor === b.valor && o.vencimento === b.vencimento && (o.nosso_numero || '') === (b.nosso_numero || ''))
  ));

  const enviar = async (lista: Boleto[], forcar = false) => {
    setConfirmSend(null);
    cancelRef.current = false;
    setSending({ total: lista.length, ok: 0, err: 0, done: 0 });
    for (const b of lista) {
      if (cancelRef.current) break;
      const dup = jaEnviado(b);
      if (dup && !forcar) {
        await supabase.from('boleto_envios').update({ status: 'aguardando_revisao', match_info: `Possível duplicidade: boleto igual enviado em ${dtBR(dup.enviado_em)}` }).eq('id', b.id);
        setSending((s) => s && { ...s, err: s.err + 1, done: s.done + 1 });
        continue;
      }
      const c = b.client_id ? clienteById[b.client_id] : null;
      const msg = renderMensagem(template, b, c);
      const numero = waNumber(b.whatsapp)!;
      // trava: só envia se ainda estiver pronto (evita duplo envio em abas diferentes)
      const { data: lock } = await supabase.from('boleto_envios').update({ status: 'enviando', mensagem: msg }).eq('id', b.id).eq('status', 'pronto_envio').select('id');
      if (!lock?.length) { setSending((s) => s && { ...s, done: s.done + 1 }); continue; }
      try {
        const { data: signed, error: se } = await supabase.storage.from('boletos').createSignedUrl(b.arquivo_path, 60 * 60 * 24 * 3);
        if (se || !signed) throw new Error('Não foi possível gerar o link do PDF');
        const r: any = await ryze.sendMedia(instanceId, numero, signed.signedUrl, 'document', msg, 'application/pdf');
        const apiId = r?.wa_message_id || r?.messageId || r?.data?.messageId || null;
        await supabase.from('boleto_envios').update({ status: 'enviado', enviado_em: new Date().toISOString(), api_message_id: apiId, api_resposta: 'Mensagem enviada com sucesso', erro: null }).eq('id', b.id);
        await supabase.from('boleto_envio_logs').insert({ boleto_id: b.id, status: 'enviado', whatsapp: numero, resposta: 'Mensagem enviada com sucesso' });
        setSending((s) => s && { ...s, ok: s.ok + 1, done: s.done + 1 });
      } catch (e: any) {
        const m = e?.message || 'Falha no envio';
        await supabase.from('boleto_envios').update({ status: 'erro', erro: m, api_resposta: m }).eq('id', b.id);
        await supabase.from('boleto_envio_logs').insert({ boleto_id: b.id, status: 'erro', whatsapp: numero, resposta: m });
        setSending((s) => s && { ...s, err: s.err + 1, done: s.done + 1 });
      }
      // intervalo entre envios para evitar bloqueio
      await new Promise((r) => setTimeout(r, 4000 + Math.random() * 3000));
    }
    await load();
  };

  const reenviar = (b: Boleto) => {
    if (!window.confirm(`⚠️ Este boleto já foi enviado em ${dtBR(b.enviado_em)}.\n\nDeseja realmente reenviar?`)) return;
    supabase.from('boleto_envios').update({ status: 'pronto_envio' }).eq('id', b.id).then(async () => {
      await load();
      if (!instanceId) return toast.error('Escolha o WhatsApp de envio na aba Configurações');
      enviar([{ ...b, status: 'pronto_envio' }], true);
    });
  };

  const excluir = async (b: Boleto) => {
    if (b.status === 'enviado') return toast.error('Boletos enviados ficam no histórico e não podem ser excluídos');
    if (!window.confirm(`Excluir ${b.arquivo_nome}?`)) return;
    await supabase.storage.from('boletos').remove([b.arquivo_path]);
    await supabase.from('boleto_envios').delete().eq('id', b.id);
    load();
  };

  // ---------- Revisão ----------
  const salvarRevisao = async () => {
    if (!review) return;
    const ok = review.client_id && review.valor && review.vencimento && waNumber(review.whatsapp);
    const { error } = await supabase.from('boleto_envios').update({
      client_id: review.client_id, valor: review.valor, vencimento: review.vencimento, whatsapp: digits(review.whatsapp) || null,
      cpf_cnpj_extraido: review.cpf_cnpj_extraido, nome_extraido: review.nome_extraido,
      status: ok ? 'pronto_envio' : 'aguardando_revisao', match_info: ok ? 'Conferido manualmente' : 'Faltam dados: cliente, valor, vencimento ou WhatsApp', erro: null,
    }).eq('id', review.id);
    if (error) return toast.error(error.message);
    toast.success(ok ? 'Boleto pronto para envio' : 'Salvo, ainda com pendências');
    setReview(null); load();
  };

  const salvarCliente = async () => {
    if (!clienteEdit?.nome?.trim()) return toast.error('Informe o nome');
    const payload = {
      nome: clienteEdit.nome.trim().slice(0, 200), razao_social: clienteEdit.razao_social?.trim() || null,
      cpf_cnpj: digits(clienteEdit.cpf_cnpj) || null, whatsapp: digits(clienteEdit.whatsapp) || null,
      email: clienteEdit.email?.trim() || null, observacoes: clienteEdit.observacoes?.trim() || null,
    };
    const q = clienteEdit.id ? supabase.from('boleto_clientes').update(payload).eq('id', clienteEdit.id) : supabase.from('boleto_clientes').insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    setClienteEdit(null); load();
  };

  const salvarTemplate = async () => {
    if (!tplEdit?.nome?.trim() || !tplEdit?.mensagem?.trim()) return toast.error('Preencha nome e mensagem');
    const payload = { nome: tplEdit.nome.trim(), mensagem: tplEdit.mensagem };
    const q = tplEdit.id ? supabase.from('boleto_mensagem_templates').update(payload).eq('id', tplEdit.id) : supabase.from('boleto_mensagem_templates').insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    setTplEdit(null); load();
  };

  const prontos = boletos.filter((b) => b.status === 'pronto_envio');
  const inst = instances.find((i) => i.id === instanceId);
  const instOnline = inst && ['connected', 'open', 'online', 'conectado'].includes(String(inst.status).toLowerCase());
  const mesRef = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Boletos WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Importe os PDFs, confira os dados e envie os boletos aos clientes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCw size={16} className="mr-2" />Atualizar</Button>
          <Button onClick={() => pedirEnvio(prontos)} disabled={!!sending || !prontos.length} className="bg-green-600 hover:bg-green-700 text-white">
            <Send size={16} className="mr-2" />Enviar boletos ({prontos.length})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[['Boletos importados', stats.total], ['Prontos para envio', stats.prontos], ['Em revisão', stats.revisao], ['Enviados', stats.enviados], ['Erros', stats.erros]].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="text-2xl font-bold mt-1">{v}</div>
          </div>
        ))}
      </div>

      {sending && (
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex justify-between text-sm font-medium">
            <span>{sending.done < sending.total ? 'Enviando boletos...' : 'Envio concluído'}</span>
            <span>{Math.round((sending.done / sending.total) * 100)}%</span>
          </div>
          <Progress value={(sending.done / sending.total) * 100} />
          <div className="text-xs text-muted-foreground flex gap-4">
            <span>Enviados: {sending.ok}</span><span>Pendentes: {sending.total - sending.done}</span><span>Erros: {sending.err}</span>
          </div>
          <div className="flex gap-2">
            {sending.done < sending.total
              ? <Button size="sm" variant="outline" onClick={() => { cancelRef.current = true; }}>Parar fila</Button>
              : <Button size="sm" variant="outline" onClick={() => setSending(null)}>Fechar</Button>}
          </div>
        </div>
      )}

      <Tabs defaultValue="conferencia">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="importar">Importar</TabsTrigger>
          <TabsTrigger value="conferencia">Conferência</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="importar" className="space-y-4">
          <div onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
            className="cursor-pointer rounded-xl border-2 border-dashed p-10 text-center hover:bg-muted/40 transition">
            <Upload className="mx-auto mb-3 text-primary" size={36} />
            <div className="font-semibold">Clique ou arraste os PDFs dos boletos</div>
            <div className="text-sm text-muted-foreground">Você pode selecionar vários arquivos de uma vez (até 20MB cada).</div>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          </div>
          {uploading && (
            <div className="rounded-xl border p-4 space-y-2">
              <div className="text-sm">Enviando arquivos {uploading.done}/{uploading.total}</div>
              <Progress value={(uploading.done / uploading.total) * 100} />
            </div>
          )}
          <div className="rounded-xl border bg-card p-4 text-sm">
            <div className="font-semibold capitalize mb-1">Boletos de {mesRef}</div>
            <div className="text-muted-foreground space-y-0.5">
              <div>{stats.total} importados</div><div>{stats.identificados} identificados</div><div>{stats.enviados} enviados</div>
              <div>{stats.revisao} em revisão</div><div>{stats.erros} com erro</div>
            </div>
          </div>
          {!clientes.length && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex gap-2">
              <AlertTriangle size={18} /> Cadastre seus clientes na aba Clientes (com CPF/CNPJ e WhatsApp) para os boletos serem identificados automaticamente.
            </div>
          )}
        </TabsContent>

        <TabsContent value="conferencia" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            {FILTROS.map((f) => (
              <Button key={f.key} size="sm" variant={filtro === f.key ? 'default' : 'outline'} onClick={() => setFiltro(f.key)}>{f.label}</Button>
            ))}
            <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs ml-auto" />
          </div>
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead><TableHead>Cliente</TableHead><TableHead>CPF/CNPJ</TableHead>
                  <TableHead className="text-right">Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>WhatsApp</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum boleto</TableCell></TableRow>}
                {filtrados.map((b) => {
                  const c = b.client_id ? clienteById[b.client_id] : null;
                  const st = STATUS[b.status] || STATUS.importado;
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="max-w-[200px]">
                        <div className="flex items-center gap-1.5 truncate"><FileText size={14} className="shrink-0" /><span className="truncate">{b.arquivo_nome}</span></div>
                        {(b.match_info || b.erro) && <div className="text-[11px] text-muted-foreground truncate" title={b.erro || b.match_info || ''}>{b.erro || b.match_info}</div>}
                      </TableCell>
                      <TableCell>{c?.nome || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDoc(c?.cpf_cnpj || b.cpf_cnpj_extraido)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{brl(b.valor)}</TableCell>
                      <TableCell>{dateBR(b.vencimento)}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtPhone(b.whatsapp)}</TableCell>
                      <TableCell><Badge className={`${st.cls} border-0`}>{b.status === 'processando' && <Loader2 size={12} className="mr-1 animate-spin" />}{st.label}</Badge></TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" title="Ver mensagem" onClick={() => { setPreview(b); openPdf(b); }}><Eye size={16} /></Button>
                        {b.status !== 'enviado' && <Button size="icon" variant="ghost" title="Revisar" onClick={() => { setReview({ ...b }); openPdf(b); }}><Pencil size={16} /></Button>}
                        {['erro', 'importado'].includes(b.status) && <Button size="icon" variant="ghost" title="Ler novamente" onClick={async () => { await processar(b.id); load(); }}><RefreshCw size={16} /></Button>}
                        {b.status === 'pronto_envio' && <Button size="icon" variant="ghost" title="Enviar" onClick={() => pedirEnvio([b])}><Send size={16} /></Button>}
                        {b.status === 'enviado' && <Button size="sm" variant="ghost" onClick={() => reenviar(b)}>Reenviar</Button>}
                        {b.status !== 'enviado' && <Button size="icon" variant="ghost" title="Excluir" onClick={() => excluir(b)}><Trash2 size={16} /></Button>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="historico">
          <div className="space-y-2">
            {logs.length === 0 && <div className="text-center text-muted-foreground py-8">Nenhum envio registrado</div>}
            {logs.map((l) => {
              const b = boletos.find((x) => x.id === l.boleto_id);
              const c = b?.client_id ? clienteById[b.client_id] : null;
              return (
                <div key={l.id} className="rounded-xl border bg-card p-4 text-sm grid md:grid-cols-4 gap-2">
                  <div><div className="font-semibold">{c?.nome || b?.nome_extraido || b?.arquivo_nome || '—'}</div><div className="text-muted-foreground text-xs">{b?.arquivo_nome}</div></div>
                  <div>Valor: {brl(b?.valor ?? null)}<br />Vencimento: {dateBR(b?.vencimento ?? null)}</div>
                  <div>WhatsApp: {fmtPhone(l.whatsapp)}<br />Data: {dtBR(l.created_at)}</div>
                  <div>{l.status === 'enviado' ? <span className="text-green-700 font-medium">✅ Enviado</span> : <span className="text-red-700 font-medium">❌ Falha no envio</span>}<div className="text-xs text-muted-foreground">{l.resposta}</div></div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="clientes" className="space-y-3">
          <Button onClick={() => setClienteEdit({})}><Plus size={16} className="mr-2" />Novo cliente</Button>
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Razão social</TableHead><TableHead>CPF/CNPJ</TableHead><TableHead>WhatsApp</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {clientes.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum cliente cadastrado</TableCell></TableRow>}
                {clientes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.nome}</TableCell><TableCell>{c.razao_social || '—'}</TableCell><TableCell>{fmtDoc(c.cpf_cnpj)}</TableCell><TableCell>{fmtPhone(c.whatsapp)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => setClienteEdit(c)}><Pencil size={16} /></Button>
                      <Button size="icon" variant="ghost" onClick={async () => { if (window.confirm(`Excluir ${c.nome}?`)) { await supabase.from('boleto_clientes').delete().eq('id', c.id); load(); } }}><Trash2 size={16} /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="modelos" className="space-y-3">
          <div className="flex gap-2 items-center flex-wrap">
            <Label>Modelo usado no envio:</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
              <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setTplEdit({ nome: '', mensagem: DEFAULT_TEMPLATE })}><Plus size={16} className="mr-2" />Novo modelo</Button>
          </div>
          <div className="text-xs text-muted-foreground">Variáveis: {'{nome} {razao_social} {cpf_cnpj} {valor} {vencimento} {numero_documento} {nosso_numero}'}</div>
          <div className="grid md:grid-cols-2 gap-3">
            {templates.map((t) => (
              <div key={t.id} className="rounded-xl border bg-card p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-semibold">{t.nome}</div>
                  <div><Button size="icon" variant="ghost" onClick={() => setTplEdit(t)}><Pencil size={16} /></Button>
                    {templates.length > 1 && <Button size="icon" variant="ghost" onClick={async () => { await supabase.from('boleto_mensagem_templates').delete().eq('id', t.id); if (templateId === t.id) setTemplateId(''); load(); }}><Trash2 size={16} /></Button>}</div>
                </div>
                <pre className="whitespace-pre-wrap text-sm font-sans text-muted-foreground">{t.mensagem}</pre>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-3">
          <div className="rounded-xl border bg-card p-4 space-y-3 max-w-xl">
            <div className="font-semibold">Integração WhatsApp</div>
            <div className="text-sm">Status: {inst ? (instOnline ? '🟢 Conectado' : `🟡 ${inst.status}`) : '🔴 Não configurado'}</div>
            <div className="space-y-1">
              <Label>WhatsApp usado para enviar os boletos</Label>
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{instances.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}{i.phone ? ` · ${fmtPhone(i.phone)}` : ''} ({i.status})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Usa a mesma conexão da Central de WhatsApp. Para conectar um número novo, vá em WhatsApp → Ajustes. Os dados de acesso ficam protegidos no servidor.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Revisão */}
      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>Revisar boleto · {review?.arquivo_nome}</DialogTitle></DialogHeader>
          {review && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="h-[60vh] rounded border bg-muted">{pdfUrl ? <iframe src={pdfUrl} className="w-full h-full rounded" title="PDF" /> : <div className="p-4 text-sm">Carregando PDF...</div>}</div>
              <div className="space-y-3 text-sm overflow-y-auto max-h-[60vh]">
                <div className="rounded border p-3 bg-muted/40 space-y-0.5">
                  <div className="font-medium">Dados lidos do boleto</div>
                  <div>Pagador: {review.nome_extraido || '—'}</div><div>CPF/CNPJ: {fmtDoc(review.cpf_cnpj_extraido)}</div>
                  <div>Nosso número: {review.nosso_numero || '—'} · Documento: {review.numero_documento || '—'}</div>
                  <div>Banco: {review.banco || '—'} · Emissão: {dateBR(review.data_emissao)}</div>
                  <div className="break-all">Linha digitável: {review.linha_digitavel || '—'}</div>
                  {review.match_info && <div className="text-amber-700">{review.match_info}</div>}
                </div>
                <div className="space-y-1">
                  <Label>Cliente</Label>
                  <Select value={review.client_id || ''} onValueChange={(v) => { const c = clienteById[v]; setReview({ ...review, client_id: v, whatsapp: c?.whatsapp || review.whatsapp }); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                    <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}{c.cpf_cnpj ? ` · ${fmtDoc(c.cpf_cnpj)}` : ''}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={review.valor ?? ''} onChange={(e) => setReview({ ...review, valor: e.target.value ? Number(e.target.value) : null })} /></div>
                  <div className="space-y-1"><Label>Vencimento</Label><Input type="date" value={review.vencimento ?? ''} onChange={(e) => setReview({ ...review, vencimento: e.target.value || null })} /></div>
                </div>
                <div className="space-y-1"><Label>WhatsApp</Label><Input value={review.whatsapp ?? ''} onChange={(e) => setReview({ ...review, whatsapp: e.target.value })} placeholder="(54) 99999-9999" /></div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setReview(null)}>Cancelar</Button><Button onClick={salvarRevisao}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualização */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Mensagem que será enviada</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-3 text-sm">
              {preview.status === 'enviado' && <div className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">⚠️ Este boleto já foi enviado em {dtBR(preview.enviado_em)}.</div>}
              <pre className="whitespace-pre-wrap font-sans rounded-lg bg-muted p-3">{preview.mensagem && preview.status === 'enviado' ? preview.mensagem : renderMensagem(template, preview, preview.client_id ? clienteById[preview.client_id] : null)}</pre>
              <div><b>Para:</b> {fmtPhone(preview.whatsapp)}</div>
              <div><b>Arquivo anexado:</b> {pdfUrl ? <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-primary underline">{preview.arquivo_nome}</a> : preview.arquivo_nome}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação */}
      <AlertDialog open={!!confirmSend} onOpenChange={(o) => !o && setConfirmSend(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>Você está prestes a enviar:<br /><br />
                <b>{confirmSend?.length} boletos</b><br />
                <b>{new Set(confirmSend?.map((b) => b.client_id)).size} clientes</b><br />
                <b>{confirmSend?.length} mensagens</b><br /><br />
                Pelo WhatsApp: {inst?.name}. Os envios são feitos um por vez, com intervalo de alguns segundos. Deseja continuar?</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmSend && enviar(confirmSend)}>Enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cliente */}
      <Dialog open={!!clienteEdit} onOpenChange={(o) => !o && setClienteEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{clienteEdit?.id ? 'Editar cliente' : 'Novo cliente'}</DialogTitle></DialogHeader>
          {clienteEdit && (
            <div className="space-y-2">
              {(['nome', 'razao_social', 'cpf_cnpj', 'whatsapp', 'email'] as const).map((k) => (
                <div key={k} className="space-y-1">
                  <Label>{{ nome: 'Nome *', razao_social: 'Razão social', cpf_cnpj: 'CPF/CNPJ', whatsapp: 'WhatsApp', email: 'E-mail' }[k]}</Label>
                  <Input value={(clienteEdit[k] as string) || ''} maxLength={200} onChange={(e) => setClienteEdit({ ...clienteEdit, [k]: e.target.value })} />
                </div>
              ))}
              <div className="space-y-1"><Label>Observações</Label><Textarea value={clienteEdit.observacoes || ''} maxLength={1000} onChange={(e) => setClienteEdit({ ...clienteEdit, observacoes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setClienteEdit(null)}>Cancelar</Button><Button onClick={salvarCliente}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modelo */}
      <Dialog open={!!tplEdit} onOpenChange={(o) => !o && setTplEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modelo de mensagem</DialogTitle></DialogHeader>
          {tplEdit && (
            <div className="space-y-2">
              <div className="space-y-1"><Label>Nome</Label><Input value={tplEdit.nome || ''} onChange={(e) => setTplEdit({ ...tplEdit, nome: e.target.value })} /></div>
              <div className="space-y-1"><Label>Mensagem</Label><Textarea rows={12} value={tplEdit.mensagem || ''} onChange={(e) => setTplEdit({ ...tplEdit, mensagem: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setTplEdit(null)}>Cancelar</Button><Button onClick={salvarTemplate}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
