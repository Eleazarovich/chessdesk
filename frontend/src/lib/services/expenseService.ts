import type { Expense } from '../types';
import { apiClient } from '../api';

export const expenseService = {
  async getExpenses(coachId: string): Promise<Expense[]> {
    return apiClient.get<Expense[]>('/expenses', { coach_id: coachId });
  },

  async createExpense(data: Omit<Expense, 'id'>): Promise<Expense> {
    return apiClient.post<Expense>('/expenses', data);
  },

  async updateExpense(id: string, data: Partial<Expense>): Promise<Expense> {
    const { id: _id, coach_id: _coachId, ...updates } = data;
    return apiClient.patch<Expense>(`/expenses/${id}`, updates);
  },

  async deleteExpense(id: string): Promise<void> {
    await apiClient.delete(`/expenses/${id}`);
  },
};
