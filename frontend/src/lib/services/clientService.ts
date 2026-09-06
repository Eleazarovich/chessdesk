import type { Client, ClientWithDetails, IndividualStudentDetails, SchoolDetails } from '../types';
import {
  MOCK_CLIENTS, MOCK_INDIVIDUAL_DETAILS, MOCK_SCHOOL_DETAILS,
  MOCK_INVOICES, MOCK_SESSIONS,
} from './mockData';

// BACKEND INTEGRATION POINT: Replace with real API calls to your backend

let clients = [...MOCK_CLIENTS];
let individualDetails = [...MOCK_INDIVIDUAL_DETAILS];
let schoolDetails = [...MOCK_SCHOOL_DETAILS];

function computeOutstanding(clientId: string): number {
  return MOCK_INVOICES
    .filter(inv => inv.client_id === clientId && inv.status === 'unpaid')
    .reduce((sum, inv) => sum + inv.amount, 0);
}

function getUpcomingSession(clientId: string): string | null {
  const now = new Date();
  const upcoming = MOCK_SESSIONS
    .filter(s => s.client_id === clientId && s.status === 'scheduled' && new Date(s.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (!upcoming.length) return null;
  const s = upcoming[0];
  return `${s.date} ${s.start_time}`;
}

export const clientService = {
  async getClients(coachId: string): Promise<ClientWithDetails[]> {
    await new Promise(r => setTimeout(r, 300));
    return clients
      .filter(c => c.coach_id === coachId)
      .map(c => ({
        ...c,
        individual_details: individualDetails.find(d => d.client_id === c.id),
        school_details: schoolDetails.find(d => d.client_id === c.id),
        upcoming_session: getUpcomingSession(c.id),
        outstanding_amount: computeOutstanding(c.id),
      }));
  },

  async getClient(id: string): Promise<ClientWithDetails | null> {
    await new Promise(r => setTimeout(r, 200));
    const client = clients.find(c => c.id === id);
    if (!client) return null;
    return {
      ...client,
      individual_details: individualDetails.find(d => d.client_id === id),
      school_details: schoolDetails.find(d => d.client_id === id),
      upcoming_session: getUpcomingSession(id),
      outstanding_amount: computeOutstanding(id),
    };
  },

  async createClient(
    data: Omit<Client, 'id'>,
    details?: Omit<IndividualStudentDetails, 'client_id'> | Omit<SchoolDetails, 'client_id'>
  ): Promise<Client> {
    await new Promise(r => setTimeout(r, 400));
    const id = `client-${Date.now()}`;
    const newClient: Client = { ...data, id };
    clients.push(newClient);
    if (data.client_type === 'individual' && details) {
      individualDetails.push({ ...(details as Omit<IndividualStudentDetails, 'client_id'>), client_id: id });
    } else if (data.client_type === 'school' && details) {
      schoolDetails.push({ ...(details as Omit<SchoolDetails, 'client_id'>), client_id: id });
    }
    return newClient;
  },

  async updateClient(id: string, data: Partial<Client>): Promise<Client> {
    await new Promise(r => setTimeout(r, 300));
    const idx = clients.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Client not found');
    clients[idx] = { ...clients[idx], ...data };
    return clients[idx];
  },

  async deleteClient(id: string): Promise<void> {
    await new Promise(r => setTimeout(r, 300));
    clients = clients.filter(c => c.id !== id);
    individualDetails = individualDetails.filter(d => d.client_id !== id);
    schoolDetails = schoolDetails.filter(d => d.client_id !== id);
  },
};