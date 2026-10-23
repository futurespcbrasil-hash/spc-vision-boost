import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppState } from '@/context/AppContext';
import { KANBAN_STAGES, KanbanStage, Lead } from '@/data/spcData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  GripVertical, Phone, MessageCircle, Building2, Mail, X, User2, UserPlus, Clock, History,
  Edit3, Trash2, Save, ChevronDown, ChevronUp, Plus, Settings, FileText, Search, FileDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { useSectors } from '@/hooks/useSectors';
import SectorSelector from '@/components/SectorSelector';
import { useAuth } from '@/hooks/useAuth';

const CRMKanban = () => {
  const { role, user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeSector, setActiveSector, sectors } = useSectors();
  const isGestor = !authLoading && role === 'gestor';
  const isOwner = user?.id === '33b9e710-594d-4811-8e94-ba87507cf556';
  const funnel = activeSector;
  const sectorLabel = sectors.find(s => s.key === funnel)?.label || funnel;
  const { leads: allLeads, moveLeadToStage, updateLead, deleteLead, addLead, refreshLeads } = useAppState();
  const leads = allLeads.filter(l => ((l as any).funnel || 'spc') === funnel);
  const baseStages = KANBAN_STAGES;
  const addLeadDraftKey = user ? `crm_kanban_new_lead_draft_${user.id}_${funnel}` : undefined;
  const readAddLeadDraft = () => {
    const empty = { name: '', company: '', phone: '', whatsapp: '', email: '', product: '', origin: 'Kanban', stage: 'lead_novo', assignee: user?.id || '', funnel };
    try {
      const raw = addLeadDraftKey ? localStorage.getItem(addLeadDraftKey) : null;
      if (!raw) return empty;
      const saved = JSON.parse(raw);
      return saved.funnel === funnel ? { ...empty, ...saved } : empty;
    } catch { return empty; }
  };
  const initialAddLeadDraft = readAddLeadDraft();
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<KanbanStage | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Lead | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<KanbanStage>>(new Set());
  const [customStages, setCustomStages] = useState<{ key: string; label: string; color: string; userId?: string }[]>([]);
  const [editFunnelStages, setEditFunnelStages] = useState<{ key: string; label: string }[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ user_id: string; display_name: string; email: string | null }[]>([]);
  const [agentColors, setAgentColors] = useState<Record<string, { display_name: string; color: string }>>({});
  const [historyLead, setHistoryLead] = useState<Lead | null>(null);
  const [leadAssignmentHistory, setLeadAssignmentHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showAddLead, setShowAddLead] = useState(() => { try { const raw = addLeadDraftKey ? localStorage.getItem(addLeadDraftKey) : null; return !!raw && JSON.parse(raw).funnel === funnel; } catch { return false; } });
  const [newLeadName, setNewLeadName] = useState(initialAddLeadDraft.name);
  const [newLeadCompany, setNewLeadCompany] = useState(initialAddLeadDraft.company);
  const [newLeadPhone, setNewLeadPhone] = useState(initialAddLeadDraft.phone);
  const [newLeadWhatsapp, setNewLeadWhatsapp] = useState(initialAddLeadDraft.whatsapp);
  const [newLeadEmail, setNewLeadEmail] = useState(initialAddLeadDraft.email);
  const [newLeadProduct, setNewLeadProduct] = useState(initialAddLeadDraft.product);
  const [newLeadOrigin, setNewLeadOrigin] = useState(initialAddLeadDraft.origin);
  const [newLeadStage, setNewLeadStage] = useState<string>(initialAddLeadDraft.stage);
  const [newLeadAssignee, setNewLeadAssignee] = useState(initialAddLeadDraft.assignee);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editColLabel, setEditColLabel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileStage, setMobileStage] = useState<string>(baseStages[0]?.key || '');
  const [showExport, setShowExport] = useState(false);
  const [selectedStageKeys, setSelectedStageKeys] = useState<string[] | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const previousDraftFunnel = useRef(funnel);
  useEffect(() => {
    if (previousDraftFunnel.current === funnel) return;
    previousDraftFunnel.current = funnel;
    const draft = readAddLeadDraft();
    setNewLeadName(draft.name);
    setNewLeadCompany(draft.company);
    setNewLeadPhone(draft.phone);
    setNewLeadWhatsapp(draft.whatsapp);
    setNewLeadEmail(draft.email);
    setNewLeadProduct(draft.product);
    setNewLeadOrigin(draft.origin);
    setNewLeadStage(draft.stage);
    setNewLeadAssignee(draft.assignee);
    try {
      const raw = addLeadDraftKey ? localStorage.getItem(addLeadDraftKey) : null;
      setShowAddLead(!!raw && JSON.parse(raw).funnel === funnel);
    } catch { setShowAddLead(false); }
  }, [funnel, user?.id]);

  useEffect(() => {
    if (!addLeadDraftKey || !showAddLead) return;
    const draft = { name: newLeadName, company: newLeadCompany, phone: newLeadPhone, whatsapp: newLeadWhatsapp, email: newLeadEmail, product: newLeadProduct, origin: newLeadOrigin, stage: newLeadStage, assignee: newLeadAssignee, funnel };
    try {
      const hasContent = !!(newLeadName.trim() || newLeadCompany.trim() || newLeadPhone.trim() || newLeadWhatsapp.trim() || newLeadEmail.trim() || newLeadProduct.trim() || newLeadOrigin !== 'Kanban' || newLeadStage !== 'lead_novo' || newLeadAssignee !== (user?.id || ''));
      if (hasContent) localStorage.setItem(addLeadDraftKey, JSON.stringify(draft));
      else localStorage.removeItem(addLeadDraftKey);
    } catch { /* armazenamento indisponível */ }
  }, [addLeadDraftKey, showAddLead, newLeadName, newLeadCompany, newLeadPhone, newLeadWhatsapp, newLeadEmail, newLeadProduct, newLeadOrigin, newLeadStage, newLeadAssignee, funnel, user?.id]);

  const clearAddLeadDraft = () => {
    try { if (addLeadDraftKey) localStorage.removeItem(addLeadDraftKey); } catch { /* armazenamento indisponível */ }
  };
  const closeAddLead = () => { setShowAddLead(false); clearAddLeadDraft(); };

  // Apenas gestores/administrador ou o responsável atual podem mover/editar o lead. Leads sem responsável não ficam editáveis para toda a equipe.
  const canEditLead = (lead: Lead) => isOwner || isGestor || (!!user?.id && lead.userId === user.id);

  // Resolve a preferência de cor pelo ID e, como compatibilidade, pelo nome
  // do responsável retornado pelo diretório de usuários atribuíveis.
  const getLeadAssigneePreference = (assignedTo?: string) => {
    if (!assignedTo) return undefined;
    const direct = agentColors[assignedTo];
    if (direct?.color) return direct;
    const member = teamMembers.find(item => item.user_id === assignedTo);
    const normalizedName = member?.display_name?.trim().toLocaleLowerCase('pt-BR');
    if (!normalizedName) return undefined;
    return Object.values(agentColors).find(item =>
      item.display_name?.trim().toLocaleLowerCase('pt-BR') === normalizedName && !!item.color
    );
  };

  const handleStartConversation = (lead: Lead) => {
    const rawNumber = lead.whatsapp || lead.phone || '';
    let digits = rawNumber.replace(/\D/g, '');
    // Corrige números que foram gravados duas vezes em registros antigos.
    if (digits.length % 2 === 0 && digits.slice(0, digits.length / 2) === digits.slice(digits.length / 2)) {
      digits = digits.slice(0, digits.length / 2);
    }
    if (digits.length < 10) {
      toast({ title: 'WhatsApp não informado', description: 'Cadastre um número com DDD neste lead antes de iniciar a conversa.', variant: 'destructive' });
      return;
    }
    const internationalNumber = digits.startsWith('55') ? digits : `55${digits}`;
    navigate(`/whatsapp?phone=${encodeURIComponent(internationalNumber)}&compose=1`);
  };

  useEffect(() => {
    const channel = supabase.channel(`kanban-lead-assignment-live-${user?.id || 'anonymous'}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
        const before = payload.old as { assigned_to?: string | null };
        const after = payload.new as { assigned_to?: string | null };
        if (before.assigned_to !== after.assigned_to) void refreshLeads();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refreshLeads]);

  useEffect(() => {
    // Aguarda a sessão autenticada: se a consulta rodar antes da restauração
    // da sessão, o mapa pode ficar vazio e os cards aparecem cinza.
    if (authLoading || !user?.id) return;
    let cancelled = false;
    const loadAgentColors = async () => {
      const { data, error } = await (supabase as any)
        .from('whatsapp_agent_preferences')
        .select('user_id,display_name,color');
      if (error) {
        console.warn('[Kanban] Não foi possível carregar cores dos responsáveis:', error.message);
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
    const channel = supabase.channel(`kanban-agent-colors-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_agent_preferences' }, () => { void loadAgentColors(); })
      .subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') void loadAgentColors(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id]);

  useEffect(() => {
    const targetId = searchParams.get('leadId');
    if (!targetId) return;
    const target = allLeads.find(lead => lead.id === targetId);
    if (!target) return;
    const next = new URLSearchParams(searchParams);
    const focusCard = next.get('focus') === 'card';
    next.delete('leadId');
    next.delete('focus');
    setSearchParams(next, { replace: true });
    if (focusCard) {
      const targetFunnel = String((target as any).funnel || 'spc');
      if (targetFunnel !== activeSector) setActiveSector(targetFunnel);
      setExpandedStages(previous => new Set(previous).add(target.status as KanbanStage));
      window.setTimeout(() => {
        const cards = Array.from(document.querySelectorAll(`[id="lead-card-${target.id}"]`)) as HTMLElement[];
        const card = cards.find(element => element.offsetParent !== null) || cards[0];
        if (!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        card.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        window.setTimeout(() => card.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 1800);
      }, targetFunnel !== activeSector ? 650 : 250);
      return;
    }
    setSelectedLead(target);
    setEditMode(false);
    setEditData(null);
  }, [searchParams, setSearchParams, allLeads, activeSector, setActiveSector]);

  useEffect(() => {
    let active = true;
    const loadTeamMembers = async () => {
      const { data, error } = await supabase.rpc('get_assignable_users');
      if (!error && data && active) setTeamMembers(data);
      if (error) console.error('Erro ao carregar responsáveis:', error);
    };
    void loadTeamMembers();
    return () => { active = false; };
  }, []);

  // Carrega as etapas do funil escolhido no formulário de edição e evita salvar
  // um status que não exista no funil de destino.
  useEffect(() => {
    if (!editMode || !editData) return;
    let active = true;
    const funnelKey = String((editData as any).funnel || 'spc');
    const loadStages = async () => {
      const { data, error } = await supabase
        .from('kanban_stages')
        .select('key,label')
        .eq('funnel', funnelKey)
        .order('position', { ascending: true });
      if (!active) return;
      if (error) {
        console.error('Erro ao carregar etapas para edição:', error);
        setEditFunnelStages(baseStages.map(stage => ({ key: stage.key, label: stage.label })));
        return;
      }
      const options = data?.length
        ? data.map(stage => ({ key: stage.key, label: stage.label }))
        : baseStages.map(stage => ({ key: stage.key, label: stage.label }));
      setEditFunnelStages(options);
      setEditData(current => {
        if (!current || String((current as any).funnel || 'spc') !== funnelKey) return current;
        if (options.some(stage => stage.key === current.status)) return current;
        return { ...current, status: (options[0]?.key || 'lead_novo') as KanbanStage };
      });
    };
    void loadStages();
    return () => { active = false; };
  }, [editMode, (editData as any)?.funnel]);

  const handleOpenLeadHistory = async (lead: Lead) => {
    setHistoryLead(lead);
    setHistoryLoading(true);
    try {
      const { data, error } = await (supabase as any).from('lead_assignment_history')
        .select('id,previous_assignee,new_assignee,changed_by,changed_at')
        .eq('lead_id', lead.id)
        .order('changed_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setLeadAssignmentHistory(data || []);
    } catch (error: any) {
      toast({ title: 'Não foi possível carregar o histórico', description: error.message, variant: 'destructive' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAssignLead = async (lead: Lead, assigneeId: string) => {
    const { error } = await supabase.rpc('assign_lead_to_user', {
      p_lead_id: lead.id,
      p_assignee: assigneeId || null,
    });
    if (error) {
      toast({ title: 'Não foi possível atribuir o lead', description: error.message, variant: 'destructive' });
      return;
    }
    await refreshLeads();
    toast({
      title: assigneeId ? 'Lead atribuído' : 'Responsável removido',
      description: assigneeId ? `O lead foi direcionado para ${teamMembers.find(member => member.user_id === assigneeId)?.display_name || 'o usuário selecionado'}.` : 'O lead ficou sem responsável.',
    });
  };

  // Load custom stages from database (with localStorage migration fallback)
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('kanban_stages')
        .select('*')
        .eq('funnel', funnel)
        .order('position', { ascending: true });

      if (error) {
        console.error('Erro ao carregar colunas:', error);
        return;
      }

      if (data && data.length > 0) {
        setCustomStages(data.map(d => ({ key: d.key, label: d.label, color: d.color, userId: d.user_id })));
      } else {
        // Migrate from localStorage if exists (only for SPC funnel)
        if (funnel === 'spc') {
          const saved = localStorage.getItem('custom_kanban_stages');
          if (saved) {
            try {
              const local = JSON.parse(saved) as { key: string; label: string; color: string }[];
              if (local.length > 0) {
                const rows = local.map((s, i) => ({
                  user_id: user.id,
                  funnel,
                  key: s.key,
                  label: s.label,
                  color: s.color,
                  position: i,
                }));
                const { data: inserted } = await supabase.from('kanban_stages').insert(rows).select();
                if (inserted) {
                  setCustomStages(inserted.map(d => ({ key: d.key, label: d.label, color: d.color, userId: d.user_id })));
                  localStorage.removeItem('custom_kanban_stages');
                }
              }
            } catch (e) { console.error(e); }
          }
        }
      }
    };
    void load();
    const channel = supabase.channel(`kanban-stages-${funnel}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_stages', filter: `funnel=eq.${funnel}` }, () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [funnel]);

  useEffect(() => {
    setMobileStage(baseStages[0]?.key || '');
    setCustomStages([]);
  }, [funnel]);

  // O banco é a fonte da verdade: não reintroduzir etapas padrão que foram excluídas.
  const allStages = customStages.map(s => ({ ...s, key: s.key as KanbanStage }));
  // Owner override: the Future Soluções account must be able to manage shared Kanban columns.
  const canManageCustomStage = (key: string) =>
    isOwner || isGestor || customStages.some(stage => stage.key === key && stage.userId === user?.id);

  const handleCreateLead = async () => {
    if (!newLeadName.trim()) {
      toast({ title: 'Informe o nome do lead', variant: 'destructive' });
      return;
    }
    const created = await addLead({
      id: '',
      userId: user?.id,
      assignedTo: newLeadAssignee || undefined,
      name: newLeadName.trim(),
      company: newLeadCompany.trim(),
      phone: newLeadPhone.trim(),
      whatsapp: newLeadWhatsapp.trim() || newLeadPhone.trim(),
      email: newLeadEmail.trim(),
      cpfCnpj: '',
      type: 'PJ',
      origin: newLeadOrigin.trim() || 'Kanban',
      product: newLeadProduct.trim(),
      status: newLeadStage as KanbanStage,
      observations: '',
      interactions: [],
      createdAt: new Date().toISOString().slice(0, 10),
      funnel,
    });
    if (!created) {
      toast({ title: 'Erro ao cadastrar lead', description: 'O banco de dados não confirmou o cadastro. Revise os dados e tente novamente.', variant: 'destructive' });
      return;
    }
    closeAddLead();
    setNewLeadName('');
    setNewLeadCompany('');
    setNewLeadPhone('');
    setNewLeadWhatsapp('');
    setNewLeadEmail('');
    setNewLeadProduct('');
    setNewLeadOrigin('Kanban');
    setNewLeadStage('lead_novo');
    setNewLeadAssignee(user?.id || '');
    toast({ title: 'Lead cadastrado', description: 'O lead foi adicionado ao funil selecionado.' });
  };

  const handleAddColumn = async () => {
    if (!newColLabel.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: 'Erro', description: 'Você precisa estar logado.', variant: 'destructive' });
      return;
    }
    const key = `custom_${Date.now()}`;
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-teal-500', 'bg-pink-500'];
    const color = colors[customStages.length % colors.length];
    const { data, error } = await supabase
      .from('kanban_stages')
      .insert({ user_id: user.id, funnel, key, label: newColLabel.trim(), color, position: customStages.length })
      .select()
      .single();
    if (error || !data) {
      toast({ title: 'Erro ao criar coluna', description: error?.message, variant: 'destructive' });
      return;
    }
    setCustomStages([...customStages, { key: data.key, label: data.label, color: data.color, userId: user.id }]);
    setNewColLabel('');
    setShowAddColumn(false);
    toast({ title: 'Coluna criada', description: `"${data.label}" foi salva.` });
  };

  const handleDeleteColumn = async (key: string) => {
    if (!canManageCustomStage(key)) {
      toast({ title: 'Apenas visualização', description: 'Você pode visualizar colunas de outros perfis, mas só pode excluir as permitidas pela sua função.', variant: 'destructive' });
      return;
    }
    const fallback = allStages.find(stage => stage.key !== key)?.key as KanbanStage | undefined;
    if (!fallback) {
      toast({ title: 'Não é possível excluir a última coluna', description: 'O funil precisa manter pelo menos uma etapa.', variant: 'destructive' });
      return;
    }
    if (confirm('Excluir esta coluna? Os leads serão movidos para a primeira coluna disponível.')) {
      const { error } = await supabase.rpc('delete_kanban_stage', {
        p_funnel: funnel,
        p_stage_key: key,
        p_fallback_key: fallback,
      });
      if (error) {
        toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
        return;
      }
      setCustomStages(customStages.filter(s => s.key !== key));
      await refreshLeads();
      toast({ title: 'Coluna excluída', description: 'Os leads foram movidos para outra etapa do mesmo funil.' });
    }
  };

  const handleRenameColumn = async (key: string) => {
    if (!canManageCustomStage(key)) {
      toast({ title: 'Apenas visualização', description: 'Você pode visualizar colunas de outros perfis, mas só pode editar as permitidas pela sua função.', variant: 'destructive' });
      return;
    }
    if (!editColLabel.trim()) return;
    const newLabel = editColLabel.trim();
    const { error } = await supabase.from('kanban_stages').update({ label: newLabel }).eq('key', key).eq('funnel', funnel);
    if (error) {
      toast({ title: 'Erro ao renomear', description: error.message, variant: 'destructive' });
      return;
    }
    setCustomStages(customStages.map(s => s.key === key ? { ...s, label: newLabel } : s));
    setEditingColumn(null);
    setEditColLabel('');
  };

  // Auto-scroll while dragging
  const handleDragOverContainer = useCallback((e: React.DragEvent) => {
    if (!draggedLead || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const rect = container.getBoundingClientRect();
    const scrollSpeed = 15;
    const edgeSize = 80;

    // Horizontal scroll
    if (e.clientX - rect.left < edgeSize) {
      container.scrollLeft -= scrollSpeed;
    } else if (rect.right - e.clientX < edgeSize) {
      container.scrollLeft += scrollSpeed;
    }
    // Vertical scroll
    if (e.clientY - rect.top < edgeSize) {
      container.scrollTop -= scrollSpeed;
    } else if (rect.bottom - e.clientY < edgeSize) {
      container.scrollTop += scrollSpeed;
    }
  }, [draggedLead]);

  const handleDragStart = (leadId: string) => setDraggedLead(leadId);
  const handleDragOver = (e: React.DragEvent, stage: KanbanStage) => { e.preventDefault(); setDragOverStage(stage); };
  const handleDrop = (stage: KanbanStage) => {
    if (draggedLead) {
      const lead = allLeads.find(item => item.id === draggedLead);
      if (lead && !canEditLead(lead)) {
        toast({ title: 'Apenas visualização', description: 'Você pode visualizar leads de todos os perfis, mas só pode mover leads conforme suas permissões.', variant: 'destructive' });
      } else {
        moveLeadToStage(draggedLead, stage);
      }
    }
    setDraggedLead(null); setDragOverStage(null);
  };
  const handleDragEnd = () => { setDraggedLead(null); setDragOverStage(null); };

  const handleEdit = () => {
    if (selectedLead) { setEditData({ ...selectedLead }); setEditMode(true); }
  };

  const handleSaveEdit = async () => {
    if (!editData) return;
    const saved = await updateLead(editData);
    if (!saved) return;
    setSelectedLead(editData);
    setEditMode(false);
    setEditData(null);
  };

  const handleDelete = () => {
    if (selectedLead && confirm('Tem certeza que deseja excluir este lead?')) { deleteLead(selectedLead.id); setSelectedLead(null); }
  };

  const handleCardStatusChange = (lead: Lead, newStatus: string) => {
    if (!canEditLead(lead)) {
      toast({ title: 'Apenas visualização', description: 'Gestores não editam leads de vendedores.', variant: 'destructive' });
      return;
    }
    moveLeadToStage(lead.id, newStatus as KanbanStage);
  };

  const handleCardObsChange = (lead: Lead, obs: string) => {
    if (!canEditLead(lead)) {
      toast({ title: 'Apenas visualização', description: 'Gestores não editam leads de vendedores.', variant: 'destructive' });
      return;
    }
    updateLead({ ...lead, observations: obs });
  };

  const toggleExpand = (stage: KanbanStage) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage); else next.add(stage);
      return next;
    });
  };

  const MAX_VISIBLE = 4;

  const loadLogoDataUrl = async (): Promise<string | null> => {
    try {
      const res = await fetch('/logo-future.png');
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  const handleExportPDF = async () => {
    const activeStageKeys = selectedStageKeys ?? allStages.map(s => s.key as string);
    if (activeStageKeys.length === 0) return;
    const filtered = leads.filter(l =>
      !searchQuery || l.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const logo = await loadLogoDataUrl();
    if (logo) { try { doc.addImage(logo, 'PNG', 40, 28, 90, 36); } catch {} }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(76, 29, 149);
    doc.text('Relatório do Funil — Status da Negociação', pageWidth / 2, 46, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90);
    doc.text(`Setor: ${sectorLabel}`, pageWidth / 2, 62, { align: 'center' });
    const totalIncluded = filtered.filter(l => activeStageKeys.includes(l.status as string)).length;
    doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}  •  Total: ${totalIncluded} leads`, pageWidth / 2, 76, { align: 'center' });

    let cursorY = 100;
    allStages.forEach((stage) => {
      if (!activeStageKeys.includes(stage.key as string)) return;
      const rows = filtered.filter(l => l.status === stage.key);
      if (rows.length === 0) return;
      if (cursorY > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); cursorY = 50; }
      doc.setFillColor(124, 58, 237);
      doc.rect(40, cursorY, pageWidth - 80, 22, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(`${stage.label}  (${rows.length})`, 50, cursorY + 15);
      cursorY += 22;
      autoTable(doc, {
        startY: cursorY,
        head: [['Nome', 'Empresa', 'Telefone', 'WhatsApp', 'Email', 'Produto', 'Origem', 'Observações']],
        body: rows.map((l) => [
          l.name || '—',
          l.company || '—',
          l.phone || '—',
          l.whatsapp || '—',
          l.email || '—',
          l.product || '—',
          l.origin || '—',
          l.observations || '—',
        ]),
        styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
        headStyles: { fillColor: [237, 233, 254], textColor: [76, 29, 149], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 249, 255] },
        columnStyles: {
          0: { cellWidth: 90 }, 1: { cellWidth: 100 }, 2: { cellWidth: 75 },
          3: { cellWidth: 75 }, 4: { cellWidth: 110 }, 5: { cellWidth: 70 },
          6: { cellWidth: 70 }, 7: { cellWidth: 'auto' },
        },
        margin: { left: 40, right: 40 },
        didDrawPage: () => {
          const pageCount = doc.getNumberOfPages();
          const currentPage = doc.getCurrentPageInfo().pageNumber;
          doc.setFontSize(8); doc.setTextColor(120);
          doc.text(`Página ${currentPage} de ${pageCount}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
        },
      });
      cursorY = (doc as any).lastAutoTable.finalY + 20;
    });
    const safeFunnelName = funnel.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`funil-${safeFunnelName}-${new Date().toISOString().split('T')[0]}.pdf`);
    setShowExport(false);
  };



  if (authLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando funil...</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Funil — {sectorLabel}</h1>
          <p className="text-muted-foreground text-sm mt-1">Arraste os leads entre as colunas para atualizar o status</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SectorSelector />
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar lead por nome..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 w-full sm:w-56"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowExport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-medium hover:bg-muted transition"
          >
            <FileDown size={16} /> Exportar PDF
          </button>
          <button
            onClick={() => { setNewLeadAssignee(user?.id || ''); setShowAddLead(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            <Plus size={16} /> Novo Lead
          </button>
          <button
            onClick={() => setShowAddColumn(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            <Plus size={16} /> Adicionar Coluna
          </button>
        </div>
      </div>

      {/* Export PDF modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowExport(false)}>
          <div className="bg-card rounded-xl border border-border max-w-md w-full p-6 space-y-4 animate-slide-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground flex items-center gap-2"><FileDown size={18} className="text-primary" /> Exportar PDF</h3>
              <button onClick={() => setShowExport(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <p className="text-sm text-muted-foreground">Selecione as colunas do funil que devem aparecer no relatório:</p>
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => setSelectedStageKeys(allStages.map(s => s.key as string))}
                className="px-2 py-1 rounded border border-border hover:bg-muted transition"
              >Todas</button>
              <button
                onClick={() => setSelectedStageKeys([])}
                className="px-2 py-1 rounded border border-border hover:bg-muted transition"
              >Nenhuma</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {allStages.map(stage => {
                const activeKeys = selectedStageKeys ?? allStages.map(s => s.key as string);
                const checked = activeKeys.includes(stage.key as string);
                const count = leads.filter(l => l.status === stage.key).length;
                return (
                  <label key={stage.key as string} className="flex items-center gap-2 text-sm text-foreground p-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        const base = selectedStageKeys ?? allStages.map(s => s.key as string);
                        if (e.target.checked) setSelectedStageKeys([...base, stage.key as string]);
                        else setSelectedStageKeys(base.filter(k => k !== stage.key));
                      }}
                      className="accent-primary"
                    />
                    <span className="flex-1 truncate">{stage.label}</span>
                    <span className="text-xs text-muted-foreground">{count}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowExport(false)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition">Cancelar</button>
              <button
                onClick={handleExportPDF}
                disabled={(selectedStageKeys ?? allStages).length === 0}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >Gerar PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* Lead assignment history */}
      {historyLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setHistoryLead(null)}>
          <div className="bg-card rounded-xl border border-border max-w-lg w-full p-6 space-y-4 animate-slide-in max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground flex items-center gap-2"><History size={18} /> Histórico de responsáveis</h3>
              <button onClick={() => setHistoryLead(null)} className="text-muted-foreground hover:text-foreground" aria-label="Fechar"><X size={18} /></button>
            </div>
            <p className="text-sm text-muted-foreground">{historyLead.name}</p>
            {historyLoading ? <p className="text-sm text-muted-foreground">Carregando histórico...</p> : leadAssignmentHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4 text-center">Ainda não há transferências registradas para este lead.</p>
            ) : (
              <div className="space-y-2">
                {leadAssignmentHistory.map(item => {
                  const previous = teamMembers.find(member => member.user_id === item.previous_assignee);
                  const next = teamMembers.find(member => member.user_id === item.new_assignee);
                  const actor = teamMembers.find(member => member.user_id === item.changed_by);
                  return (
                    <div key={item.id} className="rounded-lg border border-border p-3 space-y-1">
                      <p className="text-sm text-foreground">{previous?.display_name || 'Sem responsável'} → <span className="font-medium">{next?.display_name || 'Sem responsável'}</span></p>
                      <p className="text-xs text-muted-foreground">Alterado por {actor?.display_name || 'Usuário'} · {new Date(item.changed_at).toLocaleString('pt-BR')}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create lead modal */}
      {showAddLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddLead(false)}>
          <div className="bg-card rounded-xl border border-border max-w-lg w-full p-6 space-y-4 animate-slide-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Novo lead — {sectorLabel}</h3>
              <button onClick={closeAddLead} className="text-muted-foreground hover:text-foreground" aria-label="Fechar"><X size={18} /></button>
            </div>
            <div><label className="text-xs text-muted-foreground">Nome *</label><input autoFocus value={newLeadName} onChange={e => setNewLeadName(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" placeholder="Nome do contato" /></div>
            <div><label className="text-xs text-muted-foreground">Empresa</label><input value={newLeadCompany} onChange={e => setNewLeadCompany(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" placeholder="Empresa" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Telefone</label><input value={newLeadPhone} onChange={e => setNewLeadPhone(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" placeholder="Telefone" /></div>
              <div><label className="text-xs text-muted-foreground">WhatsApp</label><input value={newLeadWhatsapp} onChange={e => setNewLeadWhatsapp(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" placeholder="Se vazio, usa o telefone" /></div>
            </div>
            <div><label className="text-xs text-muted-foreground">E-mail</label><input type="email" value={newLeadEmail} onChange={e => setNewLeadEmail(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" placeholder="E-mail" /></div>
            <div><label className="text-xs text-muted-foreground">Produto / serviço</label><input value={newLeadProduct} onChange={e => setNewLeadProduct(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" placeholder="Ex.: SPC Brasil, certificado digital" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Etapa inicial</label><select value={newLeadStage} onChange={e => setNewLeadStage(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm">{allStages.map(stage => <option key={stage.key} value={stage.key}>{stage.label}</option>)}</select></div>
              <div><label className="text-xs text-muted-foreground">Origem</label><input value={newLeadOrigin} onChange={e => setNewLeadOrigin(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" /></div>
            </div>
            <div><label className="text-xs text-muted-foreground">Responsável</label><select value={newLeadAssignee} onChange={e => setNewLeadAssignee(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"><option value="">Sem responsável</option>{teamMembers.map(member => <option key={member.user_id} value={member.user_id}>{member.display_name || member.email || 'Usuário'}</option>)}</select></div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={closeAddLead} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition">Cancelar</button>
              <button onClick={() => void handleCreateLead()} disabled={!newLeadName.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-50">Cadastrar lead</button>
            </div>
          </div>
        </div>
      )}

      {/* Add column modal */}
      {showAddColumn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddColumn(false)}>
          <div className="bg-card rounded-xl border border-border max-w-sm w-full p-6 space-y-4 animate-slide-in" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-foreground">Nova Coluna</h3>
            <input
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
              placeholder="Nome da coluna"
              value={newColLabel}
              onChange={e => setNewColLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddColumn()}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddColumn(false)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition">Cancelar</button>
              <button onClick={handleAddColumn} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* Lead detail/edit modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setSelectedLead(null); setEditMode(false); setEditData(null); }}>
          <div className="bg-card rounded-xl border border-border max-w-lg w-full p-6 space-y-4 animate-slide-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><User2 size={20} /> {editMode ? 'Editar Lead' : selectedLead.name}</h2>
              <div className="flex items-center gap-2">
                {!editMode && canEditLead(selectedLead) && (
                  <>
                    <button onClick={handleEdit} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition" title="Editar"><Edit3 size={16} /></button>
                    <button onClick={handleDelete} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition" title="Excluir"><Trash2 size={16} /></button>
                  </>
                )}
                <button onClick={() => { setSelectedLead(null); setEditMode(false); setEditData(null); }} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
              </div>
            </div>

            {editMode && editData ? (
              <div className="space-y-3">
                <div><label className="text-xs text-muted-foreground">Nome</label><input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Empresa</label><input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={editData.company} onChange={e => setEditData({ ...editData, company: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground">Funil / Kanban</label><select className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={String((editData as any).funnel || 'spc')} onChange={e => setEditData({ ...editData, funnel: e.target.value } as Lead)}>{sectors.map(sector => <option key={sector.key} value={sector.key}>{sector.label}</option>)}</select></div>
                  <div><label className="text-xs text-muted-foreground">Etapa</label><select className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={editData.status} onChange={e => setEditData({ ...editData, status: e.target.value as KanbanStage })}>{editFunnelStages.map(stage => <option key={stage.key} value={stage.key}>{stage.label}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground">Telefone</label><input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} /></div>
                  <div><label className="text-xs text-muted-foreground">WhatsApp</label><input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={editData.whatsapp} onChange={e => setEditData({ ...editData, whatsapp: e.target.value })} /></div>
                </div>
                <div><label className="text-xs text-muted-foreground">Email</label><input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={editData.email || ''} onChange={e => setEditData({ ...editData, email: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">CPF/CNPJ</label><input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={editData.cpfCnpj} onChange={e => setEditData({ ...editData, cpfCnpj: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Endereço</label><input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={editData.address || ''} onChange={e => setEditData({ ...editData, address: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Observações</label><textarea className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm min-h-[80px]" value={editData.observations} onChange={e => setEditData({ ...editData, observations: e.target.value })} /></div>
                <button onClick={handleSaveEdit} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"><Save size={16} /> Salvar Alterações</button>
              </div>
            ) : (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Empresa:</span><span className="text-foreground">{selectedLead.company || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">CPF/CNPJ:</span><span className="text-foreground">{selectedLead.cpfCnpj || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Telefone:</span><span className="text-foreground">{selectedLead.phone || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">WhatsApp:</span><span className="text-foreground">{selectedLead.whatsapp || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Email:</span><span className="text-foreground">{selectedLead.email || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Endereço:</span><span className="text-foreground">{selectedLead.address || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tipo:</span><span className="text-foreground">{selectedLead.type}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Origem:</span><span className="text-foreground">{selectedLead.origin || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Produto:</span><span className="spc-badge">{selectedLead.product}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status:</span><span className="text-foreground">{allStages.find(s => s.key === selectedLead.status)?.label}</span></div>
                </div>
                {selectedLead.observations && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <span className="text-xs font-semibold text-muted-foreground block mb-1">Observações:</span>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selectedLead.observations}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => handleStartConversation(selectedLead)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#25D366] text-white text-sm font-medium hover:opacity-90 transition"><MessageCircle size={15} /> Conversar</button>
                  {selectedLead.email && (
                    <a href={`mailto:${selectedLead.email}`} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm font-medium hover:bg-muted transition"><Mail size={15} /> Email</a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile column selector */}
      <div className="lg:hidden">
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Selecione a coluna</label>
        <select
          value={mobileStage}
          onChange={e => setMobileStage(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground"
        >
          {allStages.map(s => {
            const count = leads.filter(l => l.status === s.key).length;
            return <option key={s.key} value={s.key}>{s.label} ({count})</option>;
          })}
        </select>
      </div>

      {/* Mobile single-column view */}
      <div className="lg:hidden space-y-2">
        {(() => {
          const stage = allStages.find(s => s.key === mobileStage) || allStages[0];
          const allStageLeads = leads.filter(l => l.status === stage.key);
          const stageLeads = searchQuery.trim()
            ? allStageLeads.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
            : allStageLeads;
          const isExpanded = expandedStages.has(stage.key as KanbanStage);
          const visibleLeads = isExpanded ? stageLeads : stageLeads.slice(0, MAX_VISIBLE);
          const hasMore = stageLeads.length > MAX_VISIBLE;

          if (stageLeads.length === 0) {
            return <p className="text-sm text-muted-foreground text-center py-8">Sem leads nesta coluna</p>;
          }

          return (
            <>
              {visibleLeads.map(lead => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  allStages={allStages}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}

                  isDragging={draggedLead === lead.id}
                  onClick={() => { setSelectedLead(lead); setEditData({ ...lead }); setEditMode(true); }}
                  onStatusChange={handleCardStatusChange}
                  onObsChange={handleCardObsChange}
                  teamMembers={teamMembers}
                  currentUserId={user?.id || ''}
                  assigneeColor={getLeadAssigneePreference(lead.assignedTo)?.color}
                  assigneeName={getLeadAssigneePreference(lead.assignedTo)?.display_name || teamMembers.find(member => member.user_id === lead.assignedTo)?.display_name}
                  onAssign={handleAssignLead}
                  onStartConversation={handleStartConversation}
                  onOpenHistory={handleOpenLeadHistory}
                  onDelete={(l) => { if (!canEditLead(l)) return toast({ title: 'Apenas visualização', description: 'Gestores não excluem leads de vendedores.', variant: 'destructive' }); if (confirm('Excluir este lead?')) deleteLead(l.id); }}
                  onEdit={(l) => { if (!canEditLead(l)) return toast({ title: 'Apenas visualização', description: 'Gestores não editam leads de vendedores.', variant: 'destructive' }); setSelectedLead(l); setEditData({ ...l }); setEditMode(true); }}
                />
              ))}
              {hasMore && (
                <button
                  onClick={() => toggleExpand(stage.key as KanbanStage)}
                  className="w-full flex items-center justify-center gap-1 py-2 text-xs text-primary font-medium hover:bg-primary/5 rounded-lg transition"
                >
                  {isExpanded ? <><ChevronUp size={14} /> Mostrar menos</> : <><ChevronDown size={14} /> Ver mais ({stageLeads.length - MAX_VISIBLE})</>}
                </button>
              )}
            </>
          );
        })()}
      </div>

      {/* Desktop kanban */}
      <div
        ref={scrollContainerRef}
        className="hidden lg:block overflow-x-auto overflow-y-auto pb-4"
        style={{ maxHeight: 'calc(100vh - 160px)' }}
        onDragOver={handleDragOverContainer}
      >
        <div className="flex gap-3 min-w-max">
          {allStages.map(stage => {
            const allStageLeads = leads.filter(l => l.status === stage.key);
            const stageLeads = searchQuery.trim()
              ? allStageLeads.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
              : allStageLeads;
            const isDragOver = dragOverStage === stage.key;
            const isExpanded = expandedStages.has(stage.key as KanbanStage);
            const visibleLeads = isExpanded ? stageLeads : stageLeads.slice(0, MAX_VISIBLE);
            const hasMore = stageLeads.length > MAX_VISIBLE;

            return (
              <div
                key={stage.key}
                className={`kanban-column transition-all duration-200 ${isDragOver ? 'kanban-column-drop-active ring-2 ring-primary/50 bg-primary/10' : ''}`}
                onDragOver={(e) => handleDragOver(e, stage.key as KanbanStage)}
                onDrop={() => handleDrop(stage.key as KanbanStage)}
                onDragLeave={() => setDragOverStage(null)}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${stage.color}`} />
                    {editingColumn === stage.key ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input className="text-sm font-semibold text-foreground bg-background border border-border rounded px-1 py-0.5 w-full" value={editColLabel} onChange={e => setEditColLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRenameColumn(stage.key)} autoFocus />
                        <button onClick={() => handleRenameColumn(stage.key)} className="text-primary"><Save size={12} /></button>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-foreground truncate">{stage.label}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {canManageCustomStage(stage.key) && (
                      <>
                        <button onClick={() => { setEditingColumn(stage.key); setEditColLabel(stage.label); }} className="text-muted-foreground hover:text-primary transition p-0.5" title="Renomear"><Edit3 size={11} /></button>
                        <button onClick={() => handleDeleteColumn(stage.key)} className="text-muted-foreground hover:text-destructive transition p-0.5" title="Excluir coluna"><Trash2 size={11} /></button>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">{stageLeads.length}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {stageLeads.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Sem leads</p>
                  )}
                  {visibleLeads.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      allStages={allStages}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}

                      isDragging={draggedLead === lead.id}
                      onClick={() => { setSelectedLead(lead); setEditData({ ...lead }); setEditMode(true); }}
                      onStatusChange={handleCardStatusChange}
                      onObsChange={handleCardObsChange}
                      teamMembers={teamMembers}
                      currentUserId={user?.id || ''}
                      assigneeColor={getLeadAssigneePreference(lead.assignedTo)?.color}
                      assigneeName={getLeadAssigneePreference(lead.assignedTo)?.display_name || teamMembers.find(member => member.user_id === lead.assignedTo)?.display_name}
                      onAssign={handleAssignLead}
                      onOpenHistory={handleOpenLeadHistory}
                      onDelete={(l) => { if (!canEditLead(l)) return toast({ title: 'Apenas visualização', description: 'Gestores não excluem leads de vendedores.', variant: 'destructive' }); if (confirm('Excluir este lead?')) deleteLead(l.id); }}
                      onEdit={(l) => { if (!canEditLead(l)) return toast({ title: 'Apenas visualização', description: 'Gestores não editam leads de vendedores.', variant: 'destructive' }); setSelectedLead(l); setEditData({ ...l }); setEditMode(true); }}
                    />
                  ))}
                  {hasMore && (
                    <button
                      onClick={() => toggleExpand(stage.key as KanbanStage)}
                      className="w-full flex items-center justify-center gap-1 py-2 text-xs text-primary font-medium hover:bg-primary/5 rounded-lg transition"
                    >
                      {isExpanded ? <><ChevronUp size={14} /> Mostrar menos</> : <><ChevronDown size={14} /> Ver mais ({stageLeads.length - MAX_VISIBLE})</>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface LeadCardProps {
  lead: Lead;
  allStages: { key: string; label: string; color: string }[];
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  onClick: () => void;
  onStatusChange: (lead: Lead, status: string) => void;
  onObsChange: (lead: Lead, obs: string) => void;
  teamMembers: { user_id: string; display_name: string; email: string | null }[];
  currentUserId: string;
  assigneeColor?: string;
  assigneeName?: string;
  onAssign: (lead: Lead, assigneeId: string) => void;
  onStartConversation: (lead: Lead) => void;
  onOpenHistory: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
}

const LeadCard = ({ lead, allStages, onDragStart, onDragEnd, isDragging, onClick, onStatusChange, onObsChange, teamMembers, currentUserId, assigneeColor, assigneeName, onAssign, onStartConversation, onOpenHistory, onDelete, onEdit }: LeadCardProps) => {
  const [showObs, setShowObs] = useState(false);
  const [obsText, setObsText] = useState(lead.observations || '');
  const interactionDates = [
    lead.lastInteractionAt ? new Date(lead.lastInteractionAt).getTime() : 0,
    ...(Array.isArray(lead.interactions) ? lead.interactions.map(item => item?.date ? new Date(item.date).getTime() : 0) : []),
  ].filter(value => Number.isFinite(value) && value > 0);
  const lastInteraction = interactionDates.length ? Math.max(...interactionDates) : 0;
  const createdTimestamp = lead.createdAt ? new Date(`${lead.createdAt}T12:00:00`).getTime() : 0;
  const interactionReference = lastInteraction || createdTimestamp;
  const daysSinceInteraction = interactionReference > 0 ? Math.max(0, Math.floor((Date.now() - interactionReference) / 86400000)) : 0;
  const interactionColor = daysSinceInteraction <= 10 ? '#22c55e' : daysSinceInteraction <= 30 ? '#eab308' : '#ef4444';
  const interactionProgress = Math.min(100, daysSinceInteraction / 30 * 100);
  const createdLabel = lead.createdAt ? new Date(`${lead.createdAt}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div
      id={`lead-card-${lead.id}`}
      draggable
      onDragStart={() => onDragStart(lead.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`kanban-card relative animate-slide-in cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all ${isDragging ? 'kanban-card-dragging' : ''}`}
      style={{ borderColor: interactionColor, boxShadow: `0 0 0 1px ${interactionColor}44` }}
    >
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="1" y="1" width="98" height="98" rx="4" fill="none" stroke={interactionColor} strokeWidth="1.5" strokeDasharray={`${interactionProgress / 100 * 384} 384`} style={{ transition: 'stroke-dasharray 700ms ease, stroke 700ms ease' }} />
      </svg>
      <div className="flex items-start justify-between mb-1.5">
        <span className="font-medium text-sm text-foreground">{lead.name}</span>
        <GripVertical size={14} className="text-muted-foreground/50 flex-shrink-0 cursor-grab" />
      </div>
      
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        <Building2 size={12} />
        <span className="text-xs truncate">{lead.company}</span>
      </div>
      
      <div className="spc-badge mb-1.5">{lead.product}</div>
      {(lead.planValue != null || lead.biro) && (
        <div className="flex flex-wrap gap-1 mb-1.5 text-[10px]">
          {lead.planValue != null && <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">VP {Number(lead.planValue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
          {lead.biro && <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">B - {lead.biro}</span>}
        </div>
      )}

      {/* Data de criação e contador de inatividade */}
      <div className="mb-1.5" title={`Criado em ${createdLabel}; sem interação há ${daysSinceInteraction} dia(s)`}>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock size={11} />
          <span>Criado: {createdLabel}</span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: interactionColor }} />
            {daysSinceInteraction === 0 ? 'Interação hoje' : `há ${daysSinceInteraction} ${daysSinceInteraction === 1 ? 'dia' : 'dias'} sem interação`}
          </span>
        </div>
        <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden" aria-label={`${interactionProgress.toFixed(0)}% do ciclo de 30 dias sem interação`}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${interactionProgress}%`, backgroundColor: interactionColor }} />
        </div>
      </div>

      {/* Status selector */}
      <div className="mb-1.5" onClick={e => e.stopPropagation()}>
        <select
          value={lead.status}
          onChange={e => onStatusChange(lead, e.target.value)}
          className="w-full text-[10px] px-1.5 py-1 rounded border border-border bg-background text-foreground"
        >
          {allStages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {/* Observations preview */}
      {lead.observations && (
        <div className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-1 mb-1.5 line-clamp-2">
          <FileText size={10} className="inline mr-1" />{lead.observations}
        </div>
      )}

      {/* Quick obs input */}
      <div className="mb-1.5" onClick={e => e.stopPropagation()}>
        {showObs ? (
          <div className="space-y-1">
            <textarea
              className="w-full text-xs px-2 py-1 rounded border border-border bg-background text-foreground resize-none"
              rows={2}
              value={obsText}
              onChange={e => setObsText(e.target.value)}
              placeholder="Observações..."
            />
            <div className="flex gap-1">
              <button onClick={() => { onObsChange(lead, obsText); setShowObs(false); }} className="text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground">Salvar</button>
              <button onClick={() => setShowObs(false)} className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground">Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowObs(true)} className="text-[10px] text-primary hover:underline">
            ✏️ {lead.observations ? 'Editar obs' : 'Adicionar obs'}
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-2 mt-1">
        <button type="button" onClick={e => { e.stopPropagation(); onStartConversation(lead); }} className="text-muted-foreground hover:text-success transition" title="Conversar no WhatsApp do CRM" aria-label={`Conversar com ${lead.name} no WhatsApp do CRM`}>
          <MessageCircle size={13} />
        </button>
        {lead.email && <a href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-primary transition"><Mail size={13} /></a>}
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()} title="Atribuir responsável">
          <UserPlus size={13} className="text-muted-foreground shrink-0" />
          <select
            aria-label={`Responsável pelo lead ${lead.name}`}
            value={lead.assignedTo || ''}
            onChange={e => onAssign(lead, e.target.value)}
            className="max-w-[110px] text-[10px] px-1 py-1 rounded border border-border bg-background text-foreground"
          >
            <option value="">Sem responsável</option>
            {teamMembers.map(member => <option key={member.user_id} value={member.user_id}>{member.display_name || member.email || 'Usuário'}</option>)}
          </select>
          {currentUserId && lead.assignedTo !== currentUserId && (
            <button
              type="button"
              onClick={() => onAssign(lead, currentUserId)}
              className="text-muted-foreground hover:text-primary transition"
              title="Assumir este lead"
              aria-label="Assumir este lead"
            ><User2 size={13} /></button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => onOpenHistory(lead)} className="text-muted-foreground hover:text-primary transition" title="Histórico de responsáveis" aria-label="Histórico de responsáveis"><History size={12} /></button>
          <button onClick={() => onEdit(lead)} className="text-muted-foreground hover:text-primary transition"><Edit3 size={12} /></button>
          <button onClick={() => onDelete(lead)} className="text-muted-foreground hover:text-destructive transition"><Trash2 size={12} /></button>
        </div>
      </div>
      {lead.assignedTo && <div className="mt-2 h-1.5 w-full rounded-full transition-colors duration-200" style={{ backgroundColor: assigneeColor || '#64748b' }} title={`Responsável: ${assigneeName || 'usuário atribuído'}`} aria-label={`Responsável: ${assigneeName || 'usuário atribuído'}`} data-assignee-id={lead.assignedTo} />}
    </div>
  );
};

export default CRMKanban;
