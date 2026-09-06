import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api';
import { clientService } from '../clientService';

const client = {
  id: 'client-001',
  coach_id: 'coach-001',
  client_type: 'individual' as const,
  display_name: 'Amahle Dlamini',
  email: 'parent@example.com',
  whatsapp: '+27 73 112 3344',
  preferred_communication: 'whatsapp' as const,
  notifications_enabled: true,
  notes: '',
  active: true,
};

describe('clientService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('loads enriched clients from the backend', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue([{ ...client, outstanding_amount: 800 }]);

    const clients = await clientService.getClients('coach-001');

    expect(get).toHaveBeenCalledWith('/clients', { coach_id: 'coach-001' });
    expect(clients[0].outstanding_amount).toBe(800);
  });

  it('maps client details to the backend create payload', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(client);
    const details = { student_name: 'Amahle Dlamini', school_name: '', parent_name: 'Zanele Dlamini' };

    await clientService.createClient(client, details);

    expect(post).toHaveBeenCalledWith('/clients', {
      ...client,
      individual_details: details,
    });
  });

  it('does not send immutable fields when updating a client', async () => {
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue(client);

    await clientService.updateClient('client-001', { ...client, notes: 'Updated' });

    expect(patch).toHaveBeenCalledWith('/clients/client-001', {
      client_type: 'individual',
      display_name: 'Amahle Dlamini',
      email: 'parent@example.com',
      whatsapp: '+27 73 112 3344',
      preferred_communication: 'whatsapp',
      notifications_enabled: true,
      notes: 'Updated',
      active: true,
    });
  });
});
