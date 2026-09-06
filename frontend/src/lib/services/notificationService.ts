import type { NotificationPayload } from '../types';
import { apiClient } from '../api';

export const notificationService = {
  async send(payload: NotificationPayload): Promise<void> {
    await apiClient.post('/notifications', payload);
  },
};
