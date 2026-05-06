import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Send, MessageCircle, Search, ArrowLeft } from 'lucide-react';

interface UserItem {
  user_id: string;
  display_name: string;
  email: string;
  role?: string;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

const Chat = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selected, setSelected] = useState<UserItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [unread, setUnread] = useState<Record<string, number>>({});
  const endRef = useRef<HTMLDivElement>(null);

  // Load users
  useEffect(() => {
    const load = async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email');
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));
      const list = (profiles || [])
        .filter(p => p.user_id !== user?.id)
        .map(p => ({ ...p, role: roleMap.get(p.user_id) as string }));
      setUsers(list);
    };
    if (user) load();
  }, [user]);

  // Load unread counts
  useEffect(() => {
    if (!user) return;
    const loadUnread = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('sender_id')
        .eq('recipient_id', user.id)
        .eq('read', false);
      const counts: Record<string, number> = {};
      (data || []).forEach(m => { counts[m.sender_id] = (counts[m.sender_id] || 0) + 1; });
      setUnread(counts);
    };
    loadUnread();
  }, [user, messages]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selected || !user) return;
    const load = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${selected.user_id}),and(sender_id.eq.${selected.user_id},recipient_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
      setMessages(data || []);
      // mark received as read
      await supabase
        .from('chat_messages')
        .update({ read: true })
        .eq('sender_id', selected.user_id)
        .eq('recipient_id', user.id)
        .eq('read', false);
      setUnread(u => ({ ...u, [selected.user_id]: 0 }));
    };
    load();
  }, [selected, user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chat_messages_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const m = payload.new as Message;
        const involves = m.sender_id === user.id || m.recipient_id === user.id;
        if (!involves) return;
        if (selected && (m.sender_id === selected.user_id || m.recipient_id === selected.user_id)) {
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
        } else if (m.recipient_id === user.id) {
          setUnread(u => ({ ...u, [m.sender_id]: (u[m.sender_id] || 0) + 1 }));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selected]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !selected || !user) return;
    const content = text.trim();
    setText('');
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ sender_id: user.id, recipient_id: selected.user_id, content })
      .select()
      .single();
    if (error) {
      toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
      return;
    }
    if (data) setMessages(prev => prev.some(x => x.id === data.id) ? prev : [...prev, data]);
  };

  const filteredUsers = users.filter(u =>
    (u.display_name || u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageCircle size={22} /> Chat Interno
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Converse com sua equipe em tempo real</p>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-4 bg-card rounded-xl border border-border overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Users list */}
        <div className={`border-r border-border ${selected ? 'hidden lg:flex' : 'flex'} flex-col`}>
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar usuário..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredUsers.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum usuário</p>
            )}
            {filteredUsers.map(u => (
              <button
                key={u.user_id}
                onClick={() => setSelected(u)}
                className={`w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-muted/50 transition border-b border-border/50 ${selected?.user_id === u.user_id ? 'bg-muted' : ''}`}
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                  {(u.display_name || u.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">{u.display_name || u.email}</div>
                  <div className="text-xs text-muted-foreground capitalize">{u.role}</div>
                </div>
                {unread[u.user_id] > 0 && (
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                    {unread[u.user_id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation */}
        <div className={`${selected ? 'flex' : 'hidden lg:flex'} flex-col`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Selecione um usuário para começar
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <button onClick={() => setSelected(null)} className="lg:hidden text-muted-foreground">
                  <ArrowLeft size={18} />
                </button>
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                  {(selected.display_name || selected.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-foreground text-sm">{selected.display_name || selected.email}</div>
                  <div className="text-xs text-muted-foreground capitalize">{selected.role}</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">Sem mensagens ainda. Diga olá!</p>
                )}
                {messages.map(m => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border text-foreground rounded-bl-sm'}`}>
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <p className={`text-[10px] mt-1 ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <div className="p-3 border-t border-border flex gap-2">
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
                <button
                  onClick={send}
                  disabled={!text.trim()}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send size={15} /> Enviar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
