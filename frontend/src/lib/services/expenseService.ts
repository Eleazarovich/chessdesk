import type { Expense } from '../types';
import { MOCK_EXPENSES } from './mockData';

// BACKEND INTEGRATION POINT: Replace with real API calls to your backend

let expenses = [...MOCK_EXPENSES];

export const expenseService = {
  async getExpenses(coachId: string): Promise<Expense[]> {
    await new Promise(r => setTimeout(r, 300));
    return expenses.filter(e => e.coach_id === coachId);
  },

  async createExpense(data: Omit<Expense, 'id'>): Promise<Expense> {
    await new Promise(r => setTimeout(r, 300));
    const expense: Expense = { ...data, id: `exp-${Date.now()}` };
    expenses.push(expense);
    return expense;
  },

  async updateExpense(id: string, data: Partial<Expense>): Promise<Expense> {
    await new Promise(r => setTimeout(r, 300));
    const idx = expenses.findIndex(e => e.id === id);
    if (idx === -1) throw new Error('Expense not found');
    expenses[idx] = { ...expenses[idx], ...data };
    return expenses[idx];
  },

  async deleteExpense(id: string): Promise<void> {
    await new Promise(r => setTimeout(r, 200));
    expenses = expenses.filter(e => e.id !== id);
  },
};