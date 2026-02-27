import { useState } from 'react';
import { useAppState } from '@/context/AppContext';
import { Lead, KANBAN_STAGES, KanbanStage } from '@/data/spcData';
import { Plus, Search, Phone, MessageCircle, Link2, Calendar, FileText } from 'lucide-react';

const LeadsPage = () => {
  const { leads, addLead } = useAppState();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filtered = leads.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão completa de leads</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
        >
          <Plus size={16} /> Novo Lead
        </button>
      </div>

      {showForm && <LeadForm onAdd={(lead) => { addLead(lead); setShowForm(false); }} onCancel={() => setShowForm(false)} />}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar leads..."
          value={search}
          onChange={e => setSearch(e.target.value)}
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
            {filtered.map(lead => {
              const stage = KANBAN_STAGES.find(s => s.key === lead.status);
              return (
                <tr key={lead.id} className="border-b border-border/50 hover:bg-muted/20 transition">
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
                    <div className="flex items-center gap-2">
                      <a href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-success transition" title="WhatsApp">
                        <MessageCircle size={15} />
                      </a>
                      <a href={`tel:${lead.phone}`} className="text-muted-foreground hover:text-primary transition" title="Ligar">
                        <Phone size={15} />
                      </a>
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
    name: '', company: '', phone: '', whatsapp: '', cpfCnpj: '',
    type: 'PJ' as 'PF' | 'PJ', origin: '', product: 'SPC Maxi', status: 'lead_novo' as KanbanStage,
    observations: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      ...form,
      id: Date.now().toString(),
      interactions: [],
      createdAt: new Date().toISOString().split('T')[0],
    });
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
