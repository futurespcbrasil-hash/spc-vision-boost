import { useState } from 'react';
import { ChevronDown, Plus, Trash2, X, Check } from 'lucide-react';
import { useSectors } from '@/hooks/useSectors';

interface SectorSelectorProps {
  label?: string;
}

const SectorSelector = ({ label = 'Setor' }: SectorSelectorProps) => {
  const { sectors, activeSector, setActiveSector, addSector, deleteSector, currentUserId } = useSectors();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const current = sectors.find(s => s.key === activeSector) || sectors[0];

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    await addSector(newLabel);
    setNewLabel('');
    setShowAdd(false);
    setOpen(false);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition"
        >
          <span className="text-xs text-muted-foreground">{label}:</span>
          <span>{current?.label || '—'}</span>
          <ChevronDown size={14} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 mt-1 z-50 w-60 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
              <div className="py-1 max-h-60 overflow-y-auto">
                {sectors.map(s => {
                  const isDefault = s.key === 'spc' || s.key === 'comercial';
                  const isActive = s.key === activeSector;
                  const canDelete = !isDefault && s.userId === currentUserId;
                  return (
                    <div key={s.key} className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-muted ${isActive ? 'bg-muted/50' : ''}`}>
                      <button
                        onClick={() => { setActiveSector(s.key); setOpen(false); }}
                        className="flex-1 text-left flex items-center gap-2 text-foreground"
                      >
                        {isActive && <Check size={14} className="text-primary" />}
                        <span className={isActive ? 'font-medium' : ''}>{s.label}</span>
                      </button>
                      {canDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir setor "${s.label}"?`)) deleteSector(s.key); }}
                          className="p-1 text-muted-foreground hover:text-destructive"
                          title="Excluir setor"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => { setShowAdd(true); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary border-t border-border hover:bg-muted transition"
              >
                <Plus size={14} /> Adicionar setor
              </button>
            </div>
          </>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-card rounded-xl border border-border max-w-sm w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Novo Setor</h3>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <input
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
              placeholder="Ex: Marketing, Pós-venda..."
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition">Cancelar</button>
              <button onClick={handleAdd} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">Criar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SectorSelector;
