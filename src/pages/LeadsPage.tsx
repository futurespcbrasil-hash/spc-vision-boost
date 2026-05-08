import { useState, useRef } from 'react';
import { useAppState } from '@/context/AppContext';
import { Lead, KANBAN_STAGES, KanbanStage } from '@/data/spcData';
import { Plus, Search, Phone, MessageCircle, Upload, X, Mail, User2, Edit3, Trash2, Save, Globe, MapPin, Loader2, UserPlus, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSectors } from '@/hooks/useSectors';
import SectorSelector from '@/components/SectorSelector';
import { useAuth } from '@/hooks/useAuth';

interface SearchedLead {
  name: string;
  company: string;
  phone: string;
  whatsapp: string;
  email: string;
  segment: string;
  address: string;
}

const LeadsPage = () => {
  const { leads: allLeads, addLead, updateLead, deleteLead } = useAppState();
  const { role, user } = useAuth();
  const { activeSector, sectors } = useSectors();
  const selectedSector = role === 'gestor' ? activeSector : 'spc';
  const sectorLabel = sectors.find(s => s.key === selectedSector)?.label || selectedSector;
  const leads = allLeads.filter(l => ((l as any).funnel || 'spc') === selectedSector);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Lead | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Internet search state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchCity, setSearchCity] = useState('');
  const [searchState, setSearchState] = useState('');
  const [searchSegment, setSearchSegment] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedLead[]>([]);
  const [searching, setSearching] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const filtered = leads.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.company.toLowerCase().includes(search.toLowerCase())
  );

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split('\n').filter(l => l.trim());
      const dataLines = lines.slice(1);
      dataLines.forEach((line, idx) => {
        const sep = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
        const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length >= 1 && cols[0]) {
          addLead({
            id: `import-${Date.now()}-${idx}`,
            name: cols[0] || '', company: cols[1] || '', phone: cols[2] || '',
            whatsapp: (cols[3] || cols[2] || '').replace(/\D/g, ''),
            cpfCnpj: cols[4] || '', type: (cols[5]?.toUpperCase() === 'PF' ? 'PF' : 'PJ') as 'PF' | 'PJ',
            origin: cols[6] || 'Importação', product: cols[7] || 'SPC Maxi',
            status: 'lead_novo', observations: cols[8] || '', interactions: [],
            createdAt: new Date().toISOString().split('T')[0], email: cols[9] || '',
            funnel: selectedSector,
          } as any);
        }
      });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEdit = (lead: Lead) => {
    setEditData({ ...lead });
    setEditMode(true);
  };

  const handleSaveEdit = () => {
    if (editData) {
      updateLead(editData);
      setSelectedLead(editData);
      setEditMode(false);
      setEditData(null);
    }
  };

  const handleDelete = (lead: Lead) => {
    if (confirm('Tem certeza que deseja excluir este lead?')) {
      deleteLead(lead.id);
      setSelectedLead(null);
    }
  };

  const handleInternetSearch = async () => {
    if (!searchState) return;
    setSearching(true);
    setSearchResults([]);
    setAddedIds(new Set());
    try {
      const { data, error } = await supabase.functions.invoke('search-leads', {
        body: { city: searchCity, state: searchState, segment: searchSegment },
      });
      if (error) throw error;
      if (data?.success && Array.isArray(data.leads)) {
        setSearchResults(data.leads);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleAddSearchedLead = (result: SearchedLead, index: number) => {
    addLead({
      id: `search-${Date.now()}-${index}`,
      name: result.name,
      company: result.company,
      phone: result.phone,
      whatsapp: result.whatsapp,
      email: result.email,
      cpfCnpj: '',
      type: 'PJ',
      origin: `Busca Internet - ${searchCity}/${searchState}`,
      product: '',
      status: 'lead_novo',
      observations: `Segmento: ${result.segment}\nEndereço: ${result.address}`,
      interactions: [],
      createdAt: new Date().toISOString().split('T')[0],
      address: result.address,
      funnel: selectedSector,
    } as any);
    setAddedIds(prev => new Set(prev).add(index));
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20";

  const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads — {sectorLabel}</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão completa de leads do setor</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {role === 'gestor' && <SectorSelector />}
          <button onClick={() => setShowSearchModal(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition">
            <Globe size={16} /> Buscar na Internet
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.txt,.xls,.xlsx,.tsv" className="hidden" onChange={handleImport} />
          <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-medium hover:bg-muted transition">
            <Upload size={16} /> Importar
          </button>
          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">
            <Plus size={16} /> Novo Lead
          </button>
        </div>
      </div>

      {showForm && <LeadForm onAdd={(lead) => { addLead({ ...lead, funnel: selectedSector } as any); setShowForm(false); }} onCancel={() => setShowForm(false)} />}

      {/* Internet Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSearchModal(false)}>
          <div className="bg-card rounded-xl border border-border max-w-3xl w-full p-6 space-y-4 animate-slide-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Globe size={20} className="text-primary" /> Buscar Leads na Internet
              </h2>
              <button onClick={() => setShowSearchModal(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cidade (opcional)</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input className={`${inputClass} pl-8`} placeholder="Ex: São Paulo" value={searchCity} onChange={e => setSearchCity(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Estado *</label>
                <select className={inputClass} value={searchState} onChange={e => setSearchState(e.target.value)}>
                  <option value="">Selecione</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Segmento (opcional)</label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input className={`${inputClass} pl-8`} placeholder="Ex: Restaurantes" value={searchSegment} onChange={e => setSearchSegment(e.target.value)} />
                </div>
              </div>
            </div>

            <button
              onClick={handleInternetSearch}
              disabled={searching || !searchState}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {searching ? <><Loader2 size={16} className="animate-spin" /> Buscando...</> : <><Search size={16} /> Buscar Leads</>}
            </button>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{searchResults.length} leads encontrados</p>
                  <p className="text-xs text-muted-foreground">Estes leads NÃO estão no seu cadastro</p>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {searchResults.map((result, idx) => {
                    const isAdded = addedIds.has(idx);
                    return (
                      <div key={idx} className={`p-3 rounded-lg border ${isAdded ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20'} space-y-1.5`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{result.company || result.name}</p>
                            <p className="text-xs text-muted-foreground">{result.segment}</p>
                          </div>
                          <button
                            onClick={() => handleAddSearchedLead(result, idx)}
                            disabled={isAdded}
                            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              isAdded
                                ? 'bg-primary/10 text-primary cursor-default'
                                : 'bg-primary text-primary-foreground hover:opacity-90'
                            }`}
                          >
                            {isAdded ? <>✓ Adicionado</> : <><UserPlus size={13} /> Adicionar</>}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Phone size={11} /> {result.phone || '—'}</span>
                          <span className="flex items-center gap-1"><MessageCircle size={11} /> {result.whatsapp || '—'}</span>
                          <span className="flex items-center gap-1"><Mail size={11} /> {result.email || '—'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={11} /> {result.address || '—'}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!searching && searchResults.length === 0 && searchCity && searchState && (
              <p className="text-center text-sm text-muted-foreground py-4">Clique em "Buscar Leads" para encontrar empresas em {searchCity}/{searchState}</p>
            )}
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
                    <button onClick={() => handleEdit(selectedLead)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition" title="Editar">
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDelete(selectedLead)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition" title="Excluir">
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
                <button onClick={() => { setSelectedLead(null); setEditMode(false); setEditData(null); }} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
              </div>
            </div>

            {editMode && editData ? (
              <div className="space-y-3">
                <div><label className="text-xs text-muted-foreground">Nome</label><input className={inputClass} value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Empresa</label><input className={inputClass} value={editData.company} onChange={e => setEditData({ ...editData, company: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground">Telefone</label><input className={inputClass} value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} /></div>
                  <div><label className="text-xs text-muted-foreground">WhatsApp</label><input className={inputClass} value={editData.whatsapp} onChange={e => setEditData({ ...editData, whatsapp: e.target.value })} /></div>
                </div>
                <div><label className="text-xs text-muted-foreground">Email</label><input className={inputClass} value={editData.email || ''} onChange={e => setEditData({ ...editData, email: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">CPF/CNPJ</label><input className={inputClass} value={editData.cpfCnpj} onChange={e => setEditData({ ...editData, cpfCnpj: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Endereço</label><input className={inputClass} value={editData.address || ''} onChange={e => setEditData({ ...editData, address: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Observações</label><textarea className={`${inputClass} min-h-[80px]`} value={editData.observations} onChange={e => setEditData({ ...editData, observations: e.target.value })} /></div>
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

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>💡 Para importar, use CSV/TXT com colunas: Nome, Empresa, Telefone, WhatsApp, CPF/CNPJ, Tipo, Origem, Produto, Observações, Email</span>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar leads..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Empresa</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Produto</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum lead cadastrado.</td></tr>
            )}
            {filtered.map(lead => {
              const stage = KANBAN_STAGES.find(s => s.key === lead.status);
              return (
                <tr key={lead.id} className="border-b border-border/50 hover:bg-muted/20 transition cursor-pointer" onClick={() => setSelectedLead(lead)}>
                  <td className="px-4 py-3 font-medium text-foreground">{lead.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.company}</td>
                  <td className="px-4 py-3"><span className="spc-badge">{lead.product}</span></td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${stage?.color}`} />
                      <span className="text-foreground text-xs">{stage?.label}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.type}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setSelectedLead(lead); handleEdit(lead); }} className="text-muted-foreground hover:text-primary transition" title="Editar">
                        <Edit3 size={15} />
                      </button>
                      <a href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-success transition" title="WhatsApp">
                        <MessageCircle size={15} />
                      </a>
                      <a href={`tel:${lead.phone}`} className="text-muted-foreground hover:text-primary transition" title="Ligar">
                        <Phone size={15} />
                      </a>
                      <button onClick={() => handleDelete(lead)} className="text-muted-foreground hover:text-destructive transition" title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const LeadForm = ({ onAdd, onCancel }: { onAdd: (lead: Lead) => void; onCancel: () => void }) => {
  const [form, setForm] = useState({
    name: '', company: '', phone: '', whatsapp: '', cpfCnpj: '', email: '',
    type: 'PJ' as 'PF' | 'PJ', origin: '', product: 'SPC Maxi', status: 'lead_novo' as KanbanStage,
    observations: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ ...form, id: Date.now().toString(), interactions: [], createdAt: new Date().toISOString().split('T')[0] });
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20";

  return (
    <form onSubmit={handleSubmit} className="stat-card space-y-3 animate-slide-in">
      <h3 className="font-semibold text-foreground">Novo Lead</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <input className={inputClass} placeholder="Nome *" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input className={inputClass} placeholder="Empresa" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
        <input className={inputClass} placeholder="Telefone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <input className={inputClass} placeholder="WhatsApp" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
        <input className={inputClass} placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input className={inputClass} placeholder="CPF/CNPJ" value={form.cpfCnpj} onChange={e => setForm({ ...form, cpfCnpj: e.target.value })} />
        <select className={inputClass} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'PF' | 'PJ' })}>
          <option value="PJ">Pessoa Jurídica</option>
          <option value="PF">Pessoa Física</option>
        </select>
        <input className={inputClass} placeholder="Origem do lead" value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} />
        <select className={inputClass} value={form.product} onChange={e => setForm({ ...form, product: e.target.value })}>
          <option value="SPC Maxi">SPC Maxi</option>
          <option value="SPC Relatório Completo PJ">SPC Relatório Completo PJ</option>
          <option value="SPC Positivo Avançado PJ">SPC Positivo Avançado PJ</option>
        </select>
      </div>
      <textarea className={`${inputClass} resize-none`} placeholder="Observações" rows={2} value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition">Cancelar</button>
        <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">Salvar Lead</button>
      </div>
    </form>
  );
};

export default LeadsPage;
