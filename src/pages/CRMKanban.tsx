import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppState } from '@/context/AppContext';
import { KANBAN_STAGES, KanbanStage, Lead } from '@/data/spcData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  GripVertical, Phone, MessageCircle, Building2, Mail, X, User2, 
  Edit3, Trash2, Save, ChevronDown, ChevronUp, Plus, Settings, FileText, Search, FileDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { useSectors } from '@/hooks/useSectors';
import SectorSelector from '@/components/SectorSelector';
import { useAuth } from '@/hooks/useAuth';

const CRMKanban = () => {
  const { role, user, loading: authLoading } = useAuth();
  const { activeSector, sectors } = useSectors();
  const isGestor = !authLoading && role === 'gestor';
  const funnel = isGestor ? activeSector : 'spc';
  const sectorLabel = sectors.find(s => s.key === funnel)?.label || funnel;
  const { leads: allLeads, moveLeadToStage, updateLead, deleteLead } = useAppState();
  const leads = allLeads.filter(l => ((l as any).funnel || 'spc') === funnel);
  const baseStages = KANBAN_STAGES;
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<KanbanStage | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Lead | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<KanbanStage>>(new Set());
  const [customStages, setCustomStages] = useState<{ key: string; label: string; color: string }[]>([]);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editColLabel, setEditColLabel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileStage, setMobileStage] = useState<string>(baseStages[0]?.key || '');
  const [showExport, setShowExport] = useState(false);
  const [selectedStageKeys, setSelectedStageKeys] = useState<string[] | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const canEditLead = (lead: Lead) => !lead.userId || lead.userId === user?.id;

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
        setCustomStages(data.map(d => ({ key: d.key, label: d.label, color: d.color })));
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
                  setCustomStages(inserted.map(d => ({ key: d.key, label: d.label, color: d.color })));
                  localStorage.removeItem('custom_kanban_stages');
                }
              }
            } catch (e) { console.error(e); }
          }
        }
      }
    };
    load();
  }, [funnel]);

  useEffect(() => {
    setMobileStage(baseStages[0]?.key || '');
    setCustomStages([]);
  }, [funnel]);

  const allStages = [...baseStages, ...customStages.map(s => ({ ...s, key: s.key as KanbanStage }))];

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
    setCustomStages([...customStages, { key: data.key, label: data.label, color: data.color }]);
    setNewColLabel('');
    setShowAddColumn(false);
    toast({ title: 'Coluna criada', description: `"${data.label}" foi salva.` });
  };

  const handleDeleteColumn = async (key: string) => {
    const fallback = (baseStages[0]?.key as KanbanStage) || ('lead_novo' as KanbanStage);
    if (confirm('Excluir esta coluna? Os leads serão movidos para a primeira coluna.')) {
      leads.filter(l => l.status === key).forEach(l => moveLeadToStage(l.id, fallback));
      const { error } = await supabase.from('kanban_stages').delete().eq('key', key).eq('funnel', funnel);
      if (error) {
        toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
        return;
      }
      setCustomStages(customStages.filter(s => s.key !== key));
    }
  };

  const handleRenameColumn = async (key: string) => {
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
    if (draggedLead) moveLeadToStage(draggedLead, stage);
    setDraggedLead(null); setDragOverStage(null);
  };
  const handleDragEnd = () => { setDraggedLead(null); setDragOverStage(null); };

  const handleEdit = () => {
    if (selectedLead) { setEditData({ ...selectedLead }); setEditMode(true); }
  };

  const handleSaveEdit = () => {
    if (editData) { updateLead(editData); setSelectedLead(editData); setEditMode(false); setEditData(null); }
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
    const cols = EXPORT_COLUMNS.filter(c => selectedCols.includes(c.key as string));
    if (cols.length === 0) return;
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
    doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}  •  Total: ${filtered.length} leads`, pageWidth / 2, 76, { align: 'center' });

    let cursorY = 100;
    allStages.forEach((stage) => {
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
        head: [cols.map(c => c.label)],
        body: rows.map(l => cols.map(c => {
          if (c.key === 'status') return allStages.find(s => s.key === l.status)?.label || '—';
          return (l as any)[c.key] || '—';
        })),
        styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
        headStyles: { fillColor: [237, 233, 254], textColor: [76, 29, 149], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 249, 255] },
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
    doc.save(`funil-${funnel}-${new Date().toISOString().split('T')[0]}.pdf`);
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
          {isGestor && <SectorSelector />}
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
            <p className="text-sm text-muted-foreground">Selecione as colunas que devem aparecer no relatório:</p>
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => setSelectedCols(EXPORT_COLUMNS.map(c => c.key as string))}
                className="px-2 py-1 rounded border border-border hover:bg-muted transition"
              >Todas</button>
              <button
                onClick={() => setSelectedCols([])}
                className="px-2 py-1 rounded border border-border hover:bg-muted transition"
              >Nenhuma</button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {EXPORT_COLUMNS.map(col => {
                const checked = selectedCols.includes(col.key as string);
                return (
                  <label key={col.key as string} className="flex items-center gap-2 text-sm text-foreground p-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        if (e.target.checked) setSelectedCols([...selectedCols, col.key as string]);
                        else setSelectedCols(selectedCols.filter(k => k !== col.key));
                      }}
                      className="accent-primary"
                    />
                    <span>{col.label}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowExport(false)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition">Cancelar</button>
              <button
                onClick={handleExportPDF}
                disabled={selectedCols.length === 0}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >Gerar PDF</button>
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
                {!editMode && (
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
                  <a href={`tel:${selectedLead.phone}`} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"><Phone size={15} /> Ligar</a>
                  <a href={`https://wa.me/${selectedLead.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#25D366] text-white text-sm font-medium hover:opacity-90 transition"><MessageCircle size={15} /> WhatsApp</a>
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
                  onClick={() => setSelectedLead(lead)}
                  onStatusChange={handleCardStatusChange}
                  onObsChange={handleCardObsChange}
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
            const isCustom = customStages.some(s => s.key === stage.key);

            return (
              <div
                key={stage.key}
                className={`kanban-column transition-all duration-200 ${isDragOver ? 'ring-2 ring-primary/40 bg-primary/5' : ''}`}
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
                    {isCustom && (
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
                      onClick={() => setSelectedLead(lead)}
                      onStatusChange={handleCardStatusChange}
                      onObsChange={handleCardObsChange}
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
  onClick: () => void;
  onStatusChange: (lead: Lead, status: string) => void;
  onObsChange: (lead: Lead, obs: string) => void;
  onDelete: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
}

const LeadCard = ({ lead, allStages, onDragStart, onDragEnd, onClick, onStatusChange, onObsChange, onDelete, onEdit }: LeadCardProps) => {
  const [showObs, setShowObs] = useState(false);
  const [obsText, setObsText] = useState(lead.observations || '');

  return (
    <div
      draggable
      onDragStart={() => onDragStart(lead.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="kanban-card animate-slide-in cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
    >
      <div className="flex items-start justify-between mb-1.5">
        <span className="font-medium text-sm text-foreground">{lead.name}</span>
        <GripVertical size={14} className="text-muted-foreground/50 flex-shrink-0 cursor-grab" />
      </div>
      
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        <Building2 size={12} />
        <span className="text-xs truncate">{lead.company}</span>
      </div>
      
      <div className="spc-badge mb-1.5">{lead.product}</div>

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
        <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-primary transition"><Phone size={13} /></a>
        <a href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-success transition"><MessageCircle size={13} /></a>
        {lead.email && <a href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-primary transition"><Mail size={13} /></a>}
        <div className="ml-auto flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => onEdit(lead)} className="text-muted-foreground hover:text-primary transition"><Edit3 size={12} /></button>
          <button onClick={() => onDelete(lead)} className="text-muted-foreground hover:text-destructive transition"><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  );
};

export default CRMKanban;
