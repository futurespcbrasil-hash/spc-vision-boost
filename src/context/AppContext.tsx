import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Lead, ScheduleEvent, KanbanStage, MOCK_LEADS, MOCK_SCHEDULE } from '@/data/spcData';

interface AppState {
  leads: Lead[];
  schedule: ScheduleEvent[];
  setLeads: (leads: Lead[]) => void;
  setSchedule: (schedule: ScheduleEvent[]) => void;
  moveLeadToStage: (leadId: string, stage: KanbanStage) => void;
  addLead: (lead: Lead) => void;
  toggleScheduleDone: (eventId: string) => void;
  addScheduleEvent: (event: ScheduleEvent) => void;
}

const AppContext = createContext<AppState | null>(null);

export const useAppState = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS);
  const [schedule, setSchedule] = useState<ScheduleEvent[]>(MOCK_SCHEDULE);

  const moveLeadToStage = (leadId: string, stage: KanbanStage) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: stage } : l));
  };

  const addLead = (lead: Lead) => {
    setLeads(prev => [...prev, lead]);
  };

  const toggleScheduleDone = (eventId: string) => {
    setSchedule(prev => prev.map(e => e.id === eventId ? { ...e, done: !e.done } : e));
  };

  const addScheduleEvent = (event: ScheduleEvent) => {
    setSchedule(prev => [...prev, event]);
  };

  return (
    <AppContext.Provider value={{ leads, schedule, setLeads, setSchedule, moveLeadToStage, addLead, toggleScheduleDone, addScheduleEvent }}>
      {children}
    </AppContext.Provider>
  );
};
