import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { waha } from '@/services/ryzeService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Paperclip, Search, User, RefreshCw, Loader2, Copy, MessageCircle, CheckCircle2, Phone } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

type Instance = { id: string; name: string; status: string; phone: string | null; provider_instance_name?: string | null };
type Chat = {
  id: string; instance_id: string; wa_chat_id: string; contact_number: string;
  contact_name: string; avatar_url: string | null; last_message: string | null;
  last_message_at: string | null; unread_count: number; is_group: boolean;
};
type Message = {
  id: string; chat_id: string; instance_id: string; wa_message_id: string | null;
  from_me: boolean; message_type: string; text: string | null; media_filename: string | null;
  status: string | null; timestamp: string; error?: string | null;
};

const timeLabel = (value?: string | null) => value
  ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
const fullTimeLabel = (value?: string | null) => value
  ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
const numberLabel = (chat: Chat) => chat.is_group ? chat.wa_chat_id : (chat.contact_number || chat.wa_chat_id);
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Erro inesperado na integração WhatsApp';
const onlyDigits = (value: string) => value.replace(/\D/g, '');
const normalizeBrazilNumber = (value: string) => {
  const digits = onlyDigits(value);
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
};
const isPhoneNumber = (value: string) => {
  const digits = onlyDigits(value);
  return digits.length >= 10 && digits.length <= 13;
};
const renderMessageText = (text: string, onPhoneClick: (number: string) => void) => {
  const tokenRegex = /https?:\/\/[^\s]+|www\.[^\s]+|(?<!\d)\+?(?:55[ \t().-]*)?\(?\d{2}\)?[ \t.-]*\d{4,5}[ \t.-]?\d{4}(?!\d)/gi;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(tokenRegex)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));
    if (/^(https?:\/\/|www\.)/i.test(token)) {
      const href = token.startsWith('http') ? token : `https://${token}`;
      nodes.push(<a key={`url-${index}`} href={href} target="_blank" rel="noreferrer" className="underline break-all text-blue-600 dark:text-blue-400">{token}</a>);
    } else if (isPhoneNumber(token)) {
      nodes.push(<button key={`phone-${index}`} type="button" onClick={() => onPhoneClick(onlyDigits(token))} className="inline underline decoration-dotted text-blue-600 dark:text-blue-400 hover:opacity-80">{token}</button>);
    } else {
      nodes.push(token);
    }
    lastIndex = index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
};

export default function WhatsAppConversas() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [instanceId, setInstanceId] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [numberDialogOpen, setNumberDialogOpen] = useState(false);
  const [actionNumber, setActionNumber] = useState('');
  const [checkingNumber, setCheckingNumber] = useState(false);
  const [numberVerified, setNumberVerified] = useState<boolean | null>(null);
  const [firstMessage, setFirstMessage] = useState('');
  const [startingNumberChat, setStartingNumberChat] = useState(false);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const pendingInitialScrollRef = useRef(true);
  const activeChatIdRef = useRef('');
  const selectedChatRef = useRef<Chat | null>(null);
  const messageLoadSequenceRef = useRef(0);
  const sendLockRef = useRef(false);
  const scrollMessagesToBottom = useCallback((force = false) => {
    if (!force && !stickToBottomRef.current) return;
    // A lista pode mudar de altura depois do primeiro paint (texto, mídia, fonte).
    // Recalcula o fim em dois frames e usa o scroll container real, não a página.
    const scroll = () => {
      const viewport = messagesViewportRef.current;
      if (!viewport || (!force && !stickToBottomRef.current)) return;
      viewport.scrollTop = viewport.scrollHeight;
      if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ block: 'end', behavior: 'auto' });
      viewport.scrollTop = viewport.scrollHeight;
    };
    requestAnimationFrame(() => {
      scroll();
      requestAnimationFrame(scroll);
    });
  }, []);

  const selectedChat = useMemo(() => chats.find((chat) => chat.id === selectedChatId) || null, [chats, selectedChatId]);
  selectedChatRef.current = selectedChat;
  const selectedInstance = useMemo(() => instances.find((item) => item.id === instanceId) || null, [instances, instanceId]);
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase();
    return chats.filter((chat) => !q || (chat.contact_name || '').toLocaleLowerCase().includes(q)
      || (chat.contact_number || '').includes(q) || chat.wa_chat_id.toLocaleLowerCase().includes(q));
  }, [chats, searchTerm]);

  const loadInstances = useCallback(async () => {
    if (!user) return;
    const { data, error } = await (supabase as any).from('whatsapp_instances')
      .select('id,name,status,phone,provider,provider_instance_name')
      .eq('owner_id', user.id).order('created_at', { ascending: false });
    if (error) throw error;
    const available = (data || []) as Instance[];
    setInstances(available);
    setInstanceId((current) => {
      if (current && available.some((item) => item.id === current)) return current;
      const saved = localStorage.getItem(`whatsapp_conversas_instance:${user.id}`);
      if (saved && available.some((item) => item.id === saved)) return saved;
      return available.find((item) => item.provider_instance_name && item.status === 'connected')?.id
        || available.find((item) => item.provider_instance_name)?.id || available[0]?.id || '';
    });
  }, [user]);

  const loadChats = useCallback(async (refreshRemote = false) => {
    if (!instanceId) { setChats([]); setSelectedChatId(''); setMessages([]); return; }
    setLoading(true);
    try {
      if (refreshRemote) {
        const response: any = await waha.getChats(instanceId);
        if (response?.error) throw new Error(String(response.error));
      }
      const { data, error } = await (supabase as any).from('whatsapp_chats').select('*')
        .eq('instance_id', instanceId).order('last_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      const rows = (data || []) as Chat[];
      setChats(rows);
      setSelectedChatId((current) => rows.some((item) => item.id === current) ? current : rows[0]?.id || '');
    } catch (e) {
      toast.error('Não foi possível carregar as conversas: ' + errorText(e));
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  const loadMessages = useCallback(async (chat: Chat, refreshRemote = true) => {
    const loadSequence = ++messageLoadSequenceRef.current;
    setLoadingMessages(true);
    try {
      if (refreshRemote) {
        const response: any = await waha.getMessages(chat.instance_id, chat.wa_chat_id);
        if (response?.error) throw new Error(String(response.error));
      }
      // Buscar as 500 mensagens MAIS RECENTES. Limitar depois de ordenar ascendente
      // trazia as 500 mais antigas e fazia o chat parecer começar no início do histórico.
      const { data, error } = await (supabase as any).from('whatsapp_messages').select('*')
        .eq('instance_id', chat.instance_id).eq('chat_id', chat.id)
        .order('timestamp', { ascending: false }).order('id', { ascending: false }).limit(500);
      if (error) throw error;
      // Uma resposta atrasada de outra conversa não pode substituir o chat atualmente aberto.
      if (loadSequence !== messageLoadSequenceRef.current || activeChatIdRef.current !== chat.id) return;
      // A consulta vem do mais recente para o mais antigo; renderizar em ordem cronológica.
      setMessages(((data || []) as Message[]).reverse());
      await (supabase as any).from('whatsapp_chats').update({ unread_count: 0 }).eq('id', chat.id);
      setChats((current) => current.map((item) => item.id === chat.id ? { ...item, unread_count: 0 } : item));
    } catch (e) {
      if (loadSequence === messageLoadSequenceRef.current) toast.error('Não foi possível carregar as mensagens: ' + errorText(e));
    } finally {
      if (loadSequence === messageLoadSequenceRef.current) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => { void loadInstances().catch((e) => toast.error('Falha ao carregar instâncias: ' + errorText(e))); }, [loadInstances]);
  useEffect(() => { void loadChats(false); }, [instanceId, loadChats]);

  useEffect(() => {
    if (instanceId && user) localStorage.setItem(`whatsapp_conversas_instance:${user.id}`, instanceId);
  }, [instanceId, user?.id]);

  // Atualização em tempo real; as políticas RLS limitam os eventos às conversas do proprietário.
  useEffect(() => {
    if (!instanceId || !user) return;
    const channel = supabase.channel(`whatsapp-conversas-${user.id}-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats', filter: `instance_id=eq.${instanceId}` },
        () => { void loadChats(false); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `instance_id=eq.${instanceId}` },
        () => { const current = selectedChatRef.current; if (current) void loadMessages(current, false); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [instanceId, user?.id, loadChats, loadMessages]);

  // Fallback para buscar atualizações da WAHA caso um webhook/evento Realtime se perca.
  useEffect(() => {
    if (!instanceId) return;
    const interval = window.setInterval(() => {
      void loadChats(true);
      const current = selectedChatRef.current;
      if (current) void loadMessages(current, true);
    }, 30000);
    return () => window.clearInterval(interval);
  }, [instanceId, loadChats, loadMessages]);

  useEffect(() => {
    activeChatIdRef.current = selectedChatId;
    pendingInitialScrollRef.current = true;
    stickToBottomRef.current = true;
    messageLoadSequenceRef.current += 1;
  }, [selectedChatId]);

  // Primeiro carregamento da conversa sempre termina no fim. Depois, só acompanha
  // novas mensagens se o usuário já estava no fim; scroll manual para cima é respeitado.
  useLayoutEffect(() => {
    if (loadingMessages && pendingInitialScrollRef.current) return;
    if (pendingInitialScrollRef.current) {
      stickToBottomRef.current = true;
      scrollMessagesToBottom(true);
      pendingInitialScrollRef.current = false;
      return;
    }
    // Mensagens recém-enviadas ou recebidas: se o usuário estava no fim,
    // acompanha a última mensagem; se rolou para cima para ler, não o sequestra.
    scrollMessagesToBottom();
  }, [messages, loadingMessages, selectedChatId, scrollMessagesToBottom]);

  useEffect(() => {
    if (selectedChat) void loadMessages(selectedChat, true);
    else { setMessages([]); setLoadingMessages(false); }
  }, [selectedChatId, loadMessages]);

  const openNumberActions = (number: string) => {
    const digits = onlyDigits(number);
    // Nunca abrir ações para uma sequência concatenada ou um identificador de grupo.
    if (digits.length < 10 || digits.length > 13) {
      toast.error('O texto selecionado não é um telefone válido. Confira se o número está separado de outros dígitos.');
      return;
    }
    setActionNumber(normalizeBrazilNumber(digits));
    setNumberVerified(null);
    setFirstMessage('');
    setNumberDialogOpen(true);
  };

  const copyActionNumber = async () => {
    try {
      await navigator.clipboard.writeText(actionNumber);
      toast.success('Número copiado.');
    } catch {
      toast.error('Não foi possível copiar o número neste navegador.');
    }
  };

  const verifyActionNumber = async () => {
    if (!instanceId || !selectedInstance || selectedInstance.status !== 'connected') {
      toast.error('Conecte sua instância WhatsApp antes de verificar um número.');
      return;
    }
    const normalized = normalizeBrazilNumber(actionNumber);
    if (!isPhoneNumber(normalized)) {
      toast.error('Informe um número de telefone válido, incluindo DDD.');
      return;
    }
    setCheckingNumber(true);
    setNumberVerified(null);
    try {
      const result: any = await waha.checkNumber(instanceId, normalized);
      const exists = result?.exists === true || result?.numberExists === true || result?.number_exists === true
        || result?.result?.exists === true || result?.result?.numberExists === true || result?.result?.number_exists === true
        || (Array.isArray(result) && result.some((item: any) => item?.exists === true || item?.numberExists === true))
        || (Array.isArray(result?.results) && result.results.some((item: any) => item?.exists === true || item?.numberExists === true));
      setNumberVerified(exists);
      if (exists) toast.success('Este número tem WhatsApp. Você já pode iniciar a conversa.');
      else toast.error('Não foi encontrada uma conta WhatsApp para este número.');
    } catch (e) {
      toast.error('Não foi possível verificar o número: ' + errorText(e));
    } finally {
      setCheckingNumber(false);
    }
  };

  const startNumberConversation = async () => {
    if (!instanceId || !selectedInstance || !numberVerified || !firstMessage.trim() || startingNumberChat) return;
    setStartingNumberChat(true);
    try {
      await waha.sendText(instanceId, normalizeBrazilNumber(actionNumber), firstMessage.trim());
      setNumberDialogOpen(false);
      setFirstMessage('');
      await loadChats(true);
      toast.success('Mensagem enviada. A conversa será exibida na sua lista após a sincronização.');
    } catch (e) {
      toast.error('Falha ao iniciar conversa: ' + errorText(e));
    } finally {
      setStartingNumberChat(false);
    }
  };

  const refresh = async () => {
    try {
      if (instanceId) await loadChats(true);
      else await loadInstances();
      toast.success('Conversas atualizadas.');
    } catch (e) { toast.error(errorText(e)); }
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text || !selectedChat || !selectedInstance || sending || sendLockRef.current) return;
    if (!selectedInstance.provider_instance_name) {
      toast.error('Esta conta ainda não está vinculada a uma sessão WAHA. Selecione a instância WAHA correta.');
      return;
    }

    // O waha-proxy já persiste a mensagem enviada. Não gravar novamente pelo
    // frontend: isso criava duas linhas para o mesmo envio (uma vinculada e outra não).
    sendLockRef.current = true;
    stickToBottomRef.current = true;
    setSending(true);
    try {
      await waha.sendText(instanceId, selectedChat.wa_chat_id || selectedChat.contact_number, text);
      setMessage('');

      // A Edge Function persiste o envio. Recarregamos apenas o histórico da
      // conversa atual e mantemos a lista/seleção estáveis para não remontar o chat.
      await loadMessages(selectedChat, false);
      setChats((current) => current.map((item) => item.id === selectedChat.id
        ? { ...item, last_message: text, last_message_at: new Date().toISOString() }
        : item));
      stickToBottomRef.current = true;
      scrollMessagesToBottom(true);
      toast.success('Mensagem enviada.');
    } catch (e) {
      toast.error('Falha ao enviar mensagem: ' + errorText(e));
    } finally {
      sendLockRef.current = false;
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conversas WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Mensagens reais sincronizadas com a WAHA.</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedInstance && <Badge variant="outline">{selectedInstance.name}{selectedInstance.status === 'connected' ? ' · Conectada' : ''}</Badge>}
          <Button variant="outline" onClick={refresh} disabled={loading} aria-label="Atualizar conversas" title="Atualizar agora">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </Button>
        </div>
      </div>

      {!instances.length && <Card className="p-6 text-sm text-muted-foreground">Nenhuma conta WhatsApp cadastrada para este usuário. Configure uma instância na área WhatsApp antes de abrir as conversas.</Card>}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-4 h-[calc(100vh-220px)] min-h-[480px]">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b p-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar conversa..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {!loading && filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa sincronizada. A lista será atualizada automaticamente quando houver novas conversas.</p>}
            {filtered.filter((chat) => chat.wa_chat_id !== 'status@broadcast' && !chat.wa_chat_id.endsWith('@newsletter')).map((chat) => (
              <button key={chat.id} onClick={() => setSelectedChatId(chat.id)}
                className={'w-full flex items-start gap-3 p-3 text-left border-b transition-colors hover:bg-muted/50 ' + (selectedChatId === chat.id ? 'bg-muted' : '')}>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-foreground truncate">{chat.contact_name || numberLabel(chat)}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{timeLabel(chat.last_message_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{chat.last_message || 'Sem mensagem recente'}</p>
                  <span className="text-[10px] text-muted-foreground">{numberLabel(chat)}</span>
                </div>
                {chat.unread_count > 0 && <Badge className="bg-green-600 text-[10px] h-5 min-w-5 flex items-center justify-center p-0 rounded-full">{chat.unread_count}</Badge>}
              </button>
            ))}
          </ScrollArea>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden">
          {selectedChat ? <>
            <div className="p-3 border-b flex items-center justify-between gap-3 bg-muted/30">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{selectedChat.contact_name || numberLabel(selectedChat)}</p>
                <p className="text-xs text-muted-foreground">{numberLabel(selectedChat)}</p>
              </div>
              <Badge variant="outline">{selectedChat.is_group ? 'Grupo' : selectedInstance?.status === 'connected' ? 'WhatsApp conectado' : selectedInstance?.status || 'Conta'}</Badge>
            </div>
            <div ref={messagesViewportRef} onScroll={(event) => {
              const viewport = event.currentTarget;
              stickToBottomRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80;
            }} className="flex-1 min-h-0 overflow-y-auto p-4">
              {loadingMessages && <p className="text-sm text-muted-foreground mb-3">Carregando mensagens…</p>}
              <div className="space-y-3">
                {messages.map((msg) => <div key={msg.id} className={'flex ' + (msg.from_me ? 'justify-end' : 'justify-start')}>
                  <div className={'max-w-[80%] px-3 py-2 rounded-xl text-sm ' + (msg.from_me ? 'bg-green-100 text-green-950' : 'bg-muted text-foreground')}>
                    {msg.media_filename && <div className="flex items-center gap-2 mb-1 text-xs font-medium"><Paperclip size={12} />{msg.media_filename}</div>}
                    <p className="whitespace-pre-wrap break-words">{msg.text ? renderMessageText(msg.text, openNumberActions) : (msg.message_type !== 'text' ? '[' + msg.message_type + ']' : '')}</p>
                    <p className="text-[10px] mt-1 text-right opacity-70">{fullTimeLabel(msg.timestamp)}{msg.from_me && msg.status ? ' · ' + msg.status : ''}</p>
                    {msg.error && <p className="text-xs text-red-700 mt-1">{msg.error}</p>}
                  </div>
                </div>)}
                {!loadingMessages && messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Sem mensagens registradas para esta conversa.</p>}
                <div ref={messagesEndRef} aria-hidden="true" className="h-px w-full" />
              </div>
            </div>
            <div className="p-3 border-t flex items-center gap-2">
              <Input placeholder="Digite uma mensagem..." value={message} onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                disabled={sending || selectedInstance?.status !== 'connected'} className="flex-1" />
              <Button onClick={() => void handleSend()} disabled={!message.trim() || sending || selectedInstance?.status !== 'connected'} className="bg-green-600 hover:bg-green-700">
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </Button>
            </div>
            {selectedInstance?.status !== 'connected' && <p className="px-3 pb-3 text-xs text-amber-700">A instância precisa estar conectada para enviar mensagens.</p>}
          </> : <div className="flex-1 flex items-center justify-center text-muted-foreground p-6 text-center">{loading ? 'Carregando conversas…' : 'Selecione uma conversa para visualizar as mensagens.'}</div>}
        </Card>
      </div>

      <Dialog open={numberDialogOpen} onOpenChange={(open) => { setNumberDialogOpen(open); if (!open) { setNumberVerified(null); setFirstMessage(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Phone size={18} /> Número de telefone</DialogTitle>
            <DialogDescription>Copie o número ou verifique se ele está registrado no WhatsApp pela sua instância conectada.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-3 font-mono text-sm break-all">{actionNumber}</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => void copyActionNumber()}>
              <Copy size={16} className="mr-2" /> Copiar número
            </Button>
            <Button type="button" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => void verifyActionNumber()} disabled={checkingNumber || selectedInstance?.status !== 'connected'}>
              {checkingNumber ? <Loader2 size={16} className="mr-2 animate-spin" /> : <MessageCircle size={16} className="mr-2" />}
              {checkingNumber ? 'Verificando…' : 'Conversar'}
            </Button>
          </div>
          {numberVerified === true && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 size={16} /> Número encontrado no WhatsApp.</p>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="whatsapp-first-message">Primeira mensagem</label>
                <Input id="whatsapp-first-message" placeholder="Digite uma mensagem para iniciar…" value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void startNumberConversation(); } }} />
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => void startNumberConversation()} disabled={!firstMessage.trim() || startingNumberChat} className="w-full bg-green-600 hover:bg-green-700">
                  {startingNumberChat ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
                  {startingNumberChat ? 'Enviando…' : 'Enviar e iniciar conversa'}
                </Button>
              </DialogFooter>
            </div>
          )}
          {numberVerified === false && <p className="text-sm text-destructive">Não foi possível localizar uma conta WhatsApp para esse número. Confira o DDD e o telefone.</p>}
          {selectedInstance?.status !== 'connected' && <p className="text-xs text-amber-700">Conecte sua instância pessoal para verificar e iniciar conversas.</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
