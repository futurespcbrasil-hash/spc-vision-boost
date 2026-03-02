import { useAppState } from '@/context/AppContext';
import { Calendar as CalIcon, Check, Clock, Plus } from 'lucide-react';
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';

const Agenda = () => {
  const { schedule, toggleScheduleDone, addScheduleEvent } = useAppState();
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const selectedDateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : '';

  const pending = schedule.filter(e => !e.done).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const done = schedule.filter(e => e.done);

  const filteredPending = selectedDateStr
    ? pending.filter(e => e.date === selectedDateStr)
    : pending;

  // Dates that have events for highlighting
  const eventDates = schedule.filter(e => !e.done).map(e => new Date(e.date + 'T12:00:00'));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-muted-foreground text-sm mt-1">Compromissos e retornos agendados</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">
          <Plus size={16} /> Novo Compromisso
        </button>
      </div>

      {showForm && (
        <ScheduleForm onAdd={(e) => { addScheduleEvent(e); setShowForm(false); }} onCancel={() => setShowForm(false)} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        {/* Calendar */}
        <div className="stat-card flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            modifiers={{ hasEvent: eventDates }}
            modifiersStyles={{ hasEvent: { fontWeight: 'bold', textDecoration: 'underline', color: 'hsl(var(--primary))' } }}
            className="rounded-md"
          />
        </div>

        {/* Events list */}
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              📌 {selectedDateStr ? `Pendentes em ${selectedDate?.toLocaleDateString('pt-BR')}` : 'Todos Pendentes'} ({filteredPending.length})
            </h3>
            {filteredPending.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">Nenhum compromisso {selectedDateStr ? 'nesta data' : 'pendente'}.</p>
            )}
            {filteredPending.map(e => (
              <div key={e.id} className="stat-card flex items-center gap-3">
                <button onClick={() => toggleScheduleDone(e.id)} className="w-5 h-5 rounded-full border-2 border-primary flex-shrink-0 hover:bg-primary/10 transition" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{e.leadName}</div>
                  <div className="text-xs text-muted-foreground">{e.note}</div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                  <CalIcon size={12} /> {e.date}
                  <Clock size={12} /> {e.time}
                </div>
              </div>
            ))}
          </div>

          {done.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">✅ Concluídos ({done.length})</h3>
              {done.map(e => (
                <div key={e.id} className="stat-card flex items-center gap-3 opacity-50">
                  <button onClick={() => toggleScheduleDone(e.id)} className="w-5 h-5 rounded-full bg-success flex-shrink-0 flex items-center justify-center">
                    <Check size={12} className="text-success-foreground" />
                  </button>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground line-through">{e.leadName}</div>
                    <div className="text-xs text-muted-foreground">{e.note}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ScheduleForm = ({ onAdd, onCancel }: { onAdd: (e: any) => void; onCancel: () => void }) => {
  const [form, setForm] = useState({ leadName: '', date: '', time: '', note: '' });
  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ id: Date.now().toString(), leadId: '', ...form, done: false });
  };

  return (
    <form onSubmit={handleSubmit} className="stat-card space-y-3 animate-slide-in">
      <h3 className="font-semibold text-foreground">Novo Compromisso</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input className={inputClass} placeholder="Nome do lead *" required value={form.leadName} onChange={e => setForm({ ...form, leadName: e.target.value })} />
        <input className={inputClass} type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        <input className={inputClass} type="time" required value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
      </div>
      <input className={inputClass} placeholder="Nota / Observação" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition">Cancelar</button>
        <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">Salvar</button>
      </div>
    </form>
  );
};

export default Agenda;
