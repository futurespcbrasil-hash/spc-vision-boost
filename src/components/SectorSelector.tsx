import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, X, Check } from 'lucide-react';
import { useSectors } from '@/hooks/useSectors';

interface SectorSelectorProps {
  label?: string;
}

const SectorSelector = ({ label = 'Setor' }: SectorSelectorProps) => {
  const { sectors, activeSector, setActiveSector, addSector, deleteSector, currentUserId } = useSectors();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [sectorToDelete, setSectorToDelete] = useState<{ key: string; label: string } | null>(null);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const current = sectors.find(s => s.key === activeSector);
  const updateMenuPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 256;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    setMenuStyle({ top: Math.min(rect.bottom + 6, window.innerHeight - 280), left, width });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const reposition = () => updateMenuPosition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

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
          ref={triggerRef}
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition"
        >
          <span className="text-xs text-muted-foreground">{label}:</span>
          <span>{current?.label || 'Selecione um setor'}</span>
          <ChevronDown size={14} />
        </button>
        {open && menuStyle && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
            <div className="fixed z-[9999] w-64 bg-card border border-border rounded-lg shadow-xl overflow-hidden" style={menuStyle}>
              {sectors.length > 0 ? (
                <div className="py-1 max-h-60 overflow-y-auto">
                  {sectors.map(s => {
                    const isActive = s.key === activeSector;
                    const canDelete = !!currentUserId && s.userId === currentUserId;
                    return (
                      <div key={s.key} className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-muted ${isActive ? 'bg-muted/50' : ''}`}>
                        <button
                          onClick={() => { setActiveSector(s.key); setOpen(false); }}
                          className="flex-1 min-w-0 text-left flex items-center gap-2 text-foreground"
                        >
                          {isActive && <Check size={14} className="text-primary shrink-0" />}
                          <span className={`truncate ${isActive ? 'font-medium' : ''}`}>{s.label}</span>
                        </button>
                        {canDelete && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSectorToDelete({ key: s.key, label: s.label }); setOpen(false); }}
                            className="ml-2 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title={`Excluir setor ${s.label}`}
                            aria-label={`Excluir setor ${s.label}`}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="px-3 py-4 text-sm text-muted-foreground">Você ainda não criou nenhum setor. Clique abaixo para adicionar o primeiro.</p>
              )}
              <button
                onClick={() => { setShowAdd(true); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary border-t border-border hover:bg-muted transition"
              >
                <Plus size={14} /> Adicionar setor
              </button>
            </div>
          </>,
          document.body
        )}
      </div>

      {sectorToDelete && (
        <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={() => setSectorToDelete(null)}>
          <div className="bg-card rounded-xl border border-border max-w-sm w-full p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-destructive/10 p-2"><X size={18} className="text-destructive" /></div>
              <h3 className="font-bold text-foreground">Excluir setor?</h3>
            </div>
            <p className="text-sm text-muted-foreground">Deseja excluir o setor <strong className="text-foreground">{sectorToDelete.label}</strong>? Os leads cadastrados nele não serão apagados, mas deixarão de aparecer neste setor.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSectorToDelete(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition">Cancelar</button>
              <button onClick={async () => { const target = sectorToDelete; setSectorToDelete(null); await deleteSector(target.key); }} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition">Sim, excluir setor</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-card rounded-xl border border-border max-w-sm w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Criar setor</h3>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <input
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
              placeholder="Ex: SPC Brasil, Certificado Digital..."
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
