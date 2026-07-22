import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Search, Filter, MoreVertical, Plus, ChevronDown, User, RefreshCw, Send, Smile, Paperclip,
  CheckCheck, Mic, Clock, ArrowLeft, Zap, MessageSquare, UserPlus, GitBranch
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ryze } from '@/services/ryzeService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Instance { id: string; name: string; status: string; }
interface Chat {
  id: string; instance_id: string; wa_chat_id: string; contact_number: string;
  contact_name: string | null; last_message: string | null; last_message_at: string | null;
  unread_count: number; assigned_to: string | null; funnel_stage: string | null; is_group?: boolean;
}
interface Message {
  id: string; chat_id: string; from_me: boolean; text: string | null;
  message_type: string; status: string | null; timestamp: string; media_url: string | null;
}
interface QuickReply { id: string; shortcut: string; text: string; }

// Palette for contact avatars
const AVATAR_COLORS = [
  'bg-amber-400 text-amber-950',
  'bg-emerald-500 text-white',
  'bg-blue-600 text-white',
  'bg-purple-600 text-white',
  'bg-pink-500 text-white',
  'bg-indigo-600 text-white',
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const WhatsAppChat = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [instanceId, setInstanceId] = useState<string>('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [selected, setSelected] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');

  // Lead registration modal state
  const [leadDialog, setLeadDialog] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadFunnel, setLeadFunnel] = useState('comercial');
  const [leadStage, setLeadStage] = useState('novo');
  const [kanbanStages, setKanbanStages] = useState<{key: string; label: string; funnel: string}[]>([]);
  const [savingLead, setSavingLead] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'todos' | 'grupos' | 'aguardando' | 'resolvidos'>('todos');
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [syncing, setSyncing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const userName = user?.email?.split('@')[0] || 'Diogo';

  // Load instances
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('whatsapp_instances').select('id,name,status').order('created_at');
      const list = (data as Instance[]) || [];
      setInstances(list);
      if (!instanceId && list[0]) setInstanceId(list[0].id);
    })();
  }, []);

  // Load quick replies
  useEffect(() => {
    if (!user) return;
    supabase.from('whatsapp_quick_replies').select('*').then(({ data }) => setQuickReplies((data as QuickReply[]) || []));
  }, [user]);

  // Load chats
  const loadChats = async () => {
    if (!instanceId) return;
    const { data } = await supabase.from('whatsapp_chats').select('*')
      .eq('instance_id', instanceId).order('last_message_at', { ascending: false, nullsFirst: false });
    const list = (data as Chat[]) || [];
    setChats(list);
    if (list.length > 0 && !selected) {
      setSelected(list[0]);
    }
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
      toast({ title: 'Conversas sincronizadas com sucesso' });
      loadChats();
    } catch (e: any) {
      toast({ title: 'Erro na Sincronização', description: e.message, variant: 'destructive' });
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

  // Load kanban stages on mount
  useEffect(() => {
    supabase.from('kanban_stages').select('key, label, funnel').order('position').then(({ data }) => {
      setKanbanStages((data as any[]) || []);
    });
  }, []);

  // Open lead registration modal pre-filled with contact info
  const handleOpenLeadDialog = () => {
    if (!selected) return;
    setLeadName(selected.contact_name || '');
    setLeadPhone(selected.contact_number.replace('@s.whatsapp.net', '').replace('@c.us', ''));
    setLeadFunnel('comercial');
    setLeadStage(kanbanStages.find(s => s.funnel === 'comercial')?.key || 'novo');
    setLeadDialog(true);
  };

  // Register selected contact as a lead in the chosen funnel/stage
  const handleRegisterLead = async () => {
    if (!leadName.trim() || !user) return;
    setSavingLead(true);
    try {
      const { error } = await supabase.from('leads').insert({
        user_id: user.id,
        name: leadName.trim(),
        phone: leadPhone.trim(),
        whatsapp: leadPhone.trim(),
        status: leadStage,
        funnel: leadFunnel,
        type: 'comercial',
        origin: 'WhatsApp',
      });
      if (error) throw error;
      toast({
        title: '✅ Lead cadastrado!',
        description: `${leadName} adicionado ao funil. Redirecionando...`,
      });
      setLeadDialog(false);
      setTimeout(() => navigate('/crm'), 1200);
    } catch (e: any) {
      toast({ title: 'Erro ao cadastrar lead', description: e.message, variant: 'destructive' });
    } finally { setSavingLead(false); }
  };

  // Filter chats by tab & search query
  const filteredChats = chats.filter(c => {
    const matchSearch = !search ||
      (c.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
      c.contact_number.includes(search);
    if (!matchSearch) return false;

    if (activeFilter === 'grupos') return c.is_group || c.wa_chat_id.includes('@g.us');
    if (activeFilter === 'aguardando') return c.unread_count > 0 || !c.assigned_to;
    if (activeFilter === 'resolvidos') return !!c.assigned_to && c.unread_count === 0;
    return true;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] space-y-2 bg-background font-sans">
      {/* Top Bar: Instance Selection & Global Actions */}
      <div className="flex items-center justify-between px-2 py-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">WhatsApp</h1>
          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
            {chats.length} conversas
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={instanceId} onValueChange={setInstanceId}>
            <SelectTrigger className="w-56 h-9 bg-card text-xs">
              <SelectValue placeholder="Selecionar instância" />
            </SelectTrigger>
            <SelectContent>
              {instances.map(i => (
                <SelectItem key={i.id} value={i.id} className="text-xs">
                  {i.name} {i.status === 'connected' ? '🟢' : '⚫'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="h-9 gap-1 text-xs">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* Main Grid Layout (Competitor Style) */}
      <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-0 border rounded-xl overflow-hidden flex-1 bg-card shadow-sm">
        
        {/* Left Column: Chat List Sidebar */}
        <div className="flex flex-col border-r bg-background relative">
          
          {/* Header Search & Toolbar */}
          <div className="p-3 space-y-2.5 border-b bg-card">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar..."
                  className="pl-9 pr-3 h-9 text-xs bg-muted/40 border-muted rounded-lg focus-visible:ring-purple-500"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                <Filter size={18} />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                <MoreVertical size={18} />
              </Button>
            </div>

            {/* Filter Pills (Todos, Grupos, Aguardando, Resolvidos) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                onClick={() => setActiveFilter('todos')}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  activeFilter === 'todos'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Todos <span className="text-[10px] bg-purple-700/50 text-white px-1.5 py-0.5 rounded-full">{chats.length}</span>
                <ChevronDown size={12} />
              </button>

              <button
                onClick={() => setActiveFilter('grupos')}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  activeFilter === 'grupos'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Grupos
              </button>

              <button
                onClick={() => setActiveFilter('aguardando')}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  activeFilter === 'aguardando'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Aguardando
              </button>

              <button
                onClick={() => setActiveFilter('resolvidos')}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  activeFilter === 'resolvidos'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Resolvidos <span className="text-[10px] bg-muted-foreground/20 text-foreground px-1.5 py-0.5 rounded-full">38</span>
                <ChevronDown size={12} />
              </button>
            </div>
          </div>

          {/* Conversations List */}
          <ScrollArea className="flex-1">
            <div className="divide-y divide-border/40">
              {filteredChats.map((c, idx) => {
                const name = c.contact_name || c.contact_number;
                const isSelected = selected?.id === c.id;
                const avatarColor = getAvatarColor(name);
                const initials = getInitials(name);
                const timeStr = c.last_message_at
                  ? new Date(c.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : '';
                
                // Left border indicator colors
                const indicatorColors = ['bg-amber-400', 'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500'];
                const indicatorColor = indicatorColors[idx % indicatorColors.length];

                return (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`w-full flex items-center gap-3 p-3 text-left relative transition-all hover:bg-muted/50 ${
                      isSelected ? 'bg-muted/80' : ''
                    }`}
                  >
                    {/* Left vertical color bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${indicatorColor}`} />

                    {/* Avatar Circle with WhatsApp Icon badge */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-11 h-11 rounded-full ${avatarColor} flex items-center justify-center font-bold text-sm shadow-sm`}>
                        {initials}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 text-white rounded-full p-0.5 border-2 border-background">
                        <MessageSquare size={10} className="fill-current" />
                      </div>
                    </div>

                    {/* Chat Content Preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-foreground truncate">{name}</span>
                        {timeStr && <span className="text-[11px] text-muted-foreground flex-shrink-0">{timeStr}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        <span className="font-semibold text-foreground/80">{userName}: </span>
                        {c.last_message || 'Clique para abrir conversa'}
                      </p>
                    </div>

                    {/* Status Dot / Unread Badge */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {c.unread_count > 0 ? (
                        <Badge className="bg-purple-600 text-white text-[10px] h-5 min-w-5 rounded-full flex items-center justify-center p-0">
                          {c.unread_count}
                        </Badge>
                      ) : (
                        <span className={`w-2.5 h-2.5 rounded-full ${idx % 2 === 0 ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                      )}
                    </div>
                  </button>
                );
              })}

              {filteredChats.length === 0 && (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                  <User size={32} className="mx-auto text-muted-foreground/30" />
                  <p>Nenhuma conversa encontrada.</p>
                  <p className="text-[11px]">Clique no botão Sincronizar acima para carregar.</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Floating Action Button (FAB) */}
          <button className="absolute bottom-4 left-4 w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95">
            <Plus size={22} />
          </button>
        </div>

        {/* Right Column: Active Conversation Area */}
        <div className="flex flex-col bg-slate-50/50 dark:bg-zinc-900/50">
          {selected ? (
            <>
              {/* Active Chat Header */}
              <div className="p-3 border-b bg-card flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 text-muted-foreground">
                    <ArrowLeft size={18} />
                  </Button>

                  <div className={`w-10 h-10 rounded-full ${getAvatarColor(selected.contact_name || selected.contact_number)} flex items-center justify-center font-bold text-sm`}>
                    {getInitials(selected.contact_name || selected.contact_number)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {selected.contact_name || selected.contact_number}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">#8444778</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Atribuído à: <strong className="text-foreground">{userName}</strong></span>
                      <button className="w-4 h-4 rounded-full border border-muted-foreground/40 flex items-center justify-center text-[10px] hover:bg-muted">
                        +
                      </button>
                      <Badge variant="outline" className="h-5 gap-1 text-[10px] bg-purple-50 text-purple-700 border-purple-200 font-normal">
                        <Clock size={10} /> 23h 56m
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenLeadDialog}
                    title="Cadastrar como Lead no Funil"
                    className="h-8 gap-1 text-xs border-purple-300 text-purple-700 hover:bg-purple-50 hidden sm:flex"
                  >
                    <GitBranch size={13}/>
                    <span>Lead no Funil</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleSyncMessages} title="Atualizar mensagens" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                    <RefreshCw size={17} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                    <Search size={17} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                    <MoreVertical size={17} />
                  </Button>
                </div>
              </div>

              {/* Chat Message Canvas */}
              <ScrollArea className="flex-1 p-4 bg-slate-100/70 dark:bg-zinc-950/70" ref={scrollRef as any}>
                <div className="space-y-3 max-w-3xl mx-auto">
                  {messages.map(m => {
                    const timeStr = m.timestamp
                      ? new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : '';

                    return (
                      <div key={m.id} className={`flex ${m.from_me ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[78%] p-3 shadow-xs rounded-2xl text-xs space-y-1 ${
                            m.from_me
                              ? 'bg-purple-100 text-purple-950 border border-purple-200/60 rounded-tr-xs dark:bg-purple-900/40 dark:text-purple-100 dark:border-purple-800/40'
                              : 'bg-white text-slate-900 border border-slate-200/80 rounded-tl-xs dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700/60'
                          }`}
                        >
                          {m.from_me && (
                            <p className="font-bold text-[11px] text-purple-900 dark:text-purple-300">
                              {userName}:
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words leading-relaxed text-sm">
                            {m.text}
                          </p>
                          <div className="flex items-center justify-end gap-1 pt-0.5 text-[10px] opacity-70">
                            <span>{timeStr}</span>
                            {m.from_me && <CheckCheck size={13} className="text-purple-700 dark:text-purple-300" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {messages.length === 0 && (
                    <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
                      <p>Nenhuma mensagem carregada nesta conversa.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Competitor Style Input Bar */}
              <div className="p-3 border-t bg-card flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground">
                      <Smile size={20} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2 space-y-1 text-xs">
                    <p className="font-semibold px-2 py-1 text-muted-foreground">Respostas Rápidas</p>
                    {quickReplies.length === 0 && (
                      <p className="p-2 text-muted-foreground">Nenhuma resposta rápida cadastrada.</p>
                    )}
                    {quickReplies.map(q => (
                      <button
                        key={q.id}
                        onClick={() => setText(q.text)}
                        className="w-full text-left p-2 rounded hover:bg-muted"
                      >
                        <span className="font-bold text-purple-600">/{q.shortcut}</span>
                        <p className="truncate text-muted-foreground">{q.text}</p>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground">
                  <Paperclip size={20} />
                </Button>

                <div className="flex-1 relative">
                  <Input
                    placeholder='Tecle "/" para respostas rápidas'
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                    className="h-10 text-xs bg-muted/30 border-muted rounded-full px-4 focus-visible:ring-purple-500"
                  />
                </div>

                <Button
                  onClick={handleSend}
                  size="icon"
                  className="h-10 w-10 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex-shrink-0"
                >
                  {text.trim() ? <Send size={18} /> : <Mic size={18} />}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs p-8 space-y-3">
              <MessageSquare size={48} className="text-muted-foreground/30" />
              <p className="font-medium text-sm">Selecione uma conversa para iniciar o atendimento</p>
            </div>
          )}
        </div>

      </div>
    </div>

    {/* ─── Lead Registration Dialog ─── */}
    <Dialog open={leadDialog} onOpenChange={setLeadDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch size={18} className="text-purple-600" />
            Cadastrar Lead no Funil
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Transforme este contato em um lead e adicione ao funil de vendas.</p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="lead-name">Nome *</Label>
            <Input id="lead-name" placeholder="Nome do lead" value={leadName} onChange={e => setLeadName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-phone">WhatsApp / Telefone</Label>
            <Input id="lead-phone" placeholder="Número" value={leadPhone} onChange={e => setLeadPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Funil</Label>
              <Select value={leadFunnel} onValueChange={v => { setLeadFunnel(v); setLeadStage(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar funil" /></SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(kanbanStages.map(s => s.funnel))).map(f => (
                    <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>
                  ))}
                  <SelectItem value="comercial">comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Etapa Inicial</Label>
              <Select value={leadStage} onValueChange={setLeadStage}>
                <SelectTrigger><SelectValue placeholder="Selecionar etapa" /></SelectTrigger>
                <SelectContent>
                  {kanbanStages
                    .filter(s => s.funnel === leadFunnel)
                    .map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)
                  }
                  {kanbanStages.filter(s => s.funnel === leadFunnel).length === 0 && (
                    <SelectItem value="novo">Novo</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setLeadDialog(false)}>Cancelar</Button>
          <Button onClick={handleRegisterLead} disabled={savingLead || !leadName.trim()} className="gap-2">
            <UserPlus size={14} />
            {savingLead ? 'Salvando...' : 'Cadastrar e Ir ao Funil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppChat;
