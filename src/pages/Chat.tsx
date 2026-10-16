import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Send, MessageCircle, Search, ArrowLeft, Paperclip, Loader2 } from 'lucide-react';

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
  mediaUrl?: string;
}

const MEDIA_PREFIX = '__chat_media__:';
type ChatMedia = { type: 'image' | 'video' | 'audio' | 'file'; path: string; name: string; mime: string; caption?: string };

const parseMedia = (content: string): ChatMedia | null => {
  if (!content.startsWith(MEDIA_PREFIX)) return null;
  try { return JSON.parse(content.slice(MEDIA_PREFIX.length)) as ChatMedia; } catch { return null; }
};

const hydrateMessage = async (message: Message): Promise<Message> => {
  const media = parseMedia(message.content);
  if (!media) return message;
  const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(media.path, 7 * 24 * 60 * 60);
  if (error || !data?.signedUrl) return message;
  return { ...message, mediaUrl: data.signedUrl };
};

const Chat = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selected, setSelected] = useState<UserItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Load every registered teammate through a scoped RPC.
  // This avoids profile/role table RLS rules hiding coworkers from non-manager roles.
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase.rpc('get_chat_users');
      if (!active) return;
      if (error) {
        console.error('Erro ao carregar usuários do Chat Interno:', error);
        toast({
          title: 'Não foi possível carregar os usuários',
          description: 'Verifique sua conexão e tente novamente.',
          variant: 'destructive',
        });
        setUsers([]);
        return;
      }
      const list = (data || [])
        .filter((p: UserItem) => p.user_id !== user?.id)
        .map((p: UserItem) => ({
          ...p,
          display_name: p.display_name || p.email || 'Usuário',
        }));
      setUsers(list);
    };
    if (user) load();
    return () => { active = false; };
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
      const hydrated = await Promise.all(((data || []) as Message[]).map(hydrateMessage));
      setMessages(hydrated);
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
          void hydrateMessage(m).then(hydrated => setMessages(prev => prev.some(x => x.id === hydrated.id) ? prev : [...prev, hydrated]));
          if (m.recipient_id === user.id) {
            void supabase.from('chat_messages').update({ read: true }).eq('id', m.id).eq('recipient_id', user.id);
            setUnread(current => ({ ...current, [selected.user_id]: 0 }));
          }
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

  const sendFile = async (file?: File) => {
    if (!file || !selected || !user) return;
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'O limite é de 25 MB por arquivo.', variant: 'destructive' });
      return;
    }
    const type: ChatMedia['type'] = file.type.startsWith('image/') ? 'image'
      : file.type.startsWith('video/') ? 'video'
      : file.type.startsWith('audio/') ? 'audio' : 'file';
    if (!['image', 'video', 'audio'].includes(type)) {
      toast({ title: 'Formato não suportado', description: 'Envie uma imagem, vídeo ou áudio.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\\w.\\-]/g, '_');
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (uploadError) throw uploadError;
      const media: ChatMedia = { type, path, name: file.name, mime: file.type || 'application/octet-stream', caption: text.trim() || undefined };
      const content = MEDIA_PREFIX + JSON.stringify(media);
      const { data, error } = await supabase.from('chat_messages')
        .insert({ sender_id: user.id, recipient_id: selected.user_id, content })
        .select().single();
      if (error) throw error;
      if (data) {
        const hydrated = await hydrateMessage(data as Message);
        setMessages(prev => prev.some(m => m.id === hydrated.id) ? prev : [...prev, hydrated]);
      }
      setText('');
      toast({ title: 'Mídia enviada' });
    } catch (error: any) {
      toast({ title: 'Falha ao enviar mídia', description: error?.message || 'Tente novamente.', variant: 'destructive' });
    } finally { setUploading(false); }
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
                  const media = parseMedia(m.content);
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border text-foreground rounded-bl-sm'}`}>
                        {media && m.mediaUrl ? (
                          <div className="space-y-2 min-w-0">
                            {media.type === 'image' && <a href={m.mediaUrl} target="_blank" rel="noreferrer"><img src={m.mediaUrl} alt={media.name} className="max-w-full max-h-72 rounded-lg object-contain" /></a>}
                            {media.type === 'video' && <video src={m.mediaUrl} controls preload="metadata" className="max-w-full max-h-72 rounded-lg" />}
                            {media.type === 'audio' && <audio src={m.mediaUrl} controls preload="metadata" className="max-w-full" />}
                            {media.caption && <p className="whitespace-pre-wrap break-words">{media.caption}</p>}
                            <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="text-xs underline break-all">{media.name}</a>
                          </div>
                        ) : media ? <p className="text-xs">Mídia anexada: {media.name} (link temporariamente indisponível)</p> : <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                        <p className={`text-[10px] mt-1 ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <div className="p-3 border-t border-border flex gap-2 items-center">
                <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void sendFile(file); }} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Enviar imagem, vídeo ou áudio" className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50"><Paperclip size={17} /></button>
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
                <button
                  onClick={send}
                  disabled={!text.trim() || uploading}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {uploading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Enviar
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
