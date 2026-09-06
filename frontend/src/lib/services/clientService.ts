import type { Client, ClientWithDetails, IndividualStudentDetails, SchoolDetails } from '../types';
import { ApiError, apiClient } from '../api';

export const clientService = {
  async getClients(coachId: string): Promise<ClientWithDetails[]> {
    return apiClient.get<ClientWithDetails[]>('/clients', { coach_id: coachId });
  },

  async getClient(id: string): Promise<ClientWithDetails | null> {
    try {
      return await apiClient.get<ClientWithDetails>(`/clients/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async createClient(
    data: Omit<Client, 'id'>,
    details?: Omit<IndividualStudentDetails, 'client_id'> | Omit<SchoolDetails, 'client_id'>
  ): Promise<Client> {
    const detailKey = data.client_type === 'individual' ? 'individual_details' : 'school_details';
    return apiClient.post<Client>('/clients', {
      ...data,
      [detailKey]: details,
    });
  },

  async updateClient(id: string, data: Partial<Client>): Promise<Client> {
    const { id: _id, coach_id: _coachId, ...updates } = data;
    return apiClient.patch<Client>(`/clients/${id}`, updates);
  },

  async deleteClient(id: string): Promise<void> {
    await apiClient.delete(`/clients/${id}`);
  },
};
