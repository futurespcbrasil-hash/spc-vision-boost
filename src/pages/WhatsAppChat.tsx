import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Send, Search, User, RefreshCw, Zap, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ryze } from '@/services/ryzeService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Instance { id: string; name: string; status: string; }
interface Chat {
  id: string; instance_id: string; wa_chat_id: string; contact_number: string;
  contact_name: string | null; last_message: string | null; last_message_at: string | null;
  unread_count: number; assigned_to: string | null; funnel_stage: string | null;
}
interface Message {
  id: string; chat_id: string; from_me: boolean; text: string | null;
  message_type: string; status: string | null; timestamp: string; media_url: string | null;
}
interface QuickReply { id: string; shortcut: string; text: string; }
interface Label { id: string; name: string; color: string; }

const WhatsAppChat = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [instanceId, setInstanceId] = useState<string>('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [selected, setSelected] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [syncing, setSyncing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isGestor = role === 'gestor';

  // Load instances
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('whatsapp_instances').select('id,name,status').order('created_at');
      const list = (data as Instance[]) || [];
      setInstances(list);
      if (!instanceId && list[0]) setInstanceId(list[0].id);
    })();
  }, []);

  // Load quick replies + labels
  useEffect(() => {
    if (!user) return;
    supabase.from('whatsapp_quick_replies').select('*').then(({ data }) => setQuickReplies((data as QuickReply[]) || []));
    supabase.from('whatsapp_labels').select('*').then(({ data }) => setLabels((data as Label[]) || []));
  }, [user]);

  // Load chats (RLS filters by assigned_to for atendentes)
  const loadChats = async () => {
    if (!instanceId) return;
    const { data } = await supabase.from('whatsapp_chats').select('*')
      .eq('instance_id', instanceId).order('last_message_at', { ascending: false, nullsFirst: false });
    setChats((data as Chat[]) || []);
  };
  useEffect(() => { loadChats(); }, [instanceId]);

  // Realtime chats
  useEffect(() => {
    if (!instanceId) return;
    const ch = supabase.channel(`wa-chats-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats', filter: `instance_id=eq.${instanceId}` },
        loadChats)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [instanceId]);

  // Load messages
  const loadMessages = async (chatId: string) => {
    const { data } = await supabase.from('whatsapp_messages').select('*')
      .eq('chat_id', chatId).order('timestamp', { ascending: true }).limit(500);
    setMessages((data as Message[]) || []);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
  };

  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.id);
    const ch = supabase.channel(`wa-msgs-${selected.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages', filter: `chat_id=eq.${selected.id}` },
        () => loadMessages(selected.id))
      .subscribe();
    // reset unread
    if (selected.unread_count > 0) {
      supabase.from('whatsapp_chats').update({ unread_count: 0 }).eq('id', selected.id);
    }
    return () => { supabase.removeChannel(ch); };
  }, [selected?.id]);

  const handleSend = async () => {
    if (!text.trim() || !selected || !instanceId) return;
    const msg = text.trim();
    setText('');
    try {
      await ryze.sendText(instanceId, selected.contact_number, msg);
      // auto-assign if unassigned
      if (!selected.assigned_to && user) {
        await supabase.from('whatsapp_chats').update({ assigned_to: user.id }).eq('id', selected.id);
      }
      loadMessages(selected.id);
      loadChats();
    } catch (e: any) {
      toast({ title: 'Falha ao enviar', description: e.message, variant: 'destructive' });
    }
  };

  const handleSync = async () => {
    if (!instanceId) return;
    setSyncing(true);
    try {
      await ryze.getChats(instanceId);
      toast({ title: 'Conversas sincronizadas' });
      loadChats();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally { setSyncing(false); }
  };

  const handleSyncMessages = async () => {
    if (!instanceId || !selected) return;
    try {
      await ryze.getMessages(instanceId, selected.wa_chat_id);
      loadMessages(selected.id);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const filtered = chats.filter(c =>
    !search ||
    (c.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
    c.contact_number.includes(search)
  );

  return (
    <div className="space-y-3 h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
        <div className="flex items-center gap-2">
          <Select value={instanceId} onValueChange={setInstanceId}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Selecionar instância"/></SelectTrigger>
            <SelectContent>
              {instances.map(i => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name} {i.status === 'connected' ? '🟢' : '⚫'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="gap-1">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''}/>Sincronizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-3 flex-1 min-h-0">
        <Card className="flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <Input placeholder="Buscar..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filtered.map(c => (
              <button key={c.id} onClick={() => setSelected(c)}
                className={`w-full flex items-start gap-3 p-3 text-left border-b transition hover:bg-muted/50 ${selected?.id === c.id ? 'bg-muted' : ''}`}>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User size={18} className="text-primary"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between">
                    <span className="font-medium text-sm truncate">{c.contact_name || c.contact_number}</span>
                    {c.last_message_at && (
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {new Date(c.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.last_message || '—'}</p>
                  {isGestor && c.assigned_to && (
                    <span className="text-[10px] text-primary">Atribuído</span>
                  )}
                </div>
                {c.unread_count > 0 && (
                  <Badge className="bg-green-500 h-5 min-w-5 text-[10px] rounded-full flex-shrink-0">{c.unread_count}</Badge>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">Sem conversas. Clique em Sincronizar.</p>
            )}
          </ScrollArea>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="p-3 border-b flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User size={18} className="text-primary"/>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{selected.contact_name || selected.contact_number}</p>
                    <p className="text-xs text-muted-foreground">{selected.contact_number}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={handleSyncMessages}>
                  <RefreshCw size={14}/>
                </Button>
              </div>

              <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
                <div className="space-y-2">
                  {messages.map(m => (
                    <div key={m.id} className={`flex ${m.from_me ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                        m.from_me ? 'bg-green-100 text-green-900' : 'bg-muted text-foreground'}`}>
                        {m.media_url && (
                          <div className="mb-1 text-xs opacity-70">[{m.message_type}]</div>
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p className={`text-[10px] mt-1 text-right ${m.from_me ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {m.from_me && ` · ${m.status || 'enviado'}`}
                        </p>
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">Nenhuma mensagem carregada.</p>
                  )}
                </div>
              </ScrollArea>

              <div className="p-3 border-t flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" title="Respostas rápidas"><Zap size={18}/></Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2 space-y-1">
                    {quickReplies.length === 0 && (
                      <p className="text-xs text-muted-foreground p-2">Cadastre em Ajustes → Respostas rápidas.</p>
                    )}
                    {quickReplies.map(q => (
                      <button key={q.id} onClick={() => setText(q.text)}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm">
                        <span className="font-medium text-primary">/{q.shortcut}</span>
                        <p className="text-xs text-muted-foreground truncate">{q.text}</p>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
                <Input placeholder="Digite uma mensagem..." value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                  className="flex-1"/>
                <Button onClick={handleSend} size="icon" className="bg-green-500 hover:bg-green-600">
                  <Send size={18}/>
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Selecione uma conversa
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppChat;
