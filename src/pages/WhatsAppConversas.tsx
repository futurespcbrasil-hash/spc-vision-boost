import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { waha } from '@/services/ryzeService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Paperclip, Search, User, RefreshCw, Loader2 } from 'lucide-react';
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

  const selectedChat = useMemo(() => chats.find((chat) => chat.id === selectedChatId) || null, [chats, selectedChatId]);
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
      const saved = localStorage.getItem('whatsapp_conversas_instance');
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
    setLoadingMessages(true);
    try {
      if (refreshRemote) {
        const response: any = await waha.getMessages(chat.instance_id, chat.wa_chat_id);
        if (response?.error) throw new Error(String(response.error));
      }
      const { data, error } = await (supabase as any).from('whatsapp_messages').select('*')
        .eq('instance_id', chat.instance_id).eq('chat_id', chat.id).order('timestamp', { ascending: true }).limit(500);
      if (error) throw error;
      setMessages((data || []) as Message[]);
      await (supabase as any).from('whatsapp_chats').update({ unread_count: 0 }).eq('id', chat.id);
      setChats((current) => current.map((item) => item.id === chat.id ? { ...item, unread_count: 0 } : item));
    } catch (e) {
      toast.error('Não foi possível carregar as mensagens: ' + errorText(e));
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => { void loadInstances().catch((e) => toast.error('Falha ao carregar instâncias: ' + errorText(e))); }, [loadInstances]);
  useEffect(() => {
    if (instanceId) localStorage.setItem('whatsapp_conversas_instance', instanceId);
    void loadChats(false);
  }, [instanceId, loadChats]);
  useEffect(() => { if (selectedChat) void loadMessages(selectedChat, true); else setMessages([]); }, [selectedChatId, selectedChat, loadMessages]);

  const refresh = async () => {
    try {
      if (instanceId) await loadChats(true);
      else await loadInstances();
      toast.success('Conversas atualizadas.');
    } catch (e) { toast.error(errorText(e)); }
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text || !selectedChat || !selectedInstance || sending) return;
    if (!selectedInstance.provider_instance_name) {
      toast.error('Esta conta ainda não está vinculada a uma sessão WAHA. Selecione a instância WAHA correta.');
      return;
    }
    setSending(true);
    try {
      const response: any = await waha.sendText(instanceId, selectedChat.wa_chat_id || selectedChat.contact_number, text);
      const rawId = response?.wa_message_id || response?.messageId || response?.id?._serialized || response?.id || response?.data?.id || null;
      const { error: saveError } = await (supabase as any).from('whatsapp_messages').upsert({
        chat_id: selectedChat.id, instance_id: instanceId, wa_message_id: typeof rawId === 'string' ? rawId : null,
        from_me: true, sender: 'me', message_type: 'text', text, status: 'sent',
        timestamp: new Date().toISOString(), sent_by: user?.id || null, raw: response || {},
      }, { onConflict: 'instance_id,wa_message_id' });
      await (supabase as any).from('whatsapp_chats').update({
        last_message: text, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', selectedChat.id);
      setMessage('');
      await loadMessages(selectedChat, false);
      await loadChats(false);
      if (saveError) toast.warning('Mensagem enviada à WAHA, mas não foi possível gravar no histórico: ' + saveError.message);
      else toast.success('Mensagem enviada.');
    } catch (e) {
      toast.error('Falha ao enviar mensagem: ' + errorText(e));
    } finally {
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
          <Select value={instanceId} onValueChange={setInstanceId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
            <SelectContent>
              {instances.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}{item.status === 'connected' ? ' · Conectada' : ''}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={refresh} disabled={loading} aria-label="Atualizar conversas">
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
            {!loading && filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa sincronizada. Clique em atualizar para consultar a WAHA.</p>}
            {filtered.map((chat) => (
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
            <ScrollArea className="flex-1 p-4">
              {loadingMessages && <p className="text-sm text-muted-foreground mb-3">Carregando mensagens…</p>}
              <div className="space-y-3">
                {messages.map((msg) => <div key={msg.id} className={'flex ' + (msg.from_me ? 'justify-end' : 'justify-start')}>
                  <div className={'max-w-[80%] px-3 py-2 rounded-xl text-sm ' + (msg.from_me ? 'bg-green-100 text-green-950' : 'bg-muted text-foreground')}>
                    {msg.media_filename && <div className="flex items-center gap-2 mb-1 text-xs font-medium"><Paperclip size={12} />{msg.media_filename}</div>}
                    <p className="whitespace-pre-wrap break-words">{msg.text || (msg.message_type !== 'text' ? '[' + msg.message_type + ']' : '')}</p>
                    <p className="text-[10px] mt-1 text-right opacity-70">{fullTimeLabel(msg.timestamp)}{msg.from_me && msg.status ? ' · ' + msg.status : ''}</p>
                    {msg.error && <p className="text-xs text-red-700 mt-1">{msg.error}</p>}
                  </div>
                </div>)}
                {!loadingMessages && messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Sem mensagens registradas para esta conversa.</p>}
              </div>
            </ScrollArea>
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
    </div>
  );
}
