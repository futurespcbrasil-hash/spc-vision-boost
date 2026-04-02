import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Lead, ScheduleEvent, KanbanStage } from '@/data/spcData';
import { supabase } from '@/integrations/supabase/client';

interface AppState {
  leads: Lead[];
  schedule: ScheduleEvent[];
  loading: boolean;
  moveLeadToStage: (leadId: string, stage: KanbanStage) => void;
  addLead: (lead: Lead) => void;
  updateLead: (lead: Lead) => void;
  deleteLead: (leadId: string) => void;
  toggleScheduleDone: (eventId: string) => void;
  addScheduleEvent: (event: ScheduleEvent) => void;
  refreshLeads: () => void;
  refreshSchedule: () => void;
}

const AppContext = createContext<AppState | null>(null);

export const useAppState = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
};

const dbToLead = (row: any): Lead => ({
  id: row.id,
  name: row.name,
  company: row.company || '',
  phone: row.phone || '',
  whatsapp: row.whatsapp || '',
  email: row.email || '',
  cpfCnpj: row.cpf_cnpj || '',
  type: row.type as 'PF' | 'PJ',
  origin: row.origin || '',
  product: row.product || '',
  status: row.status as KanbanStage,
  observations: row.observations || '',
  interactions: Array.isArray(row.interactions) ? row.interactions : [],
  createdAt: row.created_at?.split('T')[0] || '',
  address: row.address || '',
});

const dbToEvent = (row: any): ScheduleEvent => ({
  id: row.id,
  leadId: row.lead_id || '',
  leadName: row.lead_name,
  date: row.date,
  time: row.time,
  note: row.note || '',
  done: row.done,
});

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (data) setLeads(data.map(dbToLead));
  }, []);

  const fetchSchedule = useCallback(async () => {
    const { data } = await supabase.from('schedule_events').select('*').order('created_at', { ascending: false });
    if (data) setSchedule(data.map(dbToEvent));
  }, []);

  useEffect(() => {
    Promise.all([fetchLeads(), fetchSchedule()]).finally(() => setLoading(false));
  }, [fetchLeads, fetchSchedule]);

  const moveLeadToStage = async (leadId: string, stage: KanbanStage) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: stage } : l));
    await supabase.from('leads').update({ status: stage }).eq('id', leadId);
  };

  const addLead = async (lead: Lead) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('leads').insert({
      name: lead.name,
      company: lead.company,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      email: lead.email || '',
      cpf_cnpj: lead.cpfCnpj,
      type: lead.type,
      origin: lead.origin,
      product: lead.product,
      status: lead.status,
      observations: lead.observations,
      interactions: lead.interactions as any,
      user_id: user?.id,
    }).select().single();
    if (data) setLeads(prev => [dbToLead(data), ...prev]);
  };

  const updateLead = async (lead: Lead) => {
    setLeads(prev => prev.map(l => l.id === lead.id ? lead : l));
    await supabase.from('leads').update({
      name: lead.name,
      company: lead.company,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      email: lead.email || '',
      cpf_cnpj: lead.cpfCnpj,
      type: lead.type,
      origin: lead.origin,
      product: lead.product,
      status: lead.status,
      observations: lead.observations,
      interactions: lead.interactions as any,
    }).eq('id', lead.id);
  };

  const deleteLead = async (leadId: string) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));
    await supabase.from('leads').delete().eq('id', leadId);
  };

  const toggleScheduleDone = async (eventId: string) => {
    const event = schedule.find(e => e.id === eventId);
    if (!event) return;
    const newDone = !event.done;
    setSchedule(prev => prev.map(e => e.id === eventId ? { ...e, done: newDone } : e));
    await supabase.from('schedule_events').update({ done: newDone }).eq('id', eventId);
  };

  const addScheduleEvent = async (event: ScheduleEvent) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('schedule_events').insert({
      lead_id: event.leadId,
      lead_name: event.leadName,
      date: event.date,
      time: event.time,
      note: event.note,
      done: event.done,
      user_id: user?.id,
    }).select().single();
    if (data) setSchedule(prev => [dbToEvent(data), ...prev]);
  };

  return (
    <AppContext.Provider value={{
      leads, schedule, loading,
      moveLeadToStage, addLead, updateLead, deleteLead,
      toggleScheduleDone, addScheduleEvent,
      refreshLeads: fetchLeads, refreshSchedule: fetchSchedule,
    }}>
      {children}
    </AppContext.Provider>
  );
};
