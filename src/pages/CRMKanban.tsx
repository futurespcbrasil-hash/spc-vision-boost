import { useState } from 'react';
import { useAppState } from '@/context/AppContext';
import { KANBAN_STAGES, KanbanStage, Lead } from '@/data/spcData';
import { GripVertical, Phone, MessageCircle, Building2 } from 'lucide-react';

const CRMKanban = () => {
  const { leads, moveLeadToStage } = useAppState();
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<KanbanStage | null>(null);

  const handleDragStart = (leadId: string) => {
    setDraggedLead(leadId);
  };

  const handleDragOver = (e: React.DragEvent, stage: KanbanStage) => {
    e.preventDefault();
    setDragOverStage(stage);
  };

  const handleDrop = (stage: KanbanStage) => {
    if (draggedLead) {
      moveLeadToStage(draggedLead, stage);
    }
    setDraggedLead(null);
    setDragOverStage(null);
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
    setDragOverStage(null);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">CRM / Funil de Vendas</h1>
        <p className="text-muted-foreground text-sm mt-1">Arraste os leads entre as colunas para atualizar o status</p>
      </div>

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
                {stageLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const LeadCard = ({ lead, onDragStart, onDragEnd }: { lead: Lead; onDragStart: (id: string) => void; onDragEnd: () => void }) => {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(lead.id)}
      onDragEnd={onDragEnd}
      className="kanban-card animate-slide-in"
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
        <a href={`tel:${lead.phone}`} className="text-muted-foreground hover:text-primary transition">
          <Phone size={13} />
        </a>
        <a href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-success transition">
          <MessageCircle size={13} />
        </a>
        <span className="text-xs text-muted-foreground ml-auto">{lead.type}</span>
      </div>
    </div>
  );
};

export default CRMKanban;
