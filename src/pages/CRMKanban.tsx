import { useState } from 'react';
import { useAppState } from '@/context/AppContext';
import { KANBAN_STAGES, KanbanStage, Lead } from '@/data/spcData';
import { 
  GripVertical, Phone, MessageCircle, Building2, Mail, X, User2, 
  Edit3, Trash2, Save, ChevronDown, ChevronUp 
} from 'lucide-react';

const CRMKanban = () => {
  const { leads, moveLeadToStage, updateLead, deleteLead } = useAppState();
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<KanbanStage | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Lead | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<KanbanStage>>(new Set());

  const handleDragStart = (leadId: string) => setDraggedLead(leadId);
  const handleDragOver = (e: React.DragEvent, stage: KanbanStage) => { e.preventDefault(); setDragOverStage(stage); };
  const handleDrop = (stage: KanbanStage) => {
    if (draggedLead) moveLeadToStage(draggedLead, stage);
    setDraggedLead(null); setDragOverStage(null);
  };
  const handleDragEnd = () => { setDraggedLead(null); setDragOverStage(null); };

  const handleEdit = () => {
    if (selectedLead) {
      setEditData({ ...selectedLead });
      setEditMode(true);
    }
  };

  const handleSaveEdit = () => {
    if (editData) {
      updateLead(editData);
      setSelectedLead(editData);
      setEditMode(false);
      setEditData(null);
    }
  };

  const handleDelete = () => {
    if (selectedLead && confirm('Tem certeza que deseja excluir este lead?')) {
      deleteLead(selectedLead.id);
      setSelectedLead(null);
    }
  };

  const toggleExpand = (stage: KanbanStage) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage); else next.add(stage);
      return next;
    });
  };

  const MAX_VISIBLE = 4;

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">CRM / Funil de Vendas</h1>
        <p className="text-muted-foreground text-sm mt-1">Arraste os leads entre as colunas para atualizar o status</p>
      </div>

      {/* Lead detail/edit modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setSelectedLead(null); setEditMode(false); setEditData(null); }}>
          <div className="bg-card rounded-xl border border-border max-w-lg w-full p-6 space-y-4 animate-slide-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><User2 size={20} /> {editMode ? 'Editar Lead' : selectedLead.name}</h2>
              <div className="flex items-center gap-2">
                {!editMode && (
                  <>
                    <button onClick={handleEdit} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition" title="Editar">
                      <Edit3 size={16} />
                    </button>
                    <button onClick={handleDelete} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition" title="Excluir">
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
                <button onClick={() => { setSelectedLead(null); setEditMode(false); setEditData(null); }} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
              </div>
            </div>

            {editMode && editData ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Nome</label>
                  <input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Empresa</label>
                  <input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={editData.company} onChange={e => setEditData({ ...editData, company: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Telefone</label>
                    <input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">WhatsApp</label>
                    <input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={editData.whatsapp} onChange={e => setEditData({ ...editData, whatsapp: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Email</label>
                  <input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={editData.email || ''} onChange={e => setEditData({ ...editData, email: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">CPF/CNPJ</label>
                  <input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={editData.cpfCnpj} onChange={e => setEditData({ ...editData, cpfCnpj: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Endereço</label>
                  <input className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" value={editData.address || ''} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Observações</label>
                  <textarea className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm min-h-[80px]" value={editData.observations} onChange={e => setEditData({ ...editData, observations: e.target.value })} placeholder="Observações após o contato..." />
                </div>
                <button onClick={handleSaveEdit} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">
                  <Save size={16} /> Salvar Alterações
                </button>
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
                  <div className="flex justify-between"><span className="text-muted-foreground">Status:</span><span className="text-foreground">{KANBAN_STAGES.find(s => s.key === selectedLead.status)?.label}</span></div>
                </div>
                {selectedLead.observations && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <span className="text-xs font-semibold text-muted-foreground block mb-1">Observações:</span>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selectedLead.observations}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <a href={`tel:${selectedLead.phone}`} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">
                    <Phone size={15} /> Ligar
                  </a>
                  <a href={`https://wa.me/${selectedLead.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#25D366] text-white text-sm font-medium hover:opacity-90 transition">
                    <MessageCircle size={15} /> WhatsApp
                  </a>
                  {selectedLead.email && (
                    <a href={`mailto:${selectedLead.email}`} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm font-medium hover:bg-muted transition">
                      <Mail size={15} /> Email
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto overflow-y-auto pb-4" style={{ maxHeight: 'calc(100vh - 160px)' }}>
        <div className="flex gap-3 min-w-max">
          {KANBAN_STAGES.map(stage => {
            const stageLeads = leads.filter(l => l.status === stage.key);
            const isDragOver = dragOverStage === stage.key;
            const isExpanded = expandedStages.has(stage.key);
            const visibleLeads = isExpanded ? stageLeads : stageLeads.slice(0, MAX_VISIBLE);
            const hasMore = stageLeads.length > MAX_VISIBLE;

            return (
              <div
                key={stage.key}
                className={`kanban-column transition-all duration-200 ${isDragOver ? 'ring-2 ring-primary/40 bg-primary/5' : ''}`}
                onDragOver={(e) => handleDragOver(e, stage.key)}
                onDrop={() => handleDrop(stage.key)}
                onDragLeave={() => setDragOverStage(null)}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                    <span className="text-sm font-semibold text-foreground">{stage.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
                    {stageLeads.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {stageLeads.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Sem leads</p>
                  )}
                  {visibleLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onClick={() => setSelectedLead(lead)} />
                  ))}
                  {hasMore && (
                    <button
                      onClick={() => toggleExpand(stage.key)}
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

const LeadCard = ({ lead, onDragStart, onDragEnd, onClick }: { lead: Lead; onDragStart: (id: string) => void; onDragEnd: () => void; onClick: () => void }) => {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(lead.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="kanban-card animate-slide-in cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="font-medium text-sm text-foreground">{lead.name}</span>
        <GripVertical size={14} className="text-muted-foreground/50 flex-shrink-0" />
      </div>
      
      <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
        <Building2 size={12} />
        <span className="text-xs">{lead.company}</span>
      </div>
      
      <div className="spc-badge mb-2">{lead.product}</div>
      
      <div className="flex items-center gap-2 mt-2">
        <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-primary transition">
          <Phone size={13} />
        </a>
        <a href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-success transition">
          <MessageCircle size={13} />
        </a>
        {lead.email && (
          <a href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-primary transition">
            <Mail size={13} />
          </a>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{lead.type}</span>
      </div>
    </div>
  );
};

export default CRMKanban;
