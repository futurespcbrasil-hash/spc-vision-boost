import { useState } from 'react';
import { useAppState } from '@/context/AppContext';
import { KANBAN_STAGES, KanbanStage, Lead } from '@/data/spcData';
import { GripVertical, Phone, MessageCircle, Building2, Mail, X, User2 } from 'lucide-react';

const CRMKanban = () => {
  const { leads, moveLeadToStage } = useAppState();
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<KanbanStage | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const handleDragStart = (leadId: string) => setDraggedLead(leadId);
  const handleDragOver = (e: React.DragEvent, stage: KanbanStage) => { e.preventDefault(); setDragOverStage(stage); };
  const handleDrop = (stage: KanbanStage) => {
    if (draggedLead) moveLeadToStage(draggedLead, stage);
    setDraggedLead(null); setDragOverStage(null);
  };
  const handleDragEnd = () => { setDraggedLead(null); setDragOverStage(null); };

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">CRM / Funil de Vendas</h1>
        <p className="text-muted-foreground text-sm mt-1">Arraste os leads entre as colunas para atualizar o status</p>
      </div>

      {/* Lead detail modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLead(null)}>
          <div className="bg-card rounded-xl border border-border max-w-md w-full p-6 space-y-4 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><User2 size={20} /> {selectedLead.name}</h2>
              <button onClick={() => setSelectedLead(null)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Empresa:</span><span className="text-foreground">{selectedLead.company || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">CPF/CNPJ:</span><span className="text-foreground">{selectedLead.cpfCnpj || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tipo:</span><span className="text-foreground">{selectedLead.type}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Origem:</span><span className="text-foreground">{selectedLead.origin || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Produto:</span><span className="spc-badge">{selectedLead.product}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status:</span><span className="text-foreground">{KANBAN_STAGES.find(s => s.key === selectedLead.status)?.label}</span></div>
              {selectedLead.observations && <div><span className="text-muted-foreground">Obs:</span> <span className="text-foreground">{selectedLead.observations}</span></div>}
            </div>
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
          </div>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {KANBAN_STAGES.map(stage => {
          const stageLeads = leads.filter(l => l.status === stage.key);
          const isDragOver = dragOverStage === stage.key;

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
                {stageLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onClick={() => setSelectedLead(lead)} />
                ))}
              </div>
            </div>
          );
        })}
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
