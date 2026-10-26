import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Lead, ScheduleEvent, KanbanStage } from '@/data/spcData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AppState {
  leads: Lead[];
  schedule: ScheduleEvent[];
  loading: boolean;
  moveLeadToStage: (leadId: string, stage: KanbanStage) => Promise<boolean>;
  addLead: (lead: Lead) => Promise<boolean>;
  updateLead: (lead: Lead) => Promise<boolean>;
  deleteLead: (leadId: string) => Promise<boolean>;
  toggleScheduleDone: (eventId: string) => Promise<boolean>;
  addScheduleEvent: (event: ScheduleEvent) => Promise<boolean>;
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
  userId: row.user_id || '',
  assignedTo: row.assigned_to || '',
  lastInteractionAt: row.last_interaction_at || '',
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
  funnel: row.funnel || 'spc',
  planValue: row.plan_value == null ? null : Number(row.plan_value),
  biro: row.biro || '',
});

const dbToEvent = (row: any): ScheduleEvent => ({
  id: row.id,
  userId: row.user_id || '',
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

  // Keep all open Kanban/Leads screens synchronized across profiles without a full-page reload.
  useEffect(() => {
    let timer: number | undefined;
    const channel = supabase.channel('shared-crm-leads-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => { void fetchLeads(); }, 180);
      })
      .subscribe();
    return () => {
      if (timer) window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [fetchLeads]);

  const moveLeadToStage = async (leadId: string, stage: KanbanStage): Promise<boolean> => {
    const previous = leads.find(lead => lead.id === leadId);
    if (!previous) return false;
    setLeads(current => current.map(lead => lead.id === leadId ? { ...lead, status: stage } : lead));
    try {
      const { error } = await supabase.from('leads').update({ status: stage }).eq('id', leadId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[CRM] Falha ao mover lead:', error);
      toast.error('Não foi possível mover o lead. As alterações foram revertidas.');
      setLeads(current => current.map(lead => lead.id === leadId ? previous : lead));
      return false;
    }
  };

  const addLead = async (lead: Lead): Promise<boolean> => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return false;
      const { data, error } = await supabase.from('leads').insert({
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
        user_id: user.id,
        assigned_to: lead.assignedTo || null,
        last_interaction_at: lead.lastInteractionAt || null,
        funnel: (lead as any).funnel || 'spc',
        plan_value: lead.planValue ?? null,
        biro: lead.biro || null,
      }).select().single();
      if (error || !data) {
        console.error('[CRM] Falha ao cadastrar lead:', error);
        return false;
      }
      setLeads(prev => [dbToLead(data), ...prev]);
      return true;
    } catch (error) {
      console.error('[CRM] Erro inesperado ao cadastrar lead:', error);
      return false;
    }
  };

  const updateLead = async (lead: Lead): Promise<boolean> => {
    const previous = leads.find(item => item.id === lead.id);
    setLeads(current => current.map(item => item.id === lead.id ? lead : item));
    try {
      const { error } = await supabase.from('leads').update({
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
        assigned_to: lead.assignedTo || null,
        last_interaction_at: lead.lastInteractionAt || null,
        funnel: (lead as any).funnel || 'spc',
        plan_value: lead.planValue ?? null,
        biro: lead.biro || null,
      }).eq('id', lead.id);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[CRM] Falha ao atualizar lead:', error);
      toast.error('Não foi possível salvar as alterações do lead. Confira sua conexão e tente novamente.');
      if (previous) setLeads(current => current.map(item => item.id === lead.id ? previous : item));
      return false;
    }
  };

  const deleteLead = async (leadId: string): Promise<boolean> => {
    const previous = leads.find(lead => lead.id === leadId);
    setLeads(current => current.filter(lead => lead.id !== leadId));
    try {
      const { error } = await supabase.from('leads').delete().eq('id', leadId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[CRM] Falha ao excluir lead:', error);
      toast.error('Não foi possível excluir o lead. Ele foi restaurado na lista.');
      if (previous) setLeads(current => current.some(lead => lead.id === leadId) ? current : [previous, ...current]);
      return false;
    }
  };

  const toggleScheduleDone = async (eventId: string): Promise<boolean> => {
    const event = schedule.find(item => item.id === eventId);
    if (!event) return false;
    const newDone = !event.done;
    setSchedule(current => current.map(item => item.id === eventId ? { ...item, done: newDone } : item));
    try {
      const { error } = await supabase.from('schedule_events').update({ done: newDone }).eq('id', eventId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[CRM] Falha ao atualizar compromisso:', error);
      toast.error('Não foi possível atualizar o compromisso. A alteração foi revertida.');
      setSchedule(current => current.map(item => item.id === eventId ? event : item));
      return false;
    }
  };

  const addScheduleEvent = async (event: ScheduleEvent): Promise<boolean> => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return false;
      const { data, error } = await supabase.from('schedule_events').insert({
        lead_id: event.leadId || null,
        lead_name: event.leadName,
        date: event.date,
        time: event.time,
        note: event.note,
        done: event.done,
        user_id: user.id,
      }).select().single();
      if (error || !data) {
        console.error('[CRM] Falha ao salvar compromisso:', error);
        return false;
      }
      setSchedule(prev => [dbToEvent(data), ...prev]);
      return true;
    } catch (error) {
      console.error('[CRM] Erro inesperado ao salvar compromisso:', error);
      return false;
    }
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
