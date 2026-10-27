import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, StickyNote, Check, RotateCcw, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { useThemePreference } from '@/components/ThemePreferenceProvider';

const CORES = [
  { value: 'amarelo', bg: 'bg-yellow-200', border: 'border-yellow-300', label: 'Amarelo' },
  { value: 'rosa', bg: 'bg-pink-200', border: 'border-pink-300', label: 'Rosa' },
  { value: 'verde', bg: 'bg-green-200', border: 'border-green-300', label: 'Verde' },
  { value: 'azul', bg: 'bg-blue-200', border: 'border-blue-300', label: 'Azul' },
  { value: 'roxo', bg: 'bg-purple-200', border: 'border-purple-300', label: 'Roxo' },
  { value: 'laranja', bg: 'bg-orange-200', border: 'border-orange-300', label: 'Laranja' },
];

const corClasses = (c: string) => CORES.find((x) => x.value === c) ?? CORES[0];
const isCustomHex = (c: string) => /^#[0-9a-f]{6}$/i.test(c || '');
const corHex = (c: string) => isCustomHex(c) ? c : ({ amarelo: '#FACC15', rosa: '#F472B6', verde: '#4ADE80', azul: '#60A5FA', roxo: '#A78BFA', laranja: '#FB923C' } as Record<string, string>)[c] || '#FACC15';
const colorText = (c: string) => {
  if (!isCustomHex(c)) return '#1f2937';
  const hex = c.slice(1);
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 155 ? '#1f2937' : '#f9fafb';
};

const rotations = ['-rotate-2', '-rotate-1', 'rotate-0', 'rotate-1', 'rotate-2'];
const rotFor = (id: string) => rotations[id.charCodeAt(0) % rotations.length];

const fmtDate = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '';

const emptyForm = { titulo: '', conteudo: '', cor: 'amarelo', data_lembrete: '', concluido: false };

const Notas = () => {
  const { theme } = useThemePreference();
  const { user } = useAuth();
  const draftKey = user ? `crm_note_draft_${user.id}` : undefined;
  const readDraft = () => {
    try { const saved = draftKey ? localStorage.getItem(draftKey) : null; return saved ? { ...emptyForm, ...JSON.parse(saved) } : emptyForm; } catch { return emptyForm; }
  };
  const [notas, setNotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'pendentes' | 'concluidos' | 'todos'>('pendentes');
  const [open, setOpen] = useState(() => { try { return !!(user && localStorage.getItem(`crm_note_draft_${user.id}`)); } catch { return false; } });
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(readDraft);

  useEffect(() => {
    if (!draftKey || editing) return;
    try {
      const hasContent = !!(form.titulo?.trim() || form.conteudo?.trim() || form.data_lembrete || form.concluido || form.cor !== emptyForm.cor);
      if (hasContent) localStorage.setItem(draftKey, JSON.stringify(form));
      else localStorage.removeItem(draftKey);
    } catch { /* armazenamento indisponível */ }
  }, [form, draftKey, editing]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('notas').select('*').order('created_at', { ascending: false });
    setNotas(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(readDraft()); setOpen(true); };
  const openEdit = (n: any) => {
    setEditing(n);
    setForm({ ...n, data_lembrete: n.data_lembrete ?? '' });
    setOpen(true);
  };

  const save = async () => {
    if (!form.titulo?.trim()) { toast.error('Título é obrigatório'); return; }
    if (!user) return;
    const payload = {
      titulo: form.titulo,
      conteudo: form.conteudo || null,
      cor: form.cor,
      data_lembrete: form.data_lembrete || null,
      concluido: !!form.concluido,
      user_id: user.id,
    };
    const { error } = editing
      ? await supabase.from('notas').update(payload).eq('id', editing.id)
      : await supabase.from('notas').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? 'Post-it atualizado' : 'Post-it criado');
    setOpen(false);
    try { if (draftKey) localStorage.removeItem(draftKey); } catch { /* armazenamento indisponível */ }
    setForm(emptyForm);
    load();
  };

  const toggleConcluido = async (n: any) => {
    const { error } = await supabase.from('notas').update({ concluido: !n.concluido }).eq('id', n.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Remover este post-it?')) return;
    const { error } = await supabase.from('notas').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Post-it removido');
    load();
  };

  const filtradas = notas.filter((n) =>
    filtro === 'pendentes' ? !n.concluido : filtro === 'concluidos' ? n.concluido : true
  );

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><StickyNote className="text-primary" /> Notas / Post-its</h1>
          <p className="text-muted-foreground text-sm">Anotações rápidas e lembretes vinculados ao sino de notificações</p>
        </div>
        <div className="flex gap-2 bg-muted rounded-lg p-1">
          {(['pendentes', 'concluidos', 'todos'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 text-xs rounded-md capitalize transition ${filtro === f ? 'bg-background shadow font-semibold' : 'text-muted-foreground'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-10">Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <StickyNote className="mx-auto mb-3 opacity-50" size={40} />
          Nenhum post-it {filtro === 'concluidos' ? 'concluído' : 'pendente'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filtradas.map((n) => {
            const c = corClasses(n.cor);
            const vencido = n.data_lembrete && n.data_lembrete <= hoje && !n.concluido;
            return (
              <div
                key={n.id}
                className={`${theme === 'transparent' ? 'bg-transparent' : c.bg} ${theme === 'transparent' ? '' : c.border} ${rotFor(n.id)} border-l-4 p-4 rounded-sm shadow-md hover:shadow-xl hover:rotate-0 transition-all duration-200 min-h-[200px] flex flex-col ${theme === 'transparent' ? 'text-foreground' : 'text-gray-800'} ${n.concluido ? 'opacity-60' : ''}`}
                style={{ fontFamily: "'Caveat', 'Comic Sans MS', cursive", ...(theme === 'transparent' ? { backgroundColor: 'transparent', borderColor: corHex(n.cor), color: 'var(--foreground)' } : isCustomHex(n.cor) ? { backgroundColor: n.cor, borderColor: n.cor, color: colorText(n.cor) } : {}) }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className={`font-bold text-lg leading-tight ${n.concluido ? 'line-through' : ''}`}>{n.titulo}</h3>
                </div>
                <p className={`text-base flex-1 whitespace-pre-wrap ${n.concluido ? 'line-through' : ''}`}>{n.conteudo}</p>
                {n.data_lembrete && (
                  <div className={`flex items-center gap-1 text-xs mt-2 font-semibold ${vencido ? 'text-red-700' : 'text-gray-700'}`}>
                    <Bell size={12} /> {fmtDate(n.data_lembrete)} {vencido && '· Vencido!'}
                  </div>
                )}
                <div className="flex items-center justify-end gap-1 mt-2 border-t border-black/10 pt-2">
                  <button onClick={() => toggleConcluido(n)} title={n.concluido ? 'Reabrir' : 'Concluir'} className="p-1.5 hover:bg-black/10 rounded">
                    {n.concluido ? <RotateCcw size={14} /> : <Check size={14} />}
                  </button>
                  <button onClick={() => openEdit(n)} title="Editar" className="p-1.5 hover:bg-black/10 rounded"><Pencil size={14} /></button>
                  <button onClick={() => remove(n.id)} title="Remover" className="p-1.5 hover:bg-black/10 rounded text-red-700"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={openNew}
        className="fixed bottom-20 md:bottom-6 right-6 z-30 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-14 w-14 shadow-lg flex items-center justify-center transition"
        title="Novo Post-it"
      >
        <Plus size={26} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Post-it' : 'Novo Post-it'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div>
              <Label>Conteúdo</Label>
              <Textarea rows={4} value={form.conteudo ?? ''} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex items-center gap-3 flex-wrap rounded-lg border border-border p-3">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="color" aria-label="Escolher qualquer cor para o post-it" value={isCustomHex(form.cor) ? form.cor : '#fef08a'} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="h-10 w-12 cursor-pointer rounded border border-border bg-background p-1" />
                  <span>Gerar / escolher cor</span>
                </label>
                <span className="text-xs text-muted-foreground">{isCustomHex(form.cor) ? form.cor.toUpperCase() : 'Escolha uma cor personalizada ou use uma cor rápida:'}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {CORES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm({ ...form, cor: c.value })}
                    className={`w-9 h-9 rounded ${c.bg} ${c.border} border-2 ${form.cor === c.value ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>Data do Lembrete (opcional)</Label>
              <Input type="date" value={form.data_lembrete ?? ''} onChange={(e) => setForm({ ...form, data_lembrete: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); if (!editing) { try { if (draftKey) localStorage.removeItem(draftKey); } catch { /* armazenamento indisponível */ } setForm(emptyForm); } }}>Cancelar</Button>
            <Button onClick={save}>{editing ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Notas;
