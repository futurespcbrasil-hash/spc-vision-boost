import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Search, Filter, MoreVertical, Plus, ChevronDown, User, RefreshCw, Send, Smile, Paperclip,
  CheckCheck, Mic, Clock, ArrowLeft, Zap, MessageSquare, UserPlus, GitBranch,
  Image as ImageIcon, FileText, Camera, Video, Square, Loader2, Trash2,
  Pin, PinOff, Eye, Bell, Copy, Forward, Star, Reply, Share2, Download, ExternalLink, Info, CheckSquare,
  Phone, Ban, Flag, Link as LinkIcon, Contact, CheckCircle2
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { waha } from '@/services/ryzeService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

interface Instance { id: string; name: string; status: string; }
interface Chat {
  id: string; instance_id: string; wa_chat_id: string; contact_number: string;
  contact_name: string | null; last_message: string | null; last_message_at: string | null;
  unread_count: number; assigned_to: string | null; funnel_stage: string | null; lead_id?: string | null; is_group?: boolean;
  avatar_url?: string | null; is_pinned?: boolean;
}
interface Message {
  id: string; chat_id: string; from_me: boolean; text: string | null;
  message_type: string; status: string | null; timestamp: string; media_url: string | null;
  wa_message_id?: string | null; reply_to?: string | null; sender?: string | null;
  media_mime?: string | null;
  media_filename?: string | null;
}
interface QuickReply { id: string; shortcut: string; text: string; }
interface WhatsAppNotification { id: string; title: string; body: string; chat_id: string | null; created_at: string; read_at: string | null; }

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

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Frequentes', emojis: ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😍','😘','😜','🤔','🤗','👍','👎','👏','🙏','💪','🔥','✅','❌','⚠️','💰','📈','📌','📞','📱','✉️','🗓️','⏰','🎯','🚀','⭐','❤️','🎉','😎','🤝'] },
  { label: 'Negócios', emojis: ['💼','📊','📋','🧾','🏦','💳','🔒','📎','🖊️','📄','🏢','🤑','💵','🧮','📥','📤'] },
  { label: 'Reações', emojis: ['😢','😭','😡','😱','😴','🤒','🥳','😬','🙄','😏','😌','🤐','😤','🫡','🫶','👌'] },
];

const uploadMedia = async (file: Blob, filename: string, userId: string) => {
  const path = `${userId}/${Date.now()}-${filename.replace(/[^\w.\-]/g, '_')}`;
  const { error } = await supabase.storage.from('chat-media').upload(path, file, {
    contentType: (file as File).type || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage.from('chat-media').createSignedUrl(path, 15 * 60);
  if (sErr || !data?.signedUrl) throw sErr || new Error('Não foi possível gerar o link do arquivo');
  return data.signedUrl;
};

const onlyDigits = (v: string) => v.replace(/\D/g, '');
const canonicalWhatsAppPhone = (value: string) => {
  let digits = onlyDigits(value);
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (digits.length === 11 && digits[2] === '9') digits = digits.slice(0, 2) + digits.slice(3);
  return digits;
};

// Guard the list against legacy duplicate rows while the backend consolidation runs.
// Group conversations remain separate; only individual chats with a real phone are merged.
const deduplicateChatsForDisplay = <T extends { id: string; wa_chat_id: string; contact_number: string; is_group: boolean; last_message_at?: string | null; unread_count?: number }>(items: T[]): T[] => {
  const byPhone = new Map<string, T>();
  const passthrough: T[] = [];
  for (const item of items) {
    const phone = canonicalWhatsAppPhone(item.contact_number || '');
    if (item.is_group || phone.length < 10) {
      passthrough.push(item);
      continue;
    }
    const current = byPhone.get(phone);
    if (!current) {
      byPhone.set(phone, item);
      continue;
    }
    const currentIsLid = current.wa_chat_id?.endsWith('@lid');
    const itemIsLid = item.wa_chat_id?.endsWith('@lid');
    // Prefer LID as the canonical remote chat id; then prefer unread/latest metadata.
    const currentTime = new Date(current.last_message_at || 0).getTime();
    const itemTime = new Date(item.last_message_at || 0).getTime();
    if ((itemIsLid && !currentIsLid) ||
        (itemIsLid === currentIsLid && ((item.unread_count || 0) > (current.unread_count || 0) ||
          ((item.unread_count || 0) === (current.unread_count || 0) && itemTime > currentTime)))) {
      byPhone.set(phone, item);
    }
  }
  return [...passthrough, ...byPhone.values()];
};

// Aceita valores brasileiros (1.000,00) e valores digitados com ponto decimal (1000.00).
const parsePlanValue = (raw: string): number | null => {
  const value = raw.trim().replace(/[^0-9,.-]/g, '');
  if (!value) return null;
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

// Formata número brasileiro: 5554991811902 -> +55 (54) 99181-1902
const formatNumber = (raw: string) => {
  const d = onlyDigits(raw || '');
  if (d.length >= 12 && d.startsWith('55')) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    return `+55 (${ddd}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
  }
  return raw ? `+${d}` : raw;
};

// Nome do contato quando existir; caso contrário, o número formatado
const chatTitle = (c?: Chat | null) => {
  if (!c) return '';
  const name = (c.contact_name || '').trim();
  if (name && onlyDigits(name) !== onlyDigits(c.contact_number)) return name;
  return formatNumber(c.contact_number);
};
const hasRealName = (c?: Chat | null) => {
  if (!c) return false;
  const name = (c.contact_name || '').trim();
  return !!name && onlyDigits(name) !== onlyDigits(c.contact_number);
};

// Nome (ou número formatado) do remetente em grupos
const senderLabel = (raw?: string | null) => {
  const v = (raw || '').trim();
  if (!v) return '';
  if (v.includes('@')) return formatNumber(v.split('@')[0]);
  if (onlyDigits(v).length >= 10 && onlyDigits(v) === v.replace(/\D/g, '')) return formatNumber(v);
  return v;
};

// Detecta mensagens compostas só por emojis (mostradas em tamanho maior)
const EMOJI_ONLY = /^(?:[\p{Extended_Pictographic}\p{Emoji_Component}\uFE0F\u200D\s]){1,8}$/u;

// Forçar rolagem para o final sem usar scrollToBottom
const scrollToBottomDirect = (ref: React.RefObject<HTMLDivElement>, behavior: ScrollBehavior = 'auto') => {
  if (ref.current) {
    ref.current.scrollIntoView({ behavior });
  }
};

// Helper to check if string is a valid phone number format
const isPotentialPhone = (v: string) => {
  const digits = onlyDigits(v);
  return digits.length >= 10 && digits.length <= 13;
};

// Transforma links e números de telefone em âncoras clicáveis
const renderRichText = (text: string, onNumberClick?: (num: string) => void) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  // Regex mais abrangente para números que parecem WhatsApp (ex: 54991811902)
  const phoneRegex = /(\+?\d{1,2}\s?\(?\d{2}\)?\s?9?\d{4}-?\d{4}|\d{10,13})/g;

  const parts = text.split(new RegExp(`(${urlRegex.source}|${phoneRegex.source})`, 'gi'));

  return parts.map((part, i) => {
    if (!part) return null;
    if (urlRegex.test(part)) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a key={i} href={href} target="_blank" rel="noreferrer" className="underline break-all text-blue-600 dark:text-blue-400">
          {part}
        </a>
      );
    }
    if (phoneRegex.test(part) && isPotentialPhone(part)) {
      const cleanNum = onlyDigits(part);
      return (
        <button
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            onNumberClick?.(cleanNum);
          }}
          className="underline text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity"
        >
          {part}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
};



const WhatsAppChat = () => {
  const [clipboardFiles, setClipboardFiles] = useState<File[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  // A barra horizontal fica fixa na base da janela. Reserva espaço no WhatsApp
  // somente nesse modo, evitando que ela cubra o campo de mensagem/anexos.
  const [menuLayout, setMenuLayout] = useState<'vertical' | 'horizontal'>(() => {
    try {
      return localStorage.getItem('future-vision-menu-layout:' + (user?.id || 'guest')) === 'horizontal'
        ? 'horizontal'
        : 'vertical';
    } catch {
      return 'vertical';
    }
  });

  useEffect(() => {
    const readMenuLayout = () => {
      try {
        setMenuLayout(localStorage.getItem('future-vision-menu-layout:' + (user?.id || 'guest')) === 'horizontal'
          ? 'horizontal'
          : 'vertical');
      } catch {
        setMenuLayout('vertical');
      }
    };
    readMenuLayout();
    const syncLayout = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; layout?: 'vertical' | 'horizontal' }>).detail;
      if (detail?.userId === (user?.id || 'guest') &&
          (detail.layout === 'vertical' || detail.layout === 'horizontal')) {
        setMenuLayout(detail.layout);
      }
    };
    window.addEventListener('future-vision-menu-layout-change', syncLayout);
    window.addEventListener('focus', readMenuLayout);
    return () => {
      window.removeEventListener('future-vision-menu-layout-change', syncLayout);
      window.removeEventListener('focus', readMenuLayout);
    };
  }, [user?.id]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [instanceId, setInstanceId] = useState<string>('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [selected, setSelected] = useState<Chat | null>(null);
  const [peeking, setPeeking] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [messageDetails, setMessageDetails] = useState<Message | null>(null);
  const [pinnedMessageIds, setPinnedMessageIds] = useState<string[]>([]);
  const [favoriteMessageIds, setFavoriteMessageIds] = useState<string[]>([]);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const messageFlagKey = 'whatsapp_message_flags_' + (user?.id || 'anonymous') + '_' + (instanceId || 'none');

  // Abre uma conversa do CRM apenas depois de carregar as conversas da instância
  // do usuário. Isso evita abrir o modal de nova conversa antes de localizar uma existente.
  useEffect(() => {
    const requestedPhone = searchParams.get('phone');
    if (!requestedPhone || !instanceId || !chatsLoaded) return;
    const digitsOnly = (value: string) => {
      const number = onlyDigits(value);
      return number.length % 2 === 0 && number.slice(0, number.length / 2) === number.slice(number.length / 2)
        ? number.slice(0, number.length / 2)
        : number;
    };
    const digits = digitsOnly(requestedPhone);
    // Compara números na mesma forma, independentemente de estarem salvos
    // com código do país, sem código do país ou duplicados em registros antigos.
    const canonicalPhone = (value: string) => {
      let number = digitsOnly(value);
      if (number.startsWith('55') && number.length >= 12) number = number.slice(2);
      if (number.length > 11) number = number.slice(-11);
      return number;
    };
    const requestedCanonical = canonicalPhone(digits);
    const target = chats.find(chat => {
      const savedCanonical = canonicalPhone(chat.contact_number || '');
      return !!requestedCanonical && savedCanonical === requestedCanonical;
    });
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('phone');
    nextParams.delete('compose');
    setSearchParams(nextParams, { replace: true });
    if (target) {
      setSelected(target);
      setNewChatOpen(false);
      setNewChatNumber('');
      setNewChatMessage('');
      setSearch('');
      if (isMobile) setMobileShowChat(true);
      if (searchParams.get('compose') === '1') window.setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      setSearch(digits);
      if (searchParams.get('compose') === '1') {
        setNewChatNumber(digits);
        setNewChatMessage('');
        setNewChatOpen(true);
      }
    }
  }, [searchParams, chats, isMobile, instanceId, chatsLoaded, setSearchParams]);

  // Lead registration modal state
  const [leadDialog, setLeadDialog] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadPlanValue, setLeadPlanValue] = useState('');
  const [leadBiro, setLeadBiro] = useState('');
  const [leadFunnel, setLeadFunnel] = useState('spc');
  const [leadStage, setLeadStage] = useState('lead_novo');
  const [leadAssignee, setLeadAssignee] = useState('');
  const [leadAssignees, setLeadAssignees] = useState<{user_id: string; display_name: string; email: string | null}[]>([]);
  const [kanbanStages, setKanbanStages] = useState<{key: string; label: string; funnel: string}[]>([]);
  const [kanbanFunnels, setKanbanFunnels] = useState<{key: string; label: string}[]>([]);
  const [savingLead, setSavingLead] = useState(false);

  useEffect(() => {
    let active = true;
    const loadAssignees = async () => {
      const { data, error } = await supabase.rpc('get_assignable_users');
      if (!error && data && active) setLeadAssignees(data);
      if (error) console.warn('[WhatsApp] Não foi possível carregar responsáveis:', error.message);
    };
    void loadAssignees();
    return () => { active = false; };
  }, []);

  // Atualização do status do lead diretamente pela conversa.
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusFunnel, setStatusFunnel] = useState('spc');
  const [statusStage, setStatusStage] = useState('lead_novo');
  const [savingStatus, setSavingStatus] = useState(false);

  // Cores pessoais dos responsáveis, visíveis para todos os usuários autenticados.
  const [agentColors, setAgentColors] = useState<Record<string, { display_name: string; color: string }>>({});
  const [notifications, setNotifications] = useState<WhatsAppNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unreadNotifications = notifications.filter(item => !item.read_at).length;
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferAssignee, setTransferAssignee] = useState('');
  const [transferringChat, setTransferringChat] = useState(false);
  const [assignmentHistory, setAssignmentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [closingService, setClosingService] = useState(false);
  const [closeServiceDialogOpen, setCloseServiceDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'todos' | 'grupos' | 'aguardando' | 'resolvidos'>('todos');
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [syncing, setSyncing] = useState(false);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<Chat | null>(null);
  const messagesRef = useRef<Message[]>([]);
  // Cache local por conversa: trocar de chat mostra o histórico imediatamente sem remontar mídias.
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map());
  const messagesChatIdRef = useRef<string>('');
  const draftRestorePending = useRef(false);
  const activeDraftKey = useRef('');
  const profilePicFetched = useRef<Set<string>>(new Set());
  const [instanceUnread, setInstanceUnread] = useState<Record<string, number>>({});

  // Painel de detalhes do contato e conteúdo compartilhado na conversa.
  const [contactPanelOpen, setContactPanelOpen] = useState(false);
  const [contactPanelTab, setContactPanelTab] = useState<'info' | 'media' | 'links' | 'docs'>('info');
  const [contactSearch, setContactSearch] = useState('');
  // Salvar contato
  const [saveContactOpen, setSaveContactOpen] = useState(false);
  const [contactNameInput, setContactNameInput] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  // Info do grupo
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);

  // New conversation modal
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatNumber, setNewChatNumber] = useState('');
  const [newChatMessage, setNewChatMessage] = useState('');
  const [forwardMessages, setForwardMessages] = useState<Message[]>([]);
  const [startingChat, setStartingChat] = useState(false);

  // Attachments / audio
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const cancelRecRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Paste handler for prints/images from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || !selected) return;
      
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      
      if (files.length > 0) {
        setClipboardFiles(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [selected]);

  const handleSendPaste = async () => {
    if (clipboardFiles.length === 0 || !selected || !instanceId || !user) return;
    
    setUploading(true);
    try {
      for (const file of clipboardFiles) {
        const url = await uploadMedia(file, file.name || 'clipboard-image.png', user.id);
        await waha.sendMedia(instanceId, selected.wa_chat_id || selected.contact_number, url, 'image', text.trim() || undefined, file.type || 'image/png', file.name || 'imagem.png');
        await touchLeadInteraction(selected);
      }
      setClipboardFiles([]);
      setText('');
      loadMessages(selected.id);
      loadChats();
      toast({ title: 'Imagens enviadas' });
    } catch (err: any) {
      toast({ title: 'Falha ao enviar clipboard', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };



  const userName = user?.email?.split('@')[0] || 'Diogo';
  const currentInstance = instances.find(i => i.id === instanceId);

  // Mantém a conversa selecionada acessível dentro de intervalos/realtime
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Restaura a conversa e o texto não enviado por usuário, instância e conversa.
  useEffect(() => {
    if (!user?.id || !instanceId || !selected?.id) {
      activeDraftKey.current = '';
      return;
    }
    const selectionKey = `whatsapp_chat_selected_${user.id}_${instanceId}`;
    const draftKey = `whatsapp_chat_draft_${user.id}_${instanceId}_${selected.id}`;
    try {
      localStorage.setItem(selectionKey, selected.id);
      activeDraftKey.current = draftKey;
      draftRestorePending.current = true;
      setText(localStorage.getItem(draftKey) || '');
    } catch {
      activeDraftKey.current = draftKey;
      draftRestorePending.current = true;
      setText('');
    }
  }, [selected?.id, instanceId, user?.id]);

  useEffect(() => {
    if (!activeDraftKey.current || !selected?.id || draftRestorePending.current) {
      draftRestorePending.current = false;
      return;
    }
    try {
      if (text) localStorage.setItem(activeDraftKey.current, text);
      else localStorage.removeItem(activeDraftKey.current);
    } catch { /* armazenamento indisponível ou quota excedida */ }
  }, [text, selected?.id]);

  // Load instances
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('whatsapp_instances')
        .select('id,name,status').order('created_at');
      if (error) {
        console.error('[WhatsApp] Falha ao carregar instâncias:', error);
        return;
      }
      if (cancelled) return;
      const list = (data as Instance[]) || [];
      setInstances(list);

      // A instância escolhida é individual por usuário e deve sobreviver
      // ao sair do menu, voltar ou recarregar a página.
      const storageKey = `whatsapp_chat_instance_${user.id}`;
      const savedId = localStorage.getItem(storageKey);
      const savedInstance = list.find((item) => item.id === savedId);
      const defaultInstance = savedInstance?.id
        || list.find((item) => item.status === 'connected')?.id
        || list[0]?.id
        || '';
      setInstanceId(defaultInstance);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !instanceId) return;
    localStorage.setItem(`whatsapp_chat_instance_${user.id}`, instanceId);
  }, [instanceId, user?.id]);


  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(messageFlagKey) || '{}');
      setPinnedMessageIds(Array.isArray(saved.pinned) ? saved.pinned : []);
      setFavoriteMessageIds(Array.isArray(saved.favorites) ? saved.favorites : []);
    } catch { setPinnedMessageIds([]); setFavoriteMessageIds([]); }
    setSelectedMessageIds([]);
  }, [messageFlagKey]);

  const saveMessageFlags = (pinned: string[], favorites: string[]) => {
    setPinnedMessageIds(pinned);
    setFavoriteMessageIds(favorites);
    try { localStorage.setItem(messageFlagKey, JSON.stringify({ pinned, favorites })); } catch { /* localStorage indisponível */ }
  };

  const handleMessageAction = async (action: string, message: Message) => {
    const content = (message.text || '').trim();
    const copyContent = content || message.media_url || '';
    try {
      if (action === 'details') { setMessageDetails(message); return; }
      if (action === 'delete') {
        if (message.id.startsWith('temp-')) throw new Error('Aguarde o envio terminar antes de excluir a mensagem.');
        const confirmed = window.confirm('Excluir esta mensagem do histórico do CRM? Se ela também foi apagada no celular, a sincronização será refletida aqui.');
        if (!confirmed) return;
        // Marcador persistente impede que a sincronização remota ressuscite a mensagem.
        const { error } = await supabase.from('whatsapp_messages')
          .update({ text: '[crm_deleted]', status: 'deleted', raw: { crm_deleted: true, deleted_at: new Date().toISOString() } })
          .eq('id', message.id);
        if (error) throw error;
        setMessages(prev => prev.filter(item => item.id !== message.id));
        messagesRef.current = messagesRef.current.filter(item => item.id !== message.id);
        setPinnedMessageIds(prev => prev.filter(id => id !== message.id));
        setFavoriteMessageIds(prev => prev.filter(id => id !== message.id));
        setSelectedMessageIds(prev => prev.filter(id => id !== message.id));
        toast({ title: 'Mensagem removida do histórico do CRM' });
        return;
      }
      if (action === 'reply') { setReplyingTo(message); window.setTimeout(() => inputRef.current?.focus(), 50); return; }
      if (action === 'copy') {
        if (!copyContent) return toast({ title: 'Nada para copiar' });
        await navigator.clipboard.writeText(copyContent);
        toast({ title: 'Copiado para a área de transferência' }); return;
      }
      if (action === 'forward') {
        if (!content && !message.media_url) return toast({ title: 'Conteúdo indisponível', description: 'Esta mensagem não tem texto nem mídia acessível.' });
        setSelectionMode(true);
        setSelectedMessageIds(prev => prev.includes(message.id) ? prev : [...prev, message.id]);
        toast({ title: 'Modo de seleção ativado', description: 'Marque as caixas das outras mensagens e depois clique em Encaminhar.' });
        return;
      }
      if (action === 'pin') {
        const next = pinnedMessageIds.includes(message.id) ? pinnedMessageIds.filter(id => id !== message.id) : [...pinnedMessageIds, message.id];
        saveMessageFlags(next, favoriteMessageIds);
        toast({ title: next.includes(message.id) ? 'Mensagem fixada no CRM' : 'Mensagem desafixada' }); return;
      }
      if (action === 'favorite') {
        const next = favoriteMessageIds.includes(message.id) ? favoriteMessageIds.filter(id => id !== message.id) : [...favoriteMessageIds, message.id];
        saveMessageFlags(pinnedMessageIds, next);
        toast({ title: next.includes(message.id) ? 'Mensagem favoritada' : 'Favorito removido' }); return;
      }
      if (action === 'select') {
        setSelectionMode(true);
        setSelectedMessageIds(prev => prev.includes(message.id) ? prev.filter(id => id !== message.id) : [...prev, message.id]); return;
      }
      if (action === 'save' || action === 'open') {
        let url = message.media_url || '';
        if (!url && content) url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
        if (!url) return toast({ title: 'Conteúdo indisponível' });
        if (action === 'open') {
          // Abrir a janela sincronamente para evitar bloqueio de pop-up e renovar
          // links assinados expirados antes de navegar para o arquivo.
          const popup = window.open('about:blank', '_blank');
          if (!popup) throw new Error('Permita pop-ups para abrir arquivos do WhatsApp.');
          popup.opener = null;
          try {
            const needsResolve = !!message.media_url && (
              /localhost:3000\/api\/files\//i.test(message.media_url) ||
              /\/storage\/v1\/object\/(sign|public)\/chat-media\//i.test(message.media_url)
            );
            if (needsResolve && selected?.instance_id) {
              const resolved = await waha.resolveMedia(selected.instance_id, message.id);
              if (typeof resolved?.url === 'string' && resolved.url) {
                url = resolved.url;
                setMessages(current => current.map(item => item.id === message.id ? { ...item, media_url: url } : item));
              }
            }
            popup.location.replace(url);
          } catch (openError) {
            popup.close();
            throw openError;
          }
          return;
        }
        if (message.media_url) {
          const response = await fetch(url);
          if (!response.ok) throw new Error('Não foi possível baixar a mídia.');
          url = URL.createObjectURL(await response.blob());
        }
        const anchor = document.createElement('a');
        anchor.href = url;
        const fallbackExt = (message.media_mime || '').split('/')[1]?.split(';')[0] || 'bin';
        anchor.download = message.media_url ? (message.media_filename || ('whatsapp-arquivo-' + message.id + '.' + fallbackExt)) : ('mensagem-whatsapp-' + message.id + '.txt');
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        return;
      }
      if (action === 'share') {
        if (navigator.share) await navigator.share({ title: 'Mensagem do WhatsApp', text: content || undefined, url: message.media_url || undefined });
        else if (copyContent) { await navigator.clipboard.writeText(copyContent); toast({ title: 'Conteúdo copiado para compartilhar' }); }
        else toast({ title: 'Nada para compartilhar' });
      }
    } catch (error: any) {
      toast({ title: 'Não foi possível executar a ação', description: error?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  // Load quick replies
  useEffect(() => {
    if (!user) return;
    supabase.from('whatsapp_quick_replies').select('*').then(({ data }) => setQuickReplies((data as QuickReply[]) || []));
  }, [user]);

  // Não lidas por instância (badge no seletor de instâncias)
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('whatsapp_chats')
        .select('instance_id,unread_count').gt('unread_count', 0);
      const map: Record<string, number> = {};
      (data as { instance_id: string; unread_count: number }[] | null)?.forEach(r => {
        map[r.instance_id] = (map[r.instance_id] || 0) + (r.unread_count || 0);
      });
      setInstanceUnread(map);
    };
    load();
    const ch = supabase.channel('wa-unread-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats' }, () => load())
      .subscribe();
    const poll = window.setInterval(load, 10000);
    return () => { window.clearInterval(poll); supabase.removeChannel(ch); };
  }, []);

  // Load chats
  const loadChats = async () => {
    if (!instanceId) { setChats([]); setSelected(null); setMessages([]); setChatsLoaded(false); return; }
    const { data, error } = await supabase.from('whatsapp_chats').select('*')
      .eq('instance_id', instanceId)
      .eq('archived', false)
      .not('last_message_at', 'is', null)
      .order('is_pinned', { ascending: false })
      .order('last_message_at', { ascending: false })
      .limit(200);
    if (error) {
      console.error('[WhatsApp] Falha ao carregar conversas:', error);
      toast({ title: 'Não foi possível carregar as conversas', description: error.message, variant: 'destructive' });
      return;
    }
    // Proteção contra JID @c.us e LID do mesmo telefone aparecendo duas vezes.
    const unique = new Map<string, Chat>();
    for (const row of (data || []) as Chat[]) {
      if (!row.wa_chat_id || row.wa_chat_id === 'status@broadcast' || row.wa_chat_id.endsWith('@newsletter') || row.wa_chat_id.endsWith('@broadcast')) continue;
      const phone = canonicalWhatsAppPhone(row.contact_number || '');
      const key = !row.is_group && phone.length >= 9 && !row.wa_chat_id.endsWith('@g.us')
        ? `phone:${phone}`
        : row.is_group ? `group:${row.wa_chat_id}` : `chat:${row.id}`;
      const previous = unique.get(key);
      if (!previous) { unique.set(key, row); continue; }
      const rowTime = new Date(row.last_message_at || 0).getTime();
      const previousTime = new Date(previous.last_message_at || 0).getTime();
      const rowHasName = hasRealName(row);
      const previousHasName = hasRealName(previous);
      if ((rowHasName && !previousHasName) || (rowHasName === previousHasName && rowTime > previousTime)) unique.set(key, row);
    }
    const list = [...unique.values()].sort((a, b) => {
      if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime();
    });
    setChats(list);
    setChatsLoaded(true);
    // Ao trocar de instância, nunca manter a conversa da instância anterior aberta.
    const cur = selectedRef.current;
    if (cur && cur.instance_id === instanceId) {
      const fresh = list.find(c => c.id === cur.id);
      if (fresh) setSelected(prev => prev && prev.id === fresh.id ? { ...prev, ...fresh } : prev);
      else setSelected(list[0] || null);
    } else {
      let savedChatId = '';
      try { savedChatId = user?.id ? localStorage.getItem(`whatsapp_chat_selected_${user.id}_${instanceId}`) || '' : ''; } catch { /* armazenamento indisponível */ }
      setSelected(list.find(chat => chat.id === savedChatId) || list[0] || null);
      setMessages([]);
    }
  };

  const togglePin = async (chat: Chat) => {
    const pinnedCount = chats.filter(c => c.is_pinned).length;
    if (!chat.is_pinned && pinnedCount >= 5) {
      toast({ title: 'Limite atingido', description: 'Você pode fixar no máximo 5 conversas.', variant: 'destructive' });
      return;
    }
    const newVal = !chat.is_pinned;
    try {
      const { error } = await supabase.from('whatsapp_chats').update({ is_pinned: newVal }).eq('id', chat.id);
      if (error) throw error;
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, is_pinned: newVal } : c));
      if (selected?.id === chat.id) setSelected(prev => prev ? { ...prev, is_pinned: newVal } : prev);
      toast({ title: newVal ? 'Conversa fixada' : 'Conversa desafixada' });
    } catch (e: any) {
      toast({ title: 'Erro ao fixar', description: e.message, variant: 'destructive' });
    }
  };

  // Solicita permissão para notificações push
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const showPushNotification = (chat: Chat, msg: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = chat.contact_name || chat.contact_number;
      new Notification(title, {
        body: msg,
        icon: chat.avatar_url || '/favicon.ico',
      });
    }
  };

  // Não lidas de TODAS as instâncias (badge no seletor)
  const loadInstanceUnread = async () => {
    const { data } = await supabase.from('whatsapp_chats')
      .select('instance_id,unread_count').gt('unread_count', 0);
    const map: Record<string, number> = {};
    (data || []).forEach((r: any) => {
      map[r.instance_id] = (map[r.instance_id] || 0) + (r.unread_count || 0);
    });
    setInstanceUnread(map);
  };

  useEffect(() => { setChatsLoaded(false); void loadChats(); }, [instanceId]);

  useEffect(() => {
    loadInstanceUnread();
    const t = window.setInterval(loadInstanceUnread, 8000);
    return () => window.clearInterval(t);
  }, []);


  // Realtime chats (com debounce para evitar recargas em rajada)
  useEffect(() => {
    if (!instanceId) return;
    let t: number | null = null;
    const schedule = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => loadChats(), 400);
    };
    const ch = supabase.channel(`wa-chats-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats', filter: `instance_id=eq.${instanceId}` },
        schedule)
      .subscribe();
    // Fallback: garante atualização mesmo se o realtime cair
    const poll = window.setInterval(() => loadChats(), 8000);
    const onFocus = () => loadChats();
    window.addEventListener('focus', onFocus);
    return () => {
      if (t) window.clearTimeout(t);
      window.clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      supabase.removeChannel(ch);
    };
  }, [instanceId]);


  // Controla a rolagem no viewport real, sem deslocar a página inteira.
  const getMessagesViewport = () => messagesViewportRef.current;
  const isMessagesViewportNearBottom = (threshold = 120) => {
    const viewport = getMessagesViewport();
    if (!viewport) return true;
    return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= threshold;
  };
  const scrollToBottom = (smooth = false) => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  // Ao abrir/trocar conversa inicia no fim. Não reagir a cada alteração de messages:
  // isso roubava o scroll manual do usuário enquanto lia mensagens antigas.
  useEffect(() => {
    if (!selected) return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      scrollToBottom(false);
      secondFrame = window.requestAnimationFrame(() => scrollToBottom(false));
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [selected?.id]);

  // Remove mensagens otimistas já confirmadas pelo servidor (evita duplicidade)
  const dropConfirmedTemps = (list: Message[], prev: Message[]) => {
    const temps = prev.filter(m => m.id.startsWith('temp-'));
    if (temps.length === 0) return list;
    const keep = temps.filter(t => !list.some(s =>
      s.from_me && (s.text || '').trim() === (t.text || '').trim() &&
      Math.abs(new Date(s.timestamp).getTime() - new Date(t.timestamp).getTime()) < 120000
    ));
    return [...list, ...keep];
  };

  // Load messages (últimas 80, ordem crescente na tela — muito mais rápido)
  const touchLeadInteraction = useCallback(async (chat: Chat | null | undefined, timestamp?: string) => {
    if (!chat?.lead_id) return;
    const parsed = timestamp ? new Date(timestamp) : new Date();
    const interactionAt = Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
    const { error } = await supabase.from('leads').update({ last_interaction_at: interactionAt }).eq('id', chat.lead_id);
    if (error) console.warn('[WhatsApp] Não foi possível atualizar a última interação do lead:', error.message);
  }, []);

  const loadMessages = useCallback(async (chatId: string, silent = false) => {
    const { data } = await supabase.from('whatsapp_messages')
      .select('id,chat_id,from_me,text,message_type,status,timestamp,media_url,media_mime,media_filename,wa_message_id,reply_to,sender')
      .eq('chat_id', chatId).order('timestamp', { ascending: false }).limit(80);
    // Repara links históricos localhost da WAHA: arquiva no bucket privado e gera URL temporária.
    const sourceMessages = ((data as Message[]) || []).filter(message => message.text !== '[crm_deleted]');
    const previousById = new Map(messagesRef.current.map(message => [message.id, message]));
    // Limita a quatro recuperações simultâneas: abrir um histórico com muitas mídias
    // não deve disparar dezenas de downloads/URLs assinadas ao mesmo tempo.
    const resolvedItems: Message[] = new Array(sourceMessages.length);
    let nextMediaIndex = 0;
    const resolveWorker = async () => {
      while (nextMediaIndex < sourceMessages.length) {
        const index = nextMediaIndex++;
        const message = sourceMessages[index];
        const url = message.media_url || '';
        const previous = previousById.get(message.id);
        const needsResolution = /localhost:3000\/api\/files\//i.test(url) || /\/storage\/v1\/object\/sign\/chat-media\//i.test(url);
        if (!url || !needsResolution) { resolvedItems[index] = message; continue; }
        // Evita refazer a requisição em cada polling se esta mídia já foi resolvida nesta sessão.
        // Reutiliza a URL já carregada em vez de renová-la em cada polling.
        // Se expirar, o onError da mídia faz a renovação sob demanda.
        const previousIsLocalSource = previous?.media_url
          ? /localhost:3000\/api\/files\//i.test(previous.media_url)
          : true;
        if (previous?.media_url && !previousIsLocalSource) {
          resolvedItems[index] = { ...message, media_url: previous.media_url };
          continue;
        }
        if (!selected?.instance_id) { resolvedItems[index] = message; continue; }
        try {
          const result = await waha.resolveMedia(selected.instance_id, message.id);
          resolvedItems[index] = typeof result?.url === 'string' && result.url ? { ...message, media_url: result.url } : message;
        } catch (error) {
          console.warn('Não foi possível recuperar mídia histórica do WhatsApp', message.id, error);
          resolvedItems[index] = message;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, sourceMessages.length) }, () => resolveWorker()));
    const list = resolvedItems.sort((a, b) => {
      const at = Date.parse(a.timestamp || '');
      const bt = Date.parse(b.timestamp || '');
      const av = Number.isFinite(at) ? at : 0;
      const bv = Number.isFinite(bt) ? bt : 0;
      return av - bv || String(a.id).localeCompare(String(b.id));
    });
    // Marcadores internos de exclusão nunca aparecem na interface.
    const sortedList = list;
    const orderedList = sortedList
      .filter(message => message.text !== '[crm_deleted]')
      .slice()
      .sort((a, b) => {
        const at = Date.parse(a.timestamp || '');
        const bt = Date.parse(b.timestamp || '');
        const av = Number.isFinite(at) ? at : 0;
        const bv = Number.isFinite(bt) ? bt : 0;
        return av - bv || String(a.id).localeCompare(String(b.id));
      });
    const previous = messagesRef.current;
    const merged = dropConfirmedTemps(orderedList, previous);
    // Mantém a última lista já resolvida em memória e no navegador para reabrir instantaneamente.
    const cacheKey = `${user?.id || 'anonymous'}:${instanceId}:${chatId}`;
    messagesCacheRef.current.set(cacheKey, merged);
    try {
      if (user?.id) localStorage.setItem(`whatsapp_messages_cache_${user.id}_${instanceId}_${chatId}`, JSON.stringify(merged));
    } catch { /* quota/armazenamento indisponível: cache em memória continua ativo */ }
    const changed = previous.length !== merged.length || previous.some((message, index) => {
      const next = merged[index];
      return !next || message.id !== next.id || message.text !== next.text || message.status !== next.status || message.media_url !== next.media_url;
    });
    if (changed) {
      messagesRef.current = merged;
      setMessages(current => dropConfirmedTemps(orderedList, current));
    }
    // Na carga inicial vai para a última mensagem; no polling só acompanha se novas mensagens chegaram
    // e o usuário já estava próximo do final. Ao ler mensagens antigas, preserva a posição.
    if (!silent || (changed && isMessagesViewportNearBottom())) {
      window.setTimeout(() => scrollToBottom(!silent), 100);
    }
  }, [selected?.instance_id, user?.id, instanceId]);

  useEffect(() => {
    if (!selected) return;
    const chatId = selected.id;
    // Reaproveita o histórico anterior antes de consultar Supabase/WAHA.
    const cacheKey = `${user?.id || 'anonymous'}:${instanceId}:${chatId}`;
    let cached = messagesCacheRef.current.get(cacheKey);
    if (!cached?.length && user?.id) {
      try {
        const saved = localStorage.getItem(`whatsapp_messages_cache_${user.id}_${instanceId}_${chatId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) cached = parsed as Message[];
        }
      } catch { /* cache inválido: será reconstruído pelo banco */ }
    }
    messagesChatIdRef.current = chatId;
    if (cached?.length) {
      messagesCacheRef.current.set(cacheKey, cached);
      messagesRef.current = cached;
      setMessages(cached);
    } else {
      messagesRef.current = [];
      setMessages([]);
    }
    setSelectedMessageIds([]);
    setSelectionMode(false);
    let cancelled = false;
    // Carrega primeiro o histórico local para resposta rápida e, em seguida,
    // sincroniza as mensagens reais da WAHA (até 100) ao abrir cada conversa.
    const hydrateConversation = async () => {
      await loadMessages(chatId);
      if (!instanceId) return;
      try {
        await waha.getMessages(instanceId, selected.wa_chat_id);
        if (!cancelled) await loadMessages(chatId, true);
      } catch (err: any) {
        // Mantém o histórico local disponível mesmo quando a WAHA estiver temporariamente indisponível.
        console.warn('[WhatsApp] Não foi possível sincronizar o histórico remoto:', err?.message || err);
      }
    };
    void hydrateConversation();

    // Foto de perfil: apenas 1 GET por conversa (Ryze /api/profile/getAccount)
    if (!selected.avatar_url && instanceId && !profilePicFetched.current.has(chatId)) {
      profilePicFetched.current.add(chatId);
      waha.getProfilePic(instanceId, selected.wa_chat_id)
        .then((res: any) => {
          const url = res?.avatar_url;
          if (!url) return;
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, avatar_url: url } : c));
          setSelected(prev => prev && prev.id === chatId ? { ...prev, avatar_url: url } : prev);
        })
        .catch(err => console.warn('[WhatsApp] Falha ao buscar foto de perfil:', err?.message));
    }

    const ch = supabase.channel(`wa-msgs-${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `chat_id=eq.${chatId}` },
        payload => {
          const m = payload.new as Message;
          if (!m.from_me) {
            const activeChat = selectedRef.current;
            if (activeChat?.id === chatId) void touchLeadInteraction(activeChat, m.timestamp);
          }
          const shouldFollowIncoming = isMessagesViewportNearBottom();
          setMessages(prev => {
            if (prev.some(x => x.id === m.id || (!!m.wa_message_id && x.wa_message_id === m.wa_message_id))) return prev;
            // descarta o balão otimista equivalente
            const cleaned = prev.filter(x => !(x.id.startsWith('temp-') && m.from_me &&
              (x.text || '').trim() === (m.text || '').trim()));
            return [...cleaned, m];
          });
          // Segue novas mensagens somente se o usuário já estava no fim; se estiver
          // lendo o histórico, preserva a posição para permitir scroll manual.
          if (shouldFollowIncoming) {
            requestAnimationFrame(() => scrollToBottom(false));
            window.setTimeout(() => scrollToBottom(false), 80);
          }

          // Notificação Push se não for minha e a janela estiver oculta ou outro chat selecionado
          if (!m.from_me && (document.hidden || selectedRef.current?.id !== chatId)) {
            const chat = chats.find(c => c.id === chatId);
            if (chat) showPushNotification(chat, m.text || 'Nova mensagem de mídia');
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages', filter: `chat_id=eq.${chatId}` },
        payload => {
          const m = payload.new as Message;
          if (m.text === '[crm_deleted]') {
            setMessages(prev => prev.filter(x => x.id !== m.id && (!m.wa_message_id || x.wa_message_id !== m.wa_message_id)));
            messagesRef.current = messagesRef.current.filter(x => x.id !== m.id && (!m.wa_message_id || x.wa_message_id !== m.wa_message_id));
            return;
          }
          setMessages(prev => prev.map(x => x.id === m.id ? m : x));
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'whatsapp_messages' },
        payload => {
          const deleted = payload.old as { id?: string; chat_id?: string; wa_message_id?: string };
          if (deleted.chat_id && deleted.chat_id !== chatId) return;
          setMessages(prev => prev.filter(message =>
            message.id !== deleted.id && (!deleted.wa_message_id || message.wa_message_id !== deleted.wa_message_id)
          ));
        })
      .subscribe();

    if (selected.unread_count > 0 && peeking !== chatId) {
      supabase.from('whatsapp_chats').update({ unread_count: 0 }).eq('id', chatId).then(() => {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, unread_count: 0 } : c));
      });
    }
    // Realtime é o caminho rápido; a consulta de fallback roda menos e só com a aba visível.
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadMessages(chatId, true);
    }, 10000);
    // Algumas versões da WAHA não emitem evento de revogação; reconcilia a origem remota
    // periodicamente para remover mensagens apagadas no celular sem fazer chamadas a cada 5s.
    const remoteSync = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || !instanceId) return;
      void waha.getMessages(instanceId, selected.wa_chat_id)
        .then(() => loadMessages(chatId, true))
        .catch(error => console.warn('[WhatsApp] Sincronização remota periódica falhou:', error?.message || error));
    }, 30000);
    return () => { cancelled = true; window.clearInterval(poll); window.clearInterval(remoteSync); supabase.removeChannel(ch); };
  }, [selected?.id, loadMessages, instanceId, touchLeadInteraction]);

  // Persiste atualizações em tempo real no cache correto, sem associar mensagens ao chat errado.
  useEffect(() => {
    if (!selected?.id || messagesChatIdRef.current !== selected.id) return;
    const cacheKey = `${user?.id || 'anonymous'}:${instanceId}:${selected.id}`;
    const currentMessages = messagesRef.current;
    messagesCacheRef.current.set(cacheKey, currentMessages);
    try {
      if (user?.id) localStorage.setItem(`whatsapp_messages_cache_${user.id}_${instanceId}_${selected.id}`, JSON.stringify(currentMessages));
    } catch { /* cache em memória permanece disponível */ }
  }, [messages, selected?.id, instanceId, user?.id]);

  const handleSend = async () => {
    if (!text.trim() || !selected || !instanceId) return;
    const msg = text.trim();
    setText('');
    // Envio otimista: a mensagem aparece na hora e é reconciliada pelo realtime
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId, chat_id: selected.id, from_me: true, text: msg,
      message_type: 'text', status: 'pending', timestamp: new Date().toISOString(), media_url: null, reply_to: replyingTo?.wa_message_id || null,
    }]);
    requestAnimationFrame(() => scrollToBottom(false));
    window.setTimeout(() => scrollToBottom(false), 80);
    try {
      if (!selected.assigned_to && user) {
        const { error: assignError } = await (supabase as any).rpc('take_over_whatsapp_chat', { p_chat_id: selected.id });
        if (assignError) throw assignError;
        setSelected(prev => prev?.id === selected.id ? { ...prev, assigned_to: user.id } : prev);
        setChats(prev => prev.map(chat => chat.id === selected.id ? { ...chat, assigned_to: user.id } : chat));
      }
      await waha.sendText(instanceId, selected.wa_chat_id || selected.contact_number, msg, replyingTo?.wa_message_id || undefined);
      await touchLeadInteraction(selected);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent', reply_to: replyingTo?.wa_message_id || null } : m));
      setReplyingTo(null);

    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setText(msg);
      toast({ title: 'Falha ao enviar', description: e.message, variant: 'destructive' });
    }

  };

  // ── Emoji ───────────────────────────────────────────────
  const insertEmoji = (emoji: string) => {
    setText(prev => prev + emoji);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // ── Anexos (arquivo, foto, vídeo, câmera) ───────────────
  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>, mediaType: 'image' | 'video' | 'document' | 'audio') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selected || !instanceId || !user) return;
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'O limite é de 25 MB.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadMedia(file, file.name, user.id);
      await waha.sendMedia(instanceId, selected.wa_chat_id || selected.contact_number, url, mediaType, text.trim() || undefined, file.type, file.name);
        await touchLeadInteraction(selected);
      setText('');
      loadMessages(selected.id);
      loadChats();
      toast({ title: 'Arquivo enviado' });
    } catch (err: any) {
      toast({ title: 'Falha ao enviar arquivo', description: err.message, variant: 'destructive' });
    } finally { setUploading(false); }
  };

  // ── Gravação de áudio ───────────────────────────────────
  const startRecording = async () => {
    if (!selected || !instanceId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      cancelRecRef.current = false;
      rec.ondataavailable = ev => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
        setRecording(false);
        setRecordSecs(0);
        if (cancelRecRef.current) return;
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 2000) {
          toast({ title: 'Áudio muito curto', description: 'Segure para gravar por mais tempo.', variant: 'destructive' });
          return;
        }
        setUploading(true);
        try {
          const ext = mime.includes('webm') ? 'webm' : 'm4a';
          const url = await uploadMedia(blob, `audio.${ext}`, user!.id);
          await waha.sendMedia(instanceId, selected.wa_chat_id || selected.contact_number, url, 'audio', undefined, mime, `audio.${ext}`);
        await touchLeadInteraction(selected);
          loadMessages(selected.id);
          loadChats();
        } catch (err: any) {
          toast({ title: 'Falha ao enviar áudio', description: err.message, variant: 'destructive' });
        } finally { setUploading(false); }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setRecordSecs(0);
      timerRef.current = window.setInterval(() => setRecordSecs(s => s + 1), 1000);
    } catch {
      toast({ title: 'Microfone indisponível', description: 'Permita o acesso ao microfone no navegador.', variant: 'destructive' });
    }
  };

  const stopRecording = (cancel = false) => {
    cancelRecRef.current = cancel;
    recorderRef.current?.stop();
    recorderRef.current = null;
  };

  // ── Nova conversa ───────────────────────────────────────
  const handleStartNewChat = async () => {
    const digits = onlyDigits(newChatNumber);
    if (!digits || !instanceId) return;
    const number = digits.length <= 11 ? `55${digits}` : digits;
    setStartingChat(true);
    try {
      if (forwardMessages.length > 0) {
        for (const item of forwardMessages) {
          if (item.media_url) {
            let mediaUrl = item.media_url;
            try {
              const resolved = await waha.resolveMedia(instanceId, item.id);
              if (typeof resolved?.url === 'string' && resolved.url) mediaUrl = resolved.url;
            } catch (resolveError) {
              console.warn('[WhatsApp] Não foi possível renovar mídia para encaminhar; tentando URL atual.', item.id, resolveError);
            }
            await waha.sendMedia(
              instanceId, number, mediaUrl, item.message_type || 'document',
              item.text?.trim() || undefined, item.media_mime || 'application/octet-stream',
              item.media_filename || (item.media_mime?.startsWith('image/') ? 'imagem' : 'arquivo')
            );
          } else if (item.text?.trim()) {
            await waha.sendText(instanceId, number, item.text.trim());
          }
        }
        if (newChatMessage.trim()) {
          await waha.sendText(instanceId, number, newChatMessage.trim());
        }
      } else if (newChatMessage.trim()) {
        await waha.sendText(instanceId, number, newChatMessage.trim());
      }
      await loadChats();
      const { data } = await supabase.from('whatsapp_chats').select('*')
        .eq('instance_id', instanceId).ilike('contact_number', `%${digits}%`).limit(1);
      const chat = (data as Chat[])?.[0];
      if (chat) setSelected(chat);
      setNewChatOpen(false);
      setNewChatNumber(''); setNewChatMessage(''); setNewChatSearch('');
      const wasForwarding = forwardMessages.length > 0;
      setForwardMessages([]);
      setSelectedMessageIds([]);
      setSelectionMode(false);
      toast({ title: wasForwarding ? `${forwardMessages.length} mensagem(ns) encaminhada(s)` : newChatMessage.trim() ? 'Mensagem enviada' : 'Conversa aberta' });
    } catch (e: any) {
      toast({ title: 'Falha ao iniciar conversa', description: e.message, variant: 'destructive' });
    } finally { setStartingChat(false); }
  };



  const handleNumberClick = (number: string) => {
    setNewChatNumber(number);
    setNewChatOpen(true);
    setNewChatMessage('');
    setForwardMessages([]);
  };

  const handleSync = async () => {
    if (!instanceId) return;
    setSyncing(true);
    try {
      await waha.getChats(instanceId);
      toast({ title: 'Conversas sincronizadas com sucesso' });
      loadChats();
    } catch (e: any) {
      toast({ title: 'Erro na Sincronização', description: e.message, variant: 'destructive' });
    } finally { setSyncing(false); }
  };

  const handleSyncMessages = async () => {
    if (!instanceId || !selected) return;
    try {
      await waha.getMessages(instanceId, selected.wa_chat_id);
      loadMessages(selected.id);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  // Funis e etapas vêm do banco; atualize a lista em tempo real quando o Kanban mudar.
  useEffect(() => {
    let cancelled = false;
    const loadKanbanMetadata = async () => {
      const [stageResult, funnelResult] = await Promise.all([
        supabase.from('kanban_stages').select('key, label, funnel').order('position'),
        supabase.from('sectors').select('key, label').order('position'),
      ]);
      if (cancelled) return;
      if (stageResult.error) console.error('[WhatsApp] Falha ao carregar etapas:', stageResult.error.message);
      if (funnelResult.error) console.error('[WhatsApp] Falha ao carregar funis:', funnelResult.error.message);
      setKanbanStages((stageResult.data as any[]) || []);
      const funnels = (funnelResult.data as any[] || []).map(f => ({ key: String(f.key), label: String(f.label || f.key) }));
      const known = new Map<string, { key: string; label: string }>();
      [{ key: 'spc', label: 'SPC Brasil' }, ...funnels].forEach(f => { if (!known.has(f.key)) known.set(f.key, f); });
      setKanbanFunnels(Array.from(known.values()).filter(f => f.key !== 'comercial'));
    };
    void loadKanbanMetadata();
    const channel = supabase.channel('whatsapp-kanban-metadata')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_stages' }, () => { void loadKanbanMetadata(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sectors' }, () => { void loadKanbanMetadata(); })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  const getStagesForFunnel = (funnel: string) => {
    const unique = new Map<string, { key: string; label: string; funnel: string }>();
    kanbanStages
      .filter(stage => stage.funnel === funnel)
      .forEach(stage => { if (!unique.has(stage.key)) unique.set(stage.key, stage); });
    return Array.from(unique.values());
  };

  // Notificações de atendimento transferido: persistidas no banco e entregues em tempo real.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const loadNotifications = async () => {
      const { data, error } = await (supabase as any).from('whatsapp_notifications')
        .select('id,title,body,chat_id,created_at,read_at').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(20);
      if (error) {
        console.warn('[WhatsApp] Não foi possível carregar notificações:', error.message);
        return;
      }
      if (!cancelled) setNotifications((data || []) as WhatsAppNotification[]);
    };
    void loadNotifications();
    const channel = supabase.channel(`whatsapp-notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_notifications', filter: `user_id=eq.${user.id}` }, payload => {
        const item = payload.new as WhatsAppNotification;
        setNotifications(prev => [item, ...prev.filter(old => old.id !== item.id)].slice(0, 20));
        toast({ title: item.title, description: item.body });
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(item.title, { body: item.body, icon: '/favicon.ico' });
        }
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user?.id]);

  // Fonte única das cores pessoais: preferências salvas no banco.
  // Espera a sessão carregar e atualiza também ao retornar à aba.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const loadAgentColors = async () => {
      const { data, error } = await (supabase as any)
        .from('whatsapp_agent_preferences')
        .select('user_id,display_name,color');
      if (error) {
        console.warn('[WhatsApp] Preferências de cor ainda indisponíveis:', error.message);
        return;
      }
      if (!cancelled) {
        const map: Record<string, { display_name: string; color: string }> = {};
        (data || []).forEach((item: any) => {
          if (item.user_id && item.color) {
            map[item.user_id] = { display_name: item.display_name, color: item.color };
          }
        });
        setAgentColors(map);
      }
    };
    void loadAgentColors();
    const channel = supabase.channel(`whatsapp-agent-preferences-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_agent_preferences' }, () => { void loadAgentColors(); })
      .subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') void loadAgentColors(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Open lead registration modal pre-filled with contact info
  const handleOpenLeadDialog = () => {
    if (!selected) return;
    if (selected.lead_id) {
      toast({ title: 'Lead já cadastrado', description: 'Este contato já está vinculado ao Kanban. Use “Status do Kanban” para mover sua coluna.' });
      return;
    }
    setLeadName(selected.contact_name || '');
    setLeadPhone(selected.contact_number.replace('@s.whatsapp.net', '').replace('@c.us', ''));
    const preferredFunnel = kanbanFunnels.find(f => f.key === 'spc')?.key || kanbanFunnels[0]?.key || 'spc';
    setLeadFunnel(preferredFunnel);
    setLeadStage('lead_novo');
    setLeadAssignee(selected.assigned_to || user?.id || '');
    setLeadDialog(true);
  };

  // Register selected contact as a lead in the chosen funnel/stage
  const handleRegisterLead = async () => {
    if (!leadName.trim() || !user) return;
    setSavingLead(true);
    try {
      const parsedPlanValue = leadFunnel === 'spc' ? parsePlanValue(leadPlanValue) : null;
      if (leadFunnel === 'spc' && leadPlanValue.trim() && (parsedPlanValue === null || !Number.isFinite(parsedPlanValue) || parsedPlanValue < 0)) {
        throw new Error('Informe um valor de plano válido, por exemplo 1.000,00.');
      }
      const digits = onlyDigits(leadPhone);
      if (digits.length >= 10 && selected) {
        const { data: existingLeads, error: lookupError } = await supabase.from('leads').select('id,phone,whatsapp,status,funnel,assigned_to');
        if (lookupError) throw lookupError;
        const matches = (existingLeads || []).filter((lead: any) =>
          [onlyDigits(lead.phone || ''), onlyDigits(lead.whatsapp || '')].filter(Boolean)
            .some(number => number === digits || (number.length >= 10 && number.slice(-11) === digits.slice(-11)))
        );
        const uniqueMatches = Array.from(new Map<string, any>(matches.map((lead: any) => [lead.id, lead] as [string, any])).values());
        if (uniqueMatches.length > 1) throw new Error('Há mais de um lead com este telefone. Revise os cadastros antes de vincular.');
        if (uniqueMatches.length === 1) {
          const existing = uniqueMatches[0];
          if (leadFunnel === 'spc' && (leadPlanValue.trim() || leadBiro.trim())) {
            const planValue = leadPlanValue.trim() ? parsedPlanValue : null;
            if (planValue !== null && !Number.isFinite(planValue)) throw new Error('Informe um valor de plano válido.');
            const { error: detailsError } = await supabase.from('leads').update({
              ...(planValue !== null ? { plan_value: planValue } : {}),
              ...(leadBiro.trim() ? { biro: leadBiro.trim() } : {}),
            }).eq('id', existing.id);
            if (detailsError) throw detailsError;
          }
          if (leadAssignee && leadAssignee !== existing.assigned_to) {
            const { error: assignError } = await supabase.rpc('assign_lead_to_user', { p_lead_id: existing.id, p_assignee: leadAssignee });
            if (assignError) throw assignError;
          }
          const { error: linkError } = await (supabase as any).from('whatsapp_chats').update({ lead_id: existing.id, funnel_stage: existing.status }).eq('id', selected.id);
          if (linkError) throw linkError;
          setSelected(prev => prev?.id === selected.id ? { ...prev, lead_id: existing.id, funnel_stage: existing.status } : prev);
          setChats(prev => prev.map(chat => chat.id === selected.id ? { ...chat, lead_id: existing.id, funnel_stage: existing.status } : chat));
          setLeadDialog(false);
          toast({ title: 'Lead existente vinculado', description: 'O contato já estava cadastrado e agora está vinculado à conversa.' });
          return;
        }
      }
      const { data: newLead, error } = await supabase.from('leads').insert({
        user_id: user.id,
        name: leadName.trim(),
        phone: leadPhone.trim(),
        whatsapp: leadPhone.trim(),
        status: leadStage,
        funnel: leadFunnel,
        plan_value: leadFunnel === 'spc' ? parsedPlanValue : null,
        biro: leadFunnel === 'spc' ? (leadBiro.trim() || null) : null,
        assigned_to: leadAssignee || user.id,
        type: 'PJ',
        origin: 'WhatsApp',
      }).select('id').single();
      if (error) throw error;
      if (!newLead?.id || !selected) throw new Error('Lead criado, mas não foi possível identificar a conversa para vincular.');
      const { error: linkError } = await (supabase as any).from('whatsapp_chats').update({
        lead_id: newLead.id,
        funnel_stage: leadStage,
        assigned_to: selected.assigned_to || user.id,
      }).eq('id', selected.id);
      if (linkError) throw linkError;
      setSelected(prev => prev?.id === selected.id ? { ...prev, lead_id: newLead.id, funnel_stage: leadStage, assigned_to: prev.assigned_to || user.id } : prev);
      setChats(prev => prev.map(chat => chat.id === selected.id ? { ...chat, lead_id: newLead.id, funnel_stage: leadStage, assigned_to: chat.assigned_to || user.id } : chat));
      toast({
        title: '✅ Lead cadastrado!',
        description: `${leadName} adicionado ao funil. Redirecionando...`,
      });
      setLeadDialog(false);
      setLeadPlanValue('');
      setLeadBiro('');
      setTimeout(() => navigate('/crm'), 1200);
    } catch (e: any) {
      toast({ title: 'Erro ao cadastrar lead', description: e.message, variant: 'destructive' });
    } finally { setSavingLead(false); }
  };

  const handleOpenAssignmentHistory = async () => {
    if (!selected) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await (supabase as any).from('whatsapp_chat_assignment_history')
        .select('id,previous_assignee,new_assignee,changed_by,changed_at')
        .eq('chat_id', selected.id).order('changed_at', { ascending: false }).limit(50);
      if (error) throw error;
      setAssignmentHistory(data || []);
      setHistoryDialogOpen(true);
    } catch (e: any) {
      toast({ title: 'Não foi possível carregar o histórico', description: e.message || 'Tente novamente.', variant: 'destructive' });
    } finally { setLoadingHistory(false); }
  };

  const handleCloseService = async (sendSurvey: boolean) => {
    if (!selected || !instanceId || !user || isGroupChat(selected) || closingService) return;
    setCloseServiceDialogOpen(false);
    setClosingService(true);
    let sessionId: string | null = null;
    try {
      const db = supabase as any;
      const { data: activeSession, error: activeError } = await db.from('whatsapp_service_sessions').select('id,started_at').eq('chat_id', selected.id).is('closed_at', null).order('started_at', { ascending: false }).limit(1).maybeSingle();
      if (activeError) throw activeError;
      const now = new Date();
      let startedAt = now.toISOString();
      if (activeSession?.id) { sessionId = activeSession.id; if (activeSession.started_at) startedAt = activeSession.started_at; }
      else {
        const { data: firstMessage, error: firstMessageError } = await db.from('whatsapp_messages').select('timestamp').eq('chat_id', selected.id).order('timestamp', { ascending: true }).limit(1).maybeSingle();
        if (firstMessageError) throw firstMessageError;
        if (firstMessage?.timestamp) startedAt = firstMessage.timestamp;
        const { data: created, error: createError } = await db.from('whatsapp_service_sessions').insert({ chat_id: selected.id, instance_id: selected.instance_id, assigned_to: selected.assigned_to || user.id, created_by: user.id, status: 'in_progress', started_at: startedAt, last_activity_at: now.toISOString() }).select('id').single();
        if (createError) throw createError;
        sessionId = created.id;
      }
      const started = new Date(startedAt).getTime();
      const durationSeconds = Number.isFinite(started) ? Math.max(0, Math.floor((now.getTime() - started) / 1000)) : 0;
      const { error: closeError } = await db.from('whatsapp_service_sessions').update({
        status: 'closed', closed_at: now.toISOString(), duration_seconds: durationSeconds,
        last_activity_at: now.toISOString(), close_reason: 'agent_closed',
        survey_status: sendSurvey ? 'pending' : 'skipped', updated_at: now.toISOString()
      }).eq('id', sessionId);
      if (closeError) throw closeError;

      const recipient = selected.wa_chat_id || selected.contact_number;
      if (!sendSurvey) {
        const closingMessage = 'Agradecemos o seu contato com a Future Soluções! 😊\\n\\nEste atendimento foi encerrado. Se precisar de ajuda novamente, é só nos enviar uma mensagem. Estamos à disposição!';
        try {
          await waha.sendText(instanceId, recipient, closingMessage);
          toast({ title: 'Atendimento encerrado', description: 'Mensagem de encerramento enviada sem pesquisa de satisfação.' });
        } catch (sendError: any) {
          toast({ title: 'Atendimento encerrado, mas a mensagem não foi enviada', description: sendError?.message || 'Confira a conexão do WhatsApp e envie a mensagem manualmente.', variant: 'destructive' });
        }
        return;
      }

      const survey = 'Como você avalia o atendimento da Future Soluções? ⭐\\n\\nResponda com uma nota de 1 a 5:\\n1 ⭐ — Muito ruim\\n2 ⭐⭐ — Ruim\\n3 ⭐⭐⭐ — Regular\\n4 ⭐⭐⭐⭐ — Bom\\n5 ⭐⭐⭐⭐⭐ — Excelente';
      try {
        await waha.sendText(instanceId, recipient, survey);
        const { error: surveyUpdateError } = await db.from('whatsapp_service_sessions').update({ survey_status: 'sent', survey_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', sessionId);
        if (surveyUpdateError) throw surveyUpdateError;
        toast({ title: 'Atendimento encerrado', description: 'Pesquisa de satisfação enviada ao cliente.' });
      } catch (sendError: any) {
        await db.from('whatsapp_service_sessions').update({ survey_status: 'failed', updated_at: new Date().toISOString() }).eq('id', sessionId);
        throw new Error('Atendimento encerrado, mas não foi possível enviar a pesquisa: ' + (sendError?.message || 'erro de envio'));
      }
    } catch (e: any) {
      toast({ title: 'Não foi possível encerrar o atendimento', description: e.message || 'Tente novamente.', variant: 'destructive' });
    } finally { setClosingService(false); }
  };
  const handleTransferChat = async () => {
    if (!selected || !user || !transferAssignee) return;
    if (transferAssignee === selected.assigned_to) { toast({ title: 'Esta conversa já está atribuída a esse usuário.' }); return; }
    setTransferringChat(true);
    try {
      const previousAssignee = selected.assigned_to;
      const { error: chatError } = await (supabase as any).from('whatsapp_chats').update({ assigned_to: transferAssignee }).eq('id', selected.id);
      if (chatError) throw chatError;
      if (selected.lead_id) {
        const { error: leadError } = await supabase.rpc('assign_lead_to_user', { p_lead_id: selected.lead_id, p_assignee: transferAssignee });
        if (leadError) throw leadError;
      }
      const { error: historyError } = await (supabase as any).from('whatsapp_chat_assignment_history').insert({ chat_id: selected.id, previous_assignee: previousAssignee, new_assignee: transferAssignee, changed_by: user.id });
      if (historyError) throw historyError;
      const recipient = leadAssignees.find(member => member.user_id === transferAssignee);
      setSelected(prev => prev?.id === selected.id ? { ...prev, assigned_to: transferAssignee } : prev);
      setChats(prev => prev.map(chat => chat.id === selected.id ? { ...chat, assigned_to: transferAssignee } : chat));
      setTransferDialogOpen(false); setTransferAssignee('');
      toast({ title: 'Conversa transferida', description: 'Responsabilidade transferida para ' + (recipient?.display_name || recipient?.email || 'o usuário selecionado') + '.' });
    } catch (e: any) {
      toast({ title: 'Falha ao transferir conversa', description: e.message || 'Confira as permissões e tente novamente.', variant: 'destructive' });
    } finally { setTransferringChat(false); }
  };

  const handleTakeOver = async () => {
    if (!selected || !user) return;
    try {
      const { error } = await (supabase as any).rpc('take_over_whatsapp_chat', { p_chat_id: selected.id });
      if (error) throw error;
      if (selected.lead_id) {
        const { error: leadAssignmentError } = await supabase.rpc('assign_lead_to_user', {
          p_lead_id: selected.lead_id,
          p_assignee: user.id,
        });
        if (leadAssignmentError) {
          toast({ title: 'Atendimento assumido, mas o lead não foi sincronizado', description: leadAssignmentError.message, variant: 'destructive' });
          return;
        }
      }
      setSelected(prev => prev?.id === selected.id ? { ...prev, assigned_to: user.id } : prev);
      setChats(prev => prev.map(chat => chat.id === selected.id ? { ...chat, assigned_to: user.id } : chat));
      toast({ title: 'Atendimento assumido', description: 'A responsabilidade foi atualizada e registrada no histórico.' });
    } catch (e: any) {
      toast({ title: 'Não foi possível assumir o atendimento', description: e.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleMarkNotificationRead = async (item: WhatsAppNotification) => {
    if (item.read_at) return;
    const readAt = new Date().toISOString();
    const { error } = await (supabase as any).from('whatsapp_notifications').update({ read_at: readAt }).eq('id', item.id);
    if (error) {
      toast({ title: 'Não foi possível marcar como lida', description: error.message, variant: 'destructive' });
      return;
    }
    setNotifications(prev => prev.map(old => old.id === item.id ? { ...old, read_at: readAt } : old));
    if (item.chat_id) {
      const chat = chats.find(old => old.id === item.chat_id);
      if (chat) { setInstanceId(chat.instance_id); setSelected(chat); }
    }
    setNotificationsOpen(false);
  };

  const handleOpenStatusDialog = async () => {
    if (!selected) return;
    let leadId = selected.lead_id || null;

    // Legacy chats may predate lead_id; link only when the phone matches one unique lead.
    if (!leadId) {
      const { data: leadsByPhone, error: searchError } = await supabase.from('leads')
        .select('id,phone,whatsapp,status,funnel');
      if (searchError) {
        toast({ title: 'Não foi possível localizar o lead', description: searchError.message, variant: 'destructive' });
        return;
      }
      const digits = onlyDigits(selected.contact_number);
      const matches = (leadsByPhone || []).filter((lead: any) => {
        const numbers = [onlyDigits(lead.phone || ''), onlyDigits(lead.whatsapp || '')].filter(Boolean);
        return numbers.some(number => number === digits || (number.length >= 10 && digits.length >= 10 && number.slice(-11) === digits.slice(-11)));
      });
      const uniqueMatches = Array.from(new Map<string, any>(matches.map((lead: any) => [lead.id, lead] as [string, any])).values());
      if (uniqueMatches.length > 1) {
        toast({ title: 'Vínculo ambíguo', description: 'Há mais de um lead com este telefone. Revise os cadastros antes de alterar o status.', variant: 'destructive' });
        return;
      }
      if (uniqueMatches.length === 0) {
        toast({ title: 'Contato ainda não está no Kanban', description: 'Use “Lead no Funil” para cadastrar este contato antes de alterar sua coluna.', variant: 'destructive' });
        return;
      }
      const matchedLead = uniqueMatches[0];
      const { error: linkError } = await (supabase as any).from('whatsapp_chats')
        .update({ lead_id: matchedLead.id, funnel_stage: matchedLead.status })
        .eq('id', selected.id);
      if (linkError) {
        toast({ title: 'Não foi possível vincular o contato', description: linkError.message, variant: 'destructive' });
        return;
      }
      leadId = matchedLead.id;
      setSelected(prev => prev?.id === selected.id ? { ...prev, lead_id: matchedLead.id, funnel_stage: matchedLead.status } : prev);
      setChats(prev => prev.map(chat => chat.id === selected.id ? { ...chat, lead_id: matchedLead.id, funnel_stage: matchedLead.status } : chat));
    }

    const { data, error } = await supabase.from('leads').select('id,status,funnel').eq('id', leadId).maybeSingle();
    if (error || !data) {
      toast({ title: 'Não foi possível carregar o status do lead', description: error?.message || 'Confira se o contato está vinculado ao Kanban.', variant: 'destructive' });
      return;
    }
    const funnel = data.funnel || 'spc';
    setStatusFunnel(funnel);
    setStatusStage(data.status || selected.funnel_stage || 'lead_novo');
    setStatusDialogOpen(true);
  };

  const handleSaveKanbanStatus = async () => {
    if (!selected || !statusStage || savingStatus) return;
    setSavingStatus(true);
    try {
      const { data, error } = await (supabase as any).rpc('set_whatsapp_chat_kanban_status', {
        p_chat_id: selected.id,
        p_stage: statusStage,
      });
      if (error) throw error;
      const savedStage = (data as any)?.status || statusStage;
      setSelected(prev => prev?.id === selected.id ? { ...prev, funnel_stage: savedStage } : prev);
      setChats(prev => prev.map(chat => chat.id === selected.id ? { ...chat, funnel_stage: savedStage } : chat));
      setStatusDialogOpen(false);
      toast({ title: 'Status do Kanban atualizado', description: 'A coluna da conversa e do lead foi atualizada.' });
    } catch (e: any) {
      toast({ title: 'Não foi possível alterar o status', description: e.message || 'Tente novamente.', variant: 'destructive' });
    } finally { setSavingStatus(false); }
  };

  // Grupos vão exclusivamente para a aba "Grupos"
  const isGroupChat = (c: Chat) => !!c.is_group || c.wa_chat_id.includes('@g.us');

  const matchesFilter = (c: Chat, f: typeof activeFilter) => {
    if (f === 'grupos') return isGroupChat(c);
    if (isGroupChat(c)) return false;
    if (f === 'aguardando') return c.unread_count > 0 || !c.assigned_to;
    if (f === 'resolvidos') return !!c.assigned_to && c.unread_count === 0;
    return true;
  };

  // Contadores de não lidas por aba
  const uniqueDisplayChats = useMemo(() => deduplicateChatsForDisplay(chats), [chats]);
  const tabUnread = (f: typeof activeFilter) =>
    uniqueDisplayChats.filter(c => matchesFilter(c, f)).reduce((s, c) => s + (c.unread_count || 0), 0);
  const tabCount = (f: typeof activeFilter) => uniqueDisplayChats.filter(c => matchesFilter(c, f)).length;

  // Filter chats by tab & search query
  const filteredChats = uniqueDisplayChats.filter(c => {
    const matchSearch = !search ||
      (c.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
      c.contact_number.includes(onlyDigits(search) || search);
    if (!matchSearch) return false;
    return matchesFilter(c, activeFilter);
  }).sort((a, b) => {
    // 1. Fixados (Pined) no topo
    const ap = a.is_pinned ? 1 : 0;
    const bp = b.is_pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;

    // 2. Conversas com mensagens novas (não lidas) logo abaixo dos fixados
    const au = a.unread_count > 0 ? 1 : 0;
    const bu = b.unread_count > 0 ? 1 : 0;
    if (au !== bu) return bu - au;

    // 3. Ordem cronológica
    return new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime();
  });

  // Participantes do grupo (a partir dos remetentes das mensagens carregadas)
  const groupParticipants = Array.from(
    new Set(messages.filter(m => !m.from_me && m.sender).map(m => String(m.sender)))
  );

  const handleShareContact = async () => {
    if (!selected) return;
    const name = chatTitle(selected);
    const phone = formatNumber(selected.contact_number);
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;TYPE=CELL:${selected.contact_number}\nEND:VCARD`;
    try {
      await navigator.clipboard.writeText(`${name}\n${phone}\n\n${vcard}`);
      toast({ title: 'Contato preparado para compartilhar', description: 'Nome e telefone copiados. Cole no destino desejado.' });
    } catch {
      toast({ title: 'Não foi possível copiar o contato', description: 'Verifique a permissão de área de transferência do navegador.', variant: 'destructive' });
    }
  };

  const openContactEditor = () => {
    if (!selected) return;
    setContactNameInput(hasRealName(selected) ? selected.contact_name || '' : '');
    setContactPanelOpen(false);
    setSaveContactOpen(true);
  };

  const contactLinks = messages.filter(m => /https?:\/\/|www\./i.test(m.text || ''));
  const contactMedia = messages.filter(m => !!m.media_url && /image|photo|sticker|video|audio|ptt/i.test(m.message_type || ''));
  const contactDocs = messages.filter(m => !!m.media_url && /document|file|application|pdf/i.test(`${m.message_type || ''} ${m.media_mime || ''}`));
  const panelMessages = contactPanelTab === 'media' ? contactMedia : contactPanelTab === 'links' ? contactLinks : contactPanelTab === 'docs' ? contactDocs : [];
  const filteredPanelMessages = panelMessages.filter(m => !contactSearch.trim() || `${m.text || ''} ${m.media_url || ''}`.toLowerCase().includes(contactSearch.toLowerCase()));

  const handleContactAction = (action: 'clear' | 'block' | 'report') => {
    if (!selected) return;
    if (action === 'clear') {
      toast({ title: 'Limpeza do histórico requer confirmação', description: 'Para preservar registros e auditoria, a exclusão em massa será implementada após definir o escopo: apenas no CRM ou também no WhatsApp.' });
      return;
    }
    if (action === 'block') {
      toast({ title: 'Bloqueio não executado', description: 'A integração WAHA atualmente usada nesta tela não expõe uma operação de bloqueio confirmada. Não vamos simular um bloqueio real.' });
      return;
    }
    toast({ title: 'Denúncia não enviada ao WhatsApp', description: 'A integração atual não confirma suporte à denúncia oficial. Use esta opção somente após implementarmos um fluxo interno auditável.' });
  };

  // Salvar nome do contato
  const handleSaveContact = async () => {
    if (!selected || !contactNameInput.trim()) return;
    setSavingContact(true);
    try {
      const { error } = await supabase.from('whatsapp_chats')
        .update({ contact_name: contactNameInput.trim() }).eq('id', selected.id);
      if (error) throw error;
      setSelected(prev => prev ? { ...prev, contact_name: contactNameInput.trim() } : prev);
      setSaveContactOpen(false);
      loadChats();
      toast({ title: 'Contato salvo' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar contato', description: e.message, variant: 'destructive' });
    } finally { setSavingContact(false); }
  };

  const totalOtherUnread = Object.entries(instanceUnread)
    .filter(([id]) => id !== instanceId)
    .reduce((s, [, v]) => s + v, 0);



  return (
    <>
    <div className={`flex flex-col h-[calc(100vh-64px)] ${menuLayout === 'horizontal' ? 'md:h-[calc(100dvh-76px)]' : 'md:h-screen'} bg-background font-sans overflow-hidden fixed inset-0 md:relative z-40`}>
      {/* Top Bar: Instance Selection & Global Actions */}
      <div className="flex items-center justify-between px-2 py-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">WhatsApp</h1>
          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
            {chats.length} conversas
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Select value={instanceId} onValueChange={setInstanceId}>
              <SelectTrigger className="w-56 h-9 bg-card text-xs">
                <SelectValue placeholder="Selecionar instância" />
              </SelectTrigger>
              <SelectContent>
                {instances.map(i => (
                  <SelectItem key={i.id} value={i.id} className="text-xs">
                    <span className="flex items-center gap-2">
                      {i.name} {i.status === 'connected' ? '🟢' : '⚫'}
                      {(instanceUnread[i.id] || 0) > 0 && (
                        <span className="bg-purple-600 text-white rounded-full px-1.5 text-[10px] font-bold">
                          {instanceUnread[i.id]}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {totalOtherUnread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-purple-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow">
                {totalOtherUnread}
              </span>
            )}
          </div>
          <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <PopoverTrigger asChild>
              <Button size="icon" variant="outline" className="relative h-9 w-9" aria-label="Notificações de atendimento">
                <Bell size={16} />
                {unreadNotifications > 0 && <span className="absolute -right-1 -top-1 min-w-[17px] h-[17px] rounded-full bg-red-600 px-1 text-[10px] font-bold text-white flex items-center justify-center">{unreadNotifications}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="border-b p-3 flex items-center justify-between"><p className="font-semibold text-sm">Notificações</p><Badge variant="secondary">{unreadNotifications} não lidas</Badge></div>
              <div className="max-h-80 overflow-y-auto divide-y">
                {notifications.map(item => <button key={item.id} onClick={() => void handleMarkNotificationRead(item)} className={`w-full text-left p-3 hover:bg-muted/60 ${item.read_at ? 'opacity-70' : 'bg-purple-50/60 dark:bg-purple-950/20'}`}>
                  <p className="text-sm font-medium">{item.title}</p><p className="text-xs text-muted-foreground mt-1">{item.body}</p><p className="text-[10px] text-muted-foreground mt-2">{new Date(item.created_at).toLocaleString('pt-BR')}</p>
                </button>)}
                {notifications.length === 0 && <p className="p-4 text-xs text-muted-foreground text-center">Nenhuma notificação ainda.</p>}
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="h-9 gap-1 text-xs">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* Main Grid Layout (Competitor Style) */}
      <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-0 border-t overflow-hidden flex-1 min-h-0 bg-card">
        
        {/* Left Column: Chat List Sidebar */}
        <div className={`flex flex-col min-h-0 overflow-hidden border-r bg-background relative ${isMobile && mobileShowChat ? 'hidden' : 'flex'}`}>

          
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
              {([
                { key: 'todos', label: 'Todos' },
                { key: 'grupos', label: 'Grupos' },
                { key: 'aguardando', label: 'Aguardando' },
                { key: 'resolvidos', label: 'Resolvidos' },
              ] as { key: typeof activeFilter; label: string }[]).map(tab => {
                const unread = tabUnread(tab.key);
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFilter(tab.key)}
                    className={`relative flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                      activeFilter === tab.key
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      activeFilter === tab.key ? 'bg-purple-700/50 text-white' : 'bg-muted-foreground/20 text-foreground'
                    }`}>
                      {tabCount(tab.key)}
                    </span>
                    {unread > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center shadow">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conversations List */}
          <ScrollArea className="flex-1">
            <div className="divide-y divide-border/40">
              {filteredChats.map((c, idx) => {
                const name = chatTitle(c);
                const isSelected = selected?.id === c.id;
                const avatarColor = getAvatarColor(name);
                const initials = getInitials(name);
                const timeStr = c.last_message_at
                  ? new Date(c.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : '';
                
                // Left border indicator colors
                const indicatorColors = ['bg-amber-400', 'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500'];
                const indicatorColor = indicatorColors[idx % indicatorColors.length];
                const assignedAgent = c.assigned_to ? agentColors[c.assigned_to] : undefined;

                return (
                  <div key={c.id} className="group relative">
                    <button
                      onClick={() => {
                        setPeeking(null);
                        setSelected(c);
                        if (isMobile) setMobileShowChat(true);
                        // Limpa contador ao abrir (exceto se estiver apenas espiando)
                        if (c.unread_count > 0) {
                          setChats(prev => prev.map(p => p.id === c.id ? { ...p, unread_count: 0 } : p));
                          supabase.from('whatsapp_chats').update({ unread_count: 0 }).eq('id', c.id).then(() => {});
                        }
                      }}
                      className={`w-full flex items-center gap-3 p-3 text-left relative transition-all hover:bg-muted/50 ${
                        isSelected ? 'bg-muted/80' : ''
                      }`}
                    >
                      {/* Left vertical color bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${assignedAgent ? '' : indicatorColor}`} style={assignedAgent ? { backgroundColor: assignedAgent.color } : undefined} />

                      {/* Avatar Circle */}
                      <div className="relative flex-shrink-0">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt={name} loading="lazy"
                            className="w-11 h-11 rounded-full object-cover shadow-sm border border-border/50" />
                        ) : (
                          <div className={`w-11 h-11 rounded-full ${avatarColor} flex items-center justify-center font-bold text-sm shadow-sm border border-border/50`}>
                            {initials}
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 text-white rounded-full p-0.5 border-2 border-background">
                          <MessageSquare size={10} className="fill-current" />
                        </div>
                      </div>

                      {/* Chat Content Preview */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {c.is_pinned && <Pin size={10} className="text-purple-600 fill-current flex-shrink-0" />}
                            <span className="font-semibold text-xs text-foreground truncate">{name}</span>
                            {assignedAgent && <span title={`Responsável: ${assignedAgent.display_name}`} className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground flex-shrink-0"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: assignedAgent.color }} />{assignedAgent.display_name}</span>}
                          </div>
                          {timeStr && <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeStr}</span>}
                        </div>
                        <p className={`text-xs truncate mt-0.5 pr-6 ${c.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                          {c.last_message?.includes('[message_revoke]') ? '🚫 Mensagem apagada' : (c.last_message || 'Clique para abrir')}
                        </p>
                      </div>

                      {/* Badges / Unread */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 min-w-[20px]">
                        {c.unread_count > 0 && (
                          <span className="bg-green-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center shadow-sm">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Hover Actions (Pin & Peek) */}
                    <div className="absolute right-2 bottom-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-full bg-background/90 shadow-sm border text-muted-foreground hover:text-purple-600"
                        onClick={(e) => { e.stopPropagation(); togglePin(c); }}
                        title={c.is_pinned ? "Desafixar" : "Fixar"}
                      >
                        {c.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-full bg-background/90 shadow-sm border text-muted-foreground hover:text-blue-600"
                        onClick={(e) => { e.stopPropagation(); setPeeking(c.id); setSelected(c); }}
                        title="Espiar (não marcar como lida)"
                      >
                        <Eye size={14} />
                      </Button>
                    </div>
                  </div>
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
          <button
            onClick={() => setNewChatOpen(true)}
            title="Nova conversa"
            className="absolute bottom-4 left-4 w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            <Plus size={22} />
          </button>

        </div>

        {/* Right Column: Active Conversation Area */}
        <div className={`flex flex-col min-h-0 h-full bg-slate-50/50 dark:bg-zinc-900/50 relative ${isMobile && !mobileShowChat ? 'hidden md:flex' : 'flex flex-1'}`}>
          {selected ? (
            <>
              {/* Active Chat Header */}
              <div className="p-3 border-b bg-card flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 text-muted-foreground"
                    onClick={() => { setMobileShowChat(false); setSelected(null); }}>
                    <ArrowLeft size={18} />
                  </Button>

                  <button type="button" onClick={() => { if (isGroupChat(selected)) setGroupInfoOpen(true); else { setContactPanelTab('info'); setContactSearch(''); setContactPanelOpen(true); } }} className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Abrir perfil do contato">
                    {selected.avatar_url ? (
                      <img src={selected.avatar_url} alt={chatTitle(selected)} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className={`w-10 h-10 rounded-full ${getAvatarColor(chatTitle(selected))} flex items-center justify-center font-bold text-sm`}>
                        {getInitials(chatTitle(selected))}
                      </div>
                    )}
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { if (isGroupChat(selected)) setGroupInfoOpen(true); else { setContactPanelTab('info'); setContactSearch(''); setContactPanelOpen(true); } }}
                        className="font-semibold text-sm text-foreground hover:underline text-left"
                        title={isGroupChat(selected) ? 'Ver participantes do grupo' : 'Abrir perfil do contato'}
                        aria-label={isGroupChat(selected) ? 'Ver participantes do grupo' : 'Abrir perfil do contato'}
                      >
                        {chatTitle(selected)}
                      </button>
                      {!isGroupChat(selected) && !hasRealName(selected) && (
                        <Button
                          variant="outline" size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => { setContactNameInput(''); setSaveContactOpen(true); }}
                        >
                          Salvar contato
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {selected.assigned_to && agentColors[selected.assigned_to] && <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: agentColors[selected.assigned_to].color }} />{agentColors[selected.assigned_to].display_name}</span>}
                      {!isGroupChat(selected) && hasRealName(selected) && (
                        <span className="font-mono">{formatNumber(selected.contact_number)}</span>
                      )}
                      {isGroupChat(selected) && <span>Grupo</span>}
                    </div>
                  </div>
                </div>


                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" onClick={handleOpenAssignmentHistory} disabled={loadingHistory} title="Histórico de responsáveis" aria-label="Histórico de responsáveis" className="h-8 w-8">
                    {loadingHistory ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                  </Button>
                  {selected.assigned_to !== user?.id && <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTakeOver}
                    title="Assumir responsabilidade por esta conversa"
                    className="h-8 gap-1 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                  ><UserPlus size={13}/><span className="hidden sm:inline">Assumir</span></Button>}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" title="Mais opções da conversa" aria-label="Mais opções da conversa"><MoreVertical size={17}/></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      <DropdownMenuItem onSelect={() => { setContactPanelTab('info'); setContactPanelOpen(true); }}><Contact size={14} className="mr-2"/>Dados do contato</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void handleShareContact()}><Share2 size={14} className="mr-2"/>Compartilhar contato</DropdownMenuItem>
                      <DropdownMenuItem onSelect={openContactEditor}><User size={14} className="mr-2"/>Editar contato</DropdownMenuItem>
                      <DropdownMenuSeparator/>
                      <DropdownMenuItem onSelect={handleOpenLeadDialog} disabled={!!selected.lead_id}><GitBranch size={14} className="mr-2"/>{selected.lead_id ? 'Lead já cadastrado' : 'Cadastrar no Kanban'}</DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleOpenStatusDialog}><GitBranch size={14} className="mr-2"/>Status do Kanban</DropdownMenuItem>
                      <DropdownMenuSeparator/>
                      <DropdownMenuItem onSelect={() => { setTransferAssignee(selected.assigned_to || ''); setTransferDialogOpen(true); }}><Forward size={14} className="mr-2"/>Transferir atendimento</DropdownMenuItem>
                      {!isGroupChat(selected) && <DropdownMenuItem onSelect={() => setCloseServiceDialogOpen(true)} disabled={closingService} className="text-destructive focus:text-destructive"><CheckCircle2 size={14} className="mr-2"/>{closingService ? 'Encerrando atendimento…' : 'Encerrar atendimento'}</DropdownMenuItem>}
                      <DropdownMenuSeparator/>
                      <DropdownMenuItem onSelect={() => handleContactAction('clear')}><Trash2 size={14} className="mr-2"/>Limpar conversa</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleContactAction('block')}><Ban size={14} className="mr-2"/>Bloquear contato</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleContactAction('report')} className="text-destructive focus:text-destructive"><Flag size={14} className="mr-2"/>Denunciar contato</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="icon" onClick={handleSyncMessages} title="Atualizar mensagens" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                    <RefreshCw size={17} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setContactPanelTab('links'); setContactSearch(''); setContactPanelOpen(true); }} title="Pesquisar links e conteúdo da conversa" aria-label="Pesquisar na conversa" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                    <Search size={17} />
                  </Button>

                </div>
              </div>

              {pinnedMessageIds.length > 0 && (
                <div className="mx-3 mt-2 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs">
                  <Pin size={14} className="text-primary shrink-0"/>
                  <span className="font-medium">Mensagem fixada</span>
                  <span className="truncate flex-1 text-muted-foreground">{messages.find(m => m.id === pinnedMessageIds[pinnedMessageIds.length - 1])?.text || 'Mensagem fixada nesta conversa'}</span>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => {
                    const pinnedId = pinnedMessageIds[pinnedMessageIds.length - 1];
                    document.getElementById('whatsapp-message-' + pinnedId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}>Ver</Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Desafixar mensagem" onClick={() => saveMessageFlags(pinnedMessageIds.slice(0, -1), favoriteMessageIds)}><PinOff size={13}/></Button>
                </div>
              )}
              {(selectionMode || selectedMessageIds.length > 0) && (
                <div className="mx-3 mt-2 flex flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2">
                  <span className="text-xs font-medium">{selectedMessageIds.length} selecionada(s)</span>
                  <Button variant="outline" size="sm" className="h-7" onClick={() => setSelectedMessageIds(messages.filter(m => m.message_type !== 'reaction' && m.text !== '[crm_deleted]').map(m => m.id))}>Selecionar todas</Button>
                  <Button variant="outline" size="sm" className="h-7" onClick={() => {
                    const picked = messages.filter(m => selectedMessageIds.includes(m.id) && m.message_type !== 'reaction' && m.text !== '[crm_deleted]');
                    if (!picked.length) return;
                    setForwardMessages(picked);
                    setNewChatNumber('');
                    setNewChatMessage('');
                    setNewChatSearch('');
                    setNewChatOpen(true);
                  }}><Forward size={13} className="mr-1"/>Encaminhar</Button>
                  <Button variant="outline" size="sm" className="h-7" onClick={() => void handleMessageAction('share', messages.find(m => m.id === selectedMessageIds[0])!)} disabled={!messages.some(m => m.id === selectedMessageIds[0])}><Share2 size={13} className="mr-1"/>Compartilhar</Button>
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => { setSelectedMessageIds([]); setSelectionMode(false); }}>Cancelar seleção</Button>
                </div>
              )}
              {/* Chat Message Canvas */}
              <div ref={messagesViewportRef} className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-100/70 dark:bg-zinc-950/70 custom-scrollbar relative flex flex-col">
                <div className="flex flex-col min-h-full space-y-3 max-w-5xl mx-auto pb-4 w-full">
                  <div className="flex-1 min-h-0" /> {/* Alinha no rodapé quando há poucas mensagens */}
                  {messages.filter(m => m.message_type !== 'reaction').map((m, messageIndex, visibleMessages) => {
                    const currentDate = new Date(m.timestamp || '');
                    const validCurrentDate = Number.isFinite(currentDate.getTime()) && currentDate.getTime() > 0;
                    const previousMessage = messageIndex > 0 ? visibleMessages[messageIndex - 1] : null;
                    const previousDate = previousMessage ? new Date(previousMessage.timestamp || '') : null;
                    const showDateDivider = validCurrentDate && (!previousDate || !Number.isFinite(previousDate.getTime()) || currentDate.toDateString() !== previousDate.toDateString());
                    const today = new Date();
                    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
                    const dateLabel = currentDate.toDateString() === today.toDateString()
                      ? 'Hoje'
                      : currentDate.toDateString() === yesterday.toDateString()
                        ? 'Ontem'
                        : currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                    const reactions = messages.filter(
                      r => r.message_type === 'reaction' && !!r.reply_to && r.reply_to === m.wa_message_id
                    );
                    const messageDate = new Date(m.timestamp || '');
                    const hasValidTimestamp = Number.isFinite(messageDate.getTime()) && messageDate.getTime() > 0;
                    const timeStr = hasValidTimestamp
                      ? messageDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : '';

                    return (
                      <React.Fragment key={m.id}>
                      {showDateDivider && <div className="sticky top-1 z-10 flex justify-center py-1"><span className="rounded-full border bg-background/90 px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">{dateLabel}</span></div>}
                      <div id={`whatsapp-message-${m.id}`} className={`flex ${m.from_me ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] md:max-w-[70%] p-3 shadow-xs rounded-2xl text-xs space-y-1 ${
                            m.from_me
                              ? 'bg-purple-100 text-purple-950 border border-purple-200/60 rounded-tr-xs dark:bg-purple-900/40 dark:text-purple-100 dark:border-purple-800/40'
                              : 'bg-white text-slate-900 border border-slate-200/80 rounded-tl-xs dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700/60'
                          }`}
                        >
                          <div className="flex items-center justify-end gap-1 -mt-1 -mr-1">
                            {selectionMode && (
                              <button type="button" title={selectedMessageIds.includes(m.id) ? 'Desmarcar mensagem' : 'Selecionar mensagem'}
                                aria-label={selectedMessageIds.includes(m.id) ? 'Desmarcar mensagem' : 'Selecionar mensagem'}
                                aria-pressed={selectedMessageIds.includes(m.id)}
                                onClick={() => setSelectedMessageIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                                className={`rounded p-1 transition-colors ${selectedMessageIds.includes(m.id) ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10'}`}>
                                <CheckSquare size={15} />
                              </button>
                            )}
                            {pinnedMessageIds.includes(m.id) && <Pin size={12} className="text-primary" />}
                            {favoriteMessageIds.includes(m.id) && <Star size={12} className="text-amber-500 fill-amber-500" />}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><button type="button" className="rounded p-1 opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10" title="Ações da mensagem" aria-label="Ações da mensagem"><ChevronDown size={14} /></button></DropdownMenuTrigger>
                              <DropdownMenuContent align={m.from_me ? 'end' : 'start'} className="w-56">
                                <DropdownMenuItem onSelect={() => void handleMessageAction('details', m)}><Info size={14} className="mr-2" />Dados da mensagem</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => void handleMessageAction('reply', m)}><Reply size={14} className="mr-2" />Responder</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => void handleMessageAction('copy', m)}><Copy size={14} className="mr-2" />Copiar</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => void handleMessageAction('forward', m)}><Forward size={14} className="mr-2" />Encaminhar</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => void handleMessageAction('pin', m)}><Pin size={14} className="mr-2" />{pinnedMessageIds.includes(m.id) ? 'Desafixar' : 'Fixar'}</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => void handleMessageAction('favorite', m)}><Star size={14} className="mr-2" />{favoriteMessageIds.includes(m.id) ? 'Remover dos favoritos' : 'Favoritar'}</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => void handleMessageAction('select', m)}><CheckSquare size={14} className="mr-2" />{selectedMessageIds.includes(m.id) ? 'Desmarcar seleção' : 'Selecionar'}</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => void handleMessageAction('delete', m)} className="text-destructive focus:text-destructive"><Trash2 size={14} className="mr-2" />Excluir do chat</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => void handleMessageAction('save', m)}><Download size={14} className="mr-2" />Salvar como</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => void handleMessageAction('share', m)}><Share2 size={14} className="mr-2" />Compartilhar</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => void handleMessageAction('open', m)}><ExternalLink size={14} className="mr-2" />Abrir com</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {m.reply_to && (() => {
                            const quoted = messages.find(item => item.wa_message_id === m.reply_to);
                            return quoted ? <div className="rounded-md border-l-2 border-primary/70 bg-black/5 dark:bg-white/5 px-2 py-1 text-[11px] opacity-80"><span className="font-semibold">{quoted.from_me ? 'Você' : chatTitle(selected)}</span><p className="truncate">{quoted.text || 'Mídia'}</p></div> : null;
                          })()}
                          {!m.from_me && isGroupChat(selected) && m.sender && (
                            <p className="font-bold text-[11px] text-emerald-700 dark:text-emerald-300">
                              {senderLabel(m.sender)}
                            </p>
                          )}
                          {m.media_url && (['image', 'sticker', 'gif'].includes(m.message_type || '') || (m.media_mime || '').toLowerCase().startsWith('image/')) && (
                            <div className="relative rounded-lg overflow-hidden border bg-zinc-100 dark:bg-zinc-900 min-h-[100px] flex items-center justify-center">
                              <img
                                src={m.media_url}
                                alt={m.message_type === 'sticker' ? 'Figurinha' : 'Imagem'}
                                loading="lazy"
                                className={m.message_type === 'sticker'
                                  ? 'w-32 h-32 object-contain'
                                  : 'max-h-80 w-full object-contain cursor-pointer hover:opacity-90'}
                                onClick={() => { void handleMessageAction('open', m); }}
                                onError={async (e) => {
                                  const target = e.currentTarget;
                                  const attempts = Number(target.dataset.retryCount || '0');
                                  if (attempts < 3 && selected?.instance_id) {
                                    target.dataset.retryCount = String(attempts + 1);
                                    try {
                                      const result = await waha.resolveMedia(selected.instance_id, m.id);
                                      if (typeof result?.url === 'string' && result.url) {
                                        setMessages(current => current.map(item => item.id === m.id ? { ...item, media_url: result.url } : item));
                                        target.src = result.url;
                                        return;
                                      }
                                    } catch (error) {
                                      console.warn('Falha ao recuperar imagem do WhatsApp', m.id, error);
                                    }
                                  }
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent && !parent.querySelector('[data-media-error="true"]')) {
                                    const errorMsg = document.createElement('div');
                                    errorMsg.dataset.mediaError = 'true';
                                    errorMsg.className = 'p-4 text-xs text-muted-foreground flex flex-col items-center gap-2';
                                    errorMsg.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-20"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span>Não foi possível carregar a imagem</span>`;
                                    parent.appendChild(errorMsg);
                                  }
                                }}
                              />
                            </div>
                          )}
                          {m.media_url && m.message_type === 'video' && (
                            <video key={m.id} src={m.media_url} controls playsInline className="rounded-lg max-w-full max-h-80 bg-black" preload="metadata"
                              onError={async (event) => {
                                const video = event.currentTarget;
                                if (video.dataset.mediaRetry === '1' || !selected?.instance_id) return;
                                video.dataset.mediaRetry = '1';
                                try {
                                  const resolved = await waha.resolveMedia(selected.instance_id, m.id);
                                  if (typeof resolved?.url === 'string' && resolved.url && resolved.url !== m.media_url) {
                                    setMessages(current => current.map(item => item.id === m.id ? { ...item, media_url: resolved.url } : item));
                                  }
                                } catch (error) {
                                  console.warn('[WhatsApp] Falha ao renovar vídeo', m.id, error);
                                }
                              }} />
                          )}
                          {m.media_url && (m.message_type === 'audio' || m.message_type === 'ptt' || (m.media_mime || '').startsWith('audio')) && (
                            <div className="flex flex-col gap-1 min-w-[200px]">
                              <audio controls preload="metadata" className="w-full h-8">
                                <source src={m.media_url} type={m.media_mime || 'audio/ogg; codecs=opus'} />
                                <source src={m.media_url} type="audio/mpeg" />
                                <source src={m.media_url} type="audio/mp4" />
                                <source src={m.media_url} type="audio/wav" />
                              </audio>
                              <a href={m.media_url} target="_blank" rel="noreferrer" className="text-[10px] underline opacity-50 px-2" download>Baixar áudio</a>
                            </div>
                          )}
                          {!m.media_url && (m.message_type === 'audio' || m.message_type === 'ptt') && (
                            <span className="text-[11px] italic opacity-70">🎤 Áudio indisponível</span>
                          )}
                          {m.media_url && !['image', 'sticker', 'gif', 'video', 'audio', 'ptt'].includes(m.message_type || '') && (
                            <button 
                              onClick={async (e) => {
                                e.preventDefault();
                                try {
                                  const response = await fetch(m.media_url!);
                                  if (!response.ok) throw new Error('Falha ao baixar o arquivo');
                                  const blob = await response.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  const mimeExt: Record<string, string> = {
                                    'application/pdf': '.pdf',
                                    'application/msword': '.doc',
                                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
                                    'application/vnd.ms-excel': '.xls',
                                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
                                    'text/plain': '.txt',
                                    'text/csv': '.csv',
                                    'application/zip': '.zip',
                                  };
                                  const fallbackName = m.text?.trim() || 'whatsapp-arquivo-' + m.id;
                                  const ext = mimeExt[m.media_mime || ''] || '';
                                  a.download = m.media_filename || (fallbackName.includes('.') ? fallbackName : fallbackName + ext);
                                  document.body.appendChild(a);
                                  a.click();
                                  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                                  document.body.removeChild(a);
                                } catch (err) {
                                  window.open(m.media_url!, '_blank');
                                }
                              }}
                              className="flex items-center gap-2 underline text-xs p-2 bg-black/5 rounded hover:bg-black/10 transition-colors w-full text-left"
                            >
                              <FileText size={14} /> {m.text || (m.media_mime?.includes('pdf') ? 'Documento PDF' : 'Baixar arquivo')}
                            </button>
                          )}
                          {m.text && !m.text.includes('[message_revoke]') && (
                            <p className={`whitespace-pre-wrap break-words leading-relaxed ${
                              EMOJI_ONLY.test(m.text.trim()) ? 'text-3xl leading-tight' : 'text-sm'
                            }`}>
                              {renderRichText(m.text, handleNumberClick)}
                            </p>
                          )}
                          {m.text && m.text.includes('[message_revoke]') && (
                            <p className="text-xs italic text-muted-foreground flex items-center gap-1 opacity-60">
                              <Clock size={12} /> Mensagem apagada
                            </p>
                          )}

                          <div className="flex items-center justify-end gap-1 pt-0.5 text-[10px] opacity-70">
                            <span>{timeStr}</span>
                            {m.from_me && <CheckCheck size={13} className={m.status === 'read' ? "text-blue-500" : "text-purple-700 dark:text-purple-300"} />}
                          </div>

                          {reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {reactions.map(r => (
                                <span key={r.id} className="rounded-full bg-background/80 border px-1.5 py-0.5 text-sm leading-none shadow-xs">
                                  {r.text}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      </React.Fragment>
                    );
                  })}

                  {/* Typing Indicator */}
                  {selected && syncing && (
                    <div className="flex justify-start">
                      <div className="bg-white dark:bg-zinc-800 p-2 rounded-2xl shadow-xs border border-border/50 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}

                  {messages.length === 0 && (
                    <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
                      <p>Nenhuma mensagem carregada nesta conversa.</p>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} className="h-4" />
              </div>

              
              {replyingTo && (
                <div className="border-t bg-card px-4 py-2 flex items-center gap-3">
                  <Reply size={16} className="text-primary shrink-0" />
                  <div className="min-w-0 flex-1 border-l-2 border-primary pl-2">
                    <p className="text-xs font-semibold text-primary">Respondendo {replyingTo.from_me ? 'sua mensagem' : chatTitle(selected)}</p>
                    <p className="text-xs text-muted-foreground truncate">{replyingTo.text || 'Mídia'}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReplyingTo(null)} title="Cancelar resposta"><Trash2 size={14} /></Button>
                </div>
              )}
              {/* Input Bar - Travada no rodapé */}
              <div className="p-3 border-t bg-card flex items-center gap-3 flex-shrink-0 relative z-[100] sticky bottom-0 border-b md:border-b-0 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] pb-safe-bottom">
                {/* hidden pickers */}
                <input ref={fileInputRef} type="file" className="hidden" onChange={e => handleFilePicked(e, 'document')} />
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFilePicked(e, 'image')} />
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={e => handleFilePicked(e, 'video')} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFilePicked(e, 'image')} />

                {recording ? (
                  <div className="flex-1 flex items-center gap-3 px-3 h-10 rounded-full bg-destructive/10 text-destructive">
                    <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                    <span className="text-xs font-medium tabular-nums">
                      Gravando… {String(Math.floor(recordSecs / 60)).padStart(2, '0')}:{String(recordSecs % 60).padStart(2, '0')}
                    </span>
                    <button onClick={() => stopRecording(true)} title="Cancelar gravação" className="ml-auto text-muted-foreground hover:text-destructive">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Emojis */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" title="Emojis" className="h-10 w-10 text-muted-foreground hover:text-foreground">
                          <Smile size={20} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-72 p-2 max-h-72 overflow-y-auto">
                        {EMOJI_GROUPS.map(g => (
                          <div key={g.label} className="mb-2">
                            <p className="text-[11px] font-semibold text-muted-foreground px-1 pb-1">{g.label}</p>
                            <div className="grid grid-cols-8 gap-0.5">
                              {g.emojis.map(em => (
                                <button
                                  key={em}
                                  type="button"
                                  onClick={() => insertEmoji(em)}
                                  className="text-lg leading-none p-1 rounded hover:bg-muted transition"
                                >
                                  {em}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </PopoverContent>
                    </Popover>

                    {/* Respostas rápidas */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" title="Respostas rápidas" className="h-10 w-10 text-muted-foreground hover:text-foreground">
                          <Zap size={19} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 p-2 space-y-1 text-xs">
                        <p className="font-semibold px-2 py-1 text-muted-foreground">Respostas Rápidas</p>
                        {quickReplies.length === 0 && (
                          <p className="p-2 text-muted-foreground">Nenhuma resposta rápida cadastrada.</p>
                        )}
                        {quickReplies.map(q => (
                          <button key={q.id} onClick={() => setText(q.text)} className="w-full text-left p-2 rounded hover:bg-muted">
                            <span className="font-bold text-purple-600">/{q.shortcut}</span>
                            <p className="truncate text-muted-foreground">{q.text}</p>
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>

                    {/* Anexos */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" title="Anexar" disabled={uploading} className="h-10 w-10 text-muted-foreground hover:text-foreground">
                          {uploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-56 p-1.5 text-sm">
                        <button onClick={() => imageInputRef.current?.click()} className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted">
                          <ImageIcon size={16} className="text-purple-600" /> Fotos
                        </button>
                        <button onClick={() => videoInputRef.current?.click()} className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted">
                          <Video size={16} className="text-blue-600" /> Vídeos
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted">
                          <FileText size={16} className="text-amber-600" /> Documento
                        </button>
                        <button onClick={() => cameraInputRef.current?.click()} className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted">
                          <Camera size={16} className="text-emerald-600" /> Câmera
                        </button>
                      </PopoverContent>
                    </Popover>

                    <div className="flex-1 relative">
                      <Input
                        ref={inputRef}
                        placeholder="Digite uma mensagem…"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                        className="h-10 text-xs bg-muted/30 border-muted rounded-full px-4 focus-visible:ring-purple-500"
                      />
                    </div>
                  </>
                )}

                <Button
                  onClick={() => {
                    if (recording) return stopRecording(false);
                    if (text.trim()) return handleSend();
                    startRecording();
                  }}
                  disabled={uploading}
                  size="icon"
                  title={recording ? 'Enviar áudio' : text.trim() ? 'Enviar' : 'Gravar áudio'}
                  className="h-10 w-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex-shrink-0"
                >
                  {recording ? <Square size={16} className="fill-current" /> : text.trim() ? <Send size={18} /> : <Mic size={18} />}
                </Button>
              </div>

            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs p-8 space-y-3">
              <MessageSquare size={48} className="text-muted-foreground/30" />
              <p className="font-medium text-sm">Selecione uma conversa para iniciar o atendimento</p>
            </div>
          )}

          {/* Paste Preview Overlay */}
          {clipboardFiles.length > 0 && (
            <div className="absolute inset-0 z-[150] bg-black/60 flex items-center justify-center p-4 md:p-10 backdrop-blur-sm">
              <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col border border-border">
                <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                  <h3 className="font-semibold">Enviar {clipboardFiles.length} {clipboardFiles.length === 1 ? 'imagem' : 'imagens'}</h3>
                  <Button variant="ghost" size="icon" onClick={() => setClipboardFiles([])} className="h-8 w-8">
                    <Trash2 size={16} />
                  </Button>
                </div>
                <div className="p-4 flex flex-wrap gap-2 justify-center max-h-[50vh] overflow-y-auto bg-slate-50/50 dark:bg-zinc-900/50">
                  {clipboardFiles.map((file, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden border shadow-sm bg-background">
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt="Clipboard preview" 
                        className="max-h-48 object-contain" 
                      />
                      <button 
                        onClick={() => setClipboardFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t space-y-3">
                  <Input 
                    placeholder="Legenda (opcional)" 
                    value={text} 
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendPaste()}
                    className="rounded-lg"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setClipboardFiles([])} disabled={uploading}>Cancelar</Button>
                    <Button onClick={handleSendPaste} disabled={uploading} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      Enviar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>



    {/* ─── Nova Conversa Dialog ─── */}
    <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare size={18} className="text-purple-600" />
            {forwardMessages.length > 0 ? 'Encaminhar mensagens' : 'Nova conversa'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{forwardMessages.length > 0 ? `Selecione o contato de destino para ${forwardMessages.length} mensagem(ns).` : 'Busque um contato existente ou digite um novo número.'}</p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1">
            <Label>Buscar nas conversas</Label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Nome ou número"
                value={newChatSearch}
                onChange={e => setNewChatSearch(e.target.value)}
              />
            </div>
            {newChatSearch.trim() && (
              <div className="max-h-44 overflow-y-auto border rounded-lg divide-y mt-2">
                {chats
                  .filter(c =>
                    (c.contact_name || '').toLowerCase().includes(newChatSearch.toLowerCase()) ||
                    c.contact_number.includes(onlyDigits(newChatSearch) || newChatSearch))
                  .slice(0, 20)
                  .map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setNewChatNumber(c.contact_number || c.wa_chat_id.split('@')[0]); setNewChatSearch(c.contact_name || c.contact_number || ''); }}
                      className="w-full flex items-center gap-2 p-2 text-left hover:bg-muted text-sm"
                    >
                      <div className={`w-8 h-8 rounded-full ${getAvatarColor(c.contact_name || c.contact_number)} flex items-center justify-center text-[11px] font-bold`}>
                        {getInitials(c.contact_name || c.contact_number)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.contact_name || c.contact_number}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.contact_number}</p>
                      </div>
                    </button>
                  ))}
                {chats.filter(c =>
                  (c.contact_name || '').toLowerCase().includes(newChatSearch.toLowerCase()) ||
                  c.contact_number.includes(onlyDigits(newChatSearch) || newChatSearch)).length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground text-center">Nenhum contato encontrado nas conversas.</p>
                )}
              </div>
            )}
          </div>

          <div className="relative flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] uppercase text-muted-foreground">ou novo número</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="new-number">Número (com DDD)</Label>
            <Input
              id="new-number"
              placeholder="54991811902"
              value={newChatNumber}
              onChange={e => setNewChatNumber(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="new-msg">{forwardMessages.length > 0 ? 'Texto adicional (opcional)' : 'Mensagem'}</Label>
            <Input
              id="new-msg"
              placeholder={forwardMessages.length > 0 ? 'Opcional — as mensagens selecionadas serão encaminhadas' : 'Digite a primeira mensagem'}
              value={newChatMessage}
              onChange={e => setNewChatMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStartNewChat()}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setNewChatOpen(false)}>Cancelar</Button>
          <Button onClick={handleStartNewChat} disabled={startingChat || !onlyDigits(newChatNumber)} className="gap-2">
            {startingChat ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {forwardMessages.length > 0 ? 'Encaminhar' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>


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
          {leadFunnel === 'spc' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="lead-plan-value">Valor do plano (R$)</Label>
                <Input id="lead-plan-value" placeholder="1000,00" value={leadPlanValue} onChange={e => setLeadPlanValue(e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lead-biro">Birô que utiliza</Label>
                <Input id="lead-biro" placeholder="Serasa, Boa Vista..." value={leadBiro} onChange={e => setLeadBiro(e.target.value)} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Funil</Label>
              <Select value={leadFunnel} onValueChange={v => { setLeadFunnel(v); setLeadStage(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar funil" /></SelectTrigger>
                <SelectContent>
                  {kanbanFunnels.map(f => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Etapa Inicial</Label>
              <Select value={leadStage} onValueChange={setLeadStage}>
                <SelectTrigger><SelectValue placeholder="Selecionar etapa" /></SelectTrigger>
                <SelectContent>
                  {getStagesForFunnel(leadFunnel).map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Responsável pelo lead</Label>
            <Select value={leadAssignee} onValueChange={setLeadAssignee}>
              <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
              <SelectContent>
                {leadAssignees.map(member => <SelectItem key={member.user_id} value={member.user_id}>{member.display_name || member.email || 'Usuário'}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setLeadDialog(false)}>Cancelar</Button>
          <Button onClick={handleRegisterLead} disabled={savingLead || !leadName.trim() || !leadStage} className="gap-2">
            <UserPlus size={14} />
            {savingLead ? 'Salvando...' : 'Cadastrar e Ir ao Funil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ─── Alterar status do Kanban a partir da conversa ─── */}
    <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GitBranch size={18} className="text-emerald-600" />Status do Kanban</DialogTitle>
          <p className="text-sm text-muted-foreground">Altere a coluna do lead sem sair da conversa do WhatsApp.</p>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Funil</Label>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{kanbanFunnels.find(f => f.key === statusFunnel)?.label || statusFunnel}</div>
          </div>
          <div className="space-y-1">
            <Label>Nova coluna</Label>
            <Select value={statusStage} onValueChange={setStatusStage}>
              <SelectTrigger><SelectValue placeholder="Selecionar coluna" /></SelectTrigger>
              <SelectContent>{getStagesForFunnel(statusFunnel).map(stage => <SelectItem key={stage.key} value={stage.key}>{stage.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">A mudança será salva no lead vinculado e refletida no Kanban.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={savingStatus}>Cancelar</Button>
          <Button onClick={handleSaveKanbanStatus} disabled={savingStatus || !statusStage} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            {savingStatus ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
            {savingStatus ? 'Salvando...' : 'Salvar status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ─── Histórico de responsáveis ─── */}
    <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Clock size={18} className="text-purple-600" />Histórico de responsáveis</DialogTitle>
          <p className="text-sm text-muted-foreground">{selected ? chatTitle(selected) : 'Conversa selecionada'}</p>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto space-y-3 py-2">
          {assignmentHistory.map(item => {
            const previous = item.previous_assignee ? agentColors[item.previous_assignee] : null;
            const next = agentColors[item.new_assignee];
            return <div key={item.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">De</span>
                <span className="inline-flex items-center gap-2 font-medium">{previous && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: previous.color }} />}{previous?.display_name || (item.previous_assignee ? 'Usuário anterior' : 'Sem responsável')}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Para</span>
                <span className="inline-flex items-center gap-2 font-medium">{next && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: next.color }} />}{next?.display_name || 'Usuário responsável'}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{new Date(item.changed_at).toLocaleString('pt-BR')}</p>
            </div>;
          })}
          {assignmentHistory.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Ainda não há transferências registradas para esta conversa.</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={!!messageDetails} onOpenChange={open => { if (!open) setMessageDetails(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Dados da mensagem</DialogTitle></DialogHeader>
        {messageDetails && <div className="space-y-3 text-sm">
          <div><p className="text-xs text-muted-foreground">Remetente</p><p>{messageDetails.from_me ? 'Você / equipe' : (messageDetails.sender ? senderLabel(messageDetails.sender) : chatTitle(selected))}</p></div>
          <div><p className="text-xs text-muted-foreground">Data e hora</p><p>{new Date(messageDetails.timestamp).toLocaleString('pt-BR')}</p></div>
          <div><p className="text-xs text-muted-foreground">Tipo</p><p>{messageDetails.message_type || 'Mensagem'}</p></div>
          <div><p className="text-xs text-muted-foreground">Status</p><p>{messageDetails.status || 'Não informado'}</p></div>
          <div><p className="text-xs text-muted-foreground">Identificador</p><p className="break-all font-mono text-xs">{messageDetails.wa_message_id || messageDetails.id}</p></div>
        </div>}
        <DialogFooter><Button variant="outline" onClick={() => setMessageDetails(null)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Perfil do contato e conteúdo compartilhado */}
    <Dialog open={contactPanelOpen} onOpenChange={setContactPanelOpen}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-5 pb-3 border-b">
          <div className="flex items-start gap-3 pr-7">
            {selected?.avatar_url ? <img src={selected.avatar_url} alt={selected ? chatTitle(selected) : 'Contato'} className="h-16 w-16 rounded-full object-cover"/> : <div className={`h-16 w-16 shrink-0 rounded-full ${getAvatarColor(selected ? chatTitle(selected) : '')} flex items-center justify-center text-lg font-bold`}>{getInitials(selected ? chatTitle(selected) : '?')}</div>}
            <div className="min-w-0 flex-1">
              <DialogTitle className="break-words">{selected ? chatTitle(selected) : 'Contato'}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{selected ? formatNumber(selected.contact_number) : ''}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => { if (selected) window.location.href = `tel:${onlyDigits(selected.contact_number)}`; }}><Phone size={14} className="mr-1.5"/>Ligar</Button>
                <Button size="sm" variant="outline" onClick={() => { if (selected) window.open(`https://web.whatsapp.com/send?phone=${onlyDigits(selected.contact_number)}`, '_blank', 'noopener,noreferrer'); }}><MessageSquare size={14} className="mr-1.5"/>Abrir WhatsApp</Button>
                <Button size="sm" variant="outline" onClick={openContactEditor}><User size={14} className="mr-1.5"/>Editar</Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="outline" aria-label="Mais ações do contato"><MoreVertical size={16}/></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => void handleShareContact()}><Share2 size={14} className="mr-2"/>Compartilhar contato</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleContactAction('clear')}><Trash2 size={14} className="mr-2"/>Limpar conversa</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleContactAction('block')}><Ban size={14} className="mr-2"/>Bloquear contato</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleContactAction('report')} className="text-destructive focus:text-destructive"><Flag size={14} className="mr-2"/>Denunciar contato</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </DialogHeader>
        <div className="p-5 space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Informações adicionais</h3>
            <div className="rounded-lg border divide-y">
              <div className="flex items-center gap-3 p-3"><User size={16} className="text-muted-foreground"/><div className="min-w-0"><p className="text-xs text-muted-foreground">Nome</p><p className="text-sm font-medium break-words">{selected ? chatTitle(selected) : '—'}</p></div></div>
              <div className="flex items-center gap-3 p-3"><Phone size={16} className="text-muted-foreground"/><div><p className="text-xs text-muted-foreground">Telefone</p><p className="text-sm font-medium">{selected ? formatNumber(selected.contact_number) : '—'}</p></div><Button size="icon" variant="ghost" className="ml-auto h-8 w-8" title="Copiar telefone" onClick={() => { if (selected) void navigator.clipboard.writeText(formatNumber(selected.contact_number)).then(() => toast({title:'Telefone copiado'})).catch(() => toast({title:'Não foi possível copiar',variant:'destructive'})); }}><Copy size={14}/></Button></div>
              <div className="flex items-center gap-3 p-3"><UserPlus size={16} className="text-muted-foreground"/><div><p className="text-xs text-muted-foreground">Responsável</p><p className="text-sm font-medium">{selected?.assigned_to ? agentColors[selected.assigned_to]?.display_name || 'Responsável atribuído' : 'Sem responsável'}</p></div></div>
              <div className="flex items-center gap-3 p-3"><GitBranch size={16} className="text-muted-foreground"/><div><p className="text-xs text-muted-foreground">Lead / Kanban</p><p className="text-sm font-medium">{selected?.lead_id ? 'Lead vinculado' : 'Ainda não vinculado a um lead'}</p></div><Button size="sm" variant="ghost" className="ml-auto" onClick={() => { setContactPanelOpen(false); if (!selected?.lead_id) handleOpenLeadDialog(); else handleOpenStatusDialog(); }}>{selected?.lead_id ? 'Ver status' : 'Cadastrar'}</Button></div>
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Mídia, links e documentos</h3>
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted/60 p-1">
              {([{key:'media',label:'Mídia',count:contactMedia.length},{key:'links',label:'Links',count:contactLinks.length},{key:'docs',label:'Docs',count:contactDocs.length},{key:'info',label:'Tudo',count:messages.length}] as const).map(tab => <button key={tab.key} type="button" onClick={() => {setContactPanelTab(tab.key);setContactSearch('');}} className={`rounded-md px-2 py-2 text-xs font-medium transition-colors ${contactPanelTab===tab.key?'bg-background shadow-sm':'text-muted-foreground hover:text-foreground'}`}>{tab.label}<span className="ml-1 opacity-70">{tab.count}</span></button>)}
            </div>
            {contactPanelTab !== 'info' && <Input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Filtrar conteúdo desta conversa..." className="h-9"/>}
            {contactPanelTab === 'info' ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><MessageSquare size={16}/> {messages.length} mensagens carregadas nesta conversa</div> : <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
              {filteredPanelMessages.map(m => <div key={m.id} className="flex items-center gap-3 p-3 min-w-0">
                {contactPanelTab === 'media' ? <ImageIcon size={18} className="shrink-0 text-muted-foreground"/> : contactPanelTab === 'links' ? <LinkIcon size={18} className="shrink-0 text-muted-foreground"/> : <FileText size={18} className="shrink-0 text-muted-foreground"/>}
                <div className="min-w-0 flex-1"><p className="text-sm truncate">{m.text || (contactPanelTab === 'links' ? 'Link na mensagem' : m.media_mime || m.message_type || 'Arquivo')}</p><p className="text-[11px] text-muted-foreground">{new Date(m.timestamp).toLocaleString('pt-BR')} · {m.from_me ? 'Enviado' : 'Recebido'}</p></div>
                {m.media_url && <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Abrir arquivo" onClick={() => window.open(m.media_url!, '_blank', 'noopener,noreferrer')}><ExternalLink size={14}/></Button>}
                {contactPanelTab === 'links' && m.text && <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Copiar mensagem/link" onClick={() => void navigator.clipboard.writeText(m.text || '').then(() => toast({title:'Link/mensagem copiado'}))}><Copy size={14}/></Button>}
              </div>)}
              {filteredPanelMessages.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum item deste tipo foi encontrado nas mensagens carregadas.</p>}
            </div>}
            <p className="text-[11px] text-muted-foreground">A lista considera as mensagens atualmente carregadas pelo CRM; mídias antigas podem não aparecer até serem sincronizadas.</p>
          </section>
        </div>
        <DialogFooter className="border-t p-4"><Button variant="outline" onClick={() => setContactPanelOpen(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Salvar contato */}
    <Dialog open={saveContactOpen} onOpenChange={setSaveContactOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Salvar contato</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-mono">
            {selected ? formatNumber(selected.contact_number) : ''}
          </p>
          <Input
            placeholder="Nome do contato"
            value={contactNameInput}
            onChange={e => setContactNameInput(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSaveContactOpen(false)}>Cancelar</Button>
          <Button onClick={handleSaveContact} disabled={savingContact || !contactNameInput.trim()}>
            {savingContact ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Transferir atendimento</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Transferir conversa para</Label>
          <Select value={transferAssignee} onValueChange={setTransferAssignee}>
            <SelectTrigger><SelectValue placeholder="Selecione um usuário do CRM"/></SelectTrigger>
            <SelectContent>{leadAssignees.map(member => <SelectItem key={member.user_id} value={member.user_id}>{member.display_name || member.email || 'Usuário'}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">A conversa e o lead vinculado, se houver, serão atribuídos ao usuário escolhido e a transferência será registrada no histórico de responsáveis.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancelar</Button><Button onClick={() => void handleTransferChat()} disabled={!transferAssignee || transferringChat}>{transferringChat ? <Loader2 size={14} className="mr-2 animate-spin"/> : <Forward size={14} className="mr-2"/>}Transferir</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={closeServiceDialogOpen} onOpenChange={setCloseServiceDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Encerrar atendimento</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p>Como deseja encerrar este atendimento?</p>
          <div className="rounded-lg border p-3">
            <p className="font-medium">Encerrar e enviar pesquisa de satisfação</p>
            <p className="mt-1 text-muted-foreground">O cliente receberá a pesquisa de 1 a 5 estrelas.</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="font-medium">Encerrar sem pesquisa</p>
            <p className="mt-1 text-muted-foreground">O cliente receberá somente a mensagem de encerramento, sem pedido de avaliação.</p>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setCloseServiceDialogOpen(false)} disabled={closingService}>Cancelar</Button>
          <Button variant="secondary" onClick={() => void handleCloseService(false)} disabled={closingService}>
            {closingService ? <Loader2 size={14} className="mr-2 animate-spin"/> : <CheckCircle2 size={14} className="mr-2"/>}
            Encerrar sem avaliação
          </Button>
          <Button onClick={() => void handleCloseService(true)} disabled={closingService}>
            {closingService ? <Loader2 size={14} className="mr-2 animate-spin"/> : <Star size={14} className="mr-2"/>}
            Encerrar e enviar pesquisa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Info do grupo */}
    <Dialog open={groupInfoOpen} onOpenChange={setGroupInfoOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{selected ? chatTitle(selected) : 'Grupo'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Participantes ativos ({groupParticipants.length})
          </p>
          <div className="max-h-64 overflow-y-auto divide-y">
            {groupParticipants.map(p => (
              <div key={p} className="flex items-center gap-2 py-2">
                <div className={`w-8 h-8 rounded-full ${getAvatarColor(senderLabel(p))} flex items-center justify-center text-[11px] font-bold`}>
                  {getInitials(senderLabel(p))}
                </div>
                <span className="text-xs">{senderLabel(p)}</span>
              </div>
            ))}
            {groupParticipants.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Nenhum participante identificado nas mensagens recentes.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default WhatsAppChat;
