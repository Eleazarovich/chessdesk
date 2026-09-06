import { describe, it, expect } from 'vitest';
import { clientService } from '../clientService';

describe('clientService', () => {
  describe('getClients', () => {
    it('returns clients for the given coach', async () => {
      const clients = await clientService?.getClients('coach-001');
      expect(clients?.length)?.toBeGreaterThan(0);
      clients?.forEach(c => expect(c?.coach_id)?.toBe('coach-001'));
    });

    it('includes individual_details for individual clients', async () => {
      const clients = await clientService?.getClients('coach-001');
      const individuals = clients?.filter(c => c?.client_type === 'individual');
      individuals?.forEach(c => {
        expect(c?.individual_details)?.toBeDefined();
      });
    });

    it('includes school_details for school clients', async () => {
      const clients = await clientService?.getClients('coach-001');
      const schools = clients?.filter(c => c?.client_type === 'school');
      schools?.forEach(c => {
        expect(c?.school_details)?.toBeDefined();
      });
    });

    it('includes outstanding_amount for each client', async () => {
      const clients = await clientService?.getClients('coach-001');
      clients?.forEach(c => {
        expect(typeof c?.outstanding_amount)?.toBe('number');
        expect(c?.outstanding_amount)?.toBeGreaterThanOrEqual(0);
      });
    });

    it('outstanding_amount for client-001 matches unpaid invoices', async () => {
      const clients = await clientService?.getClients('coach-001');
      const client001 = clients?.find(c => c?.id === 'client-001');
      // inv-001 is unpaid for client-001: R800
      expect(client001?.outstanding_amount)?.toBe(800);
    });

    it('outstanding_amount is 0 for clients with all invoices paid', async () => {
      const clients = await clientService?.getClients('coach-001');
      const client002 = clients?.find(c => c?.id === 'client-002');
      expect(client002?.outstanding_amount)?.toBe(0);
    });
  });

  describe('createClient', () => {
    it('creates an individual student with details', async () => {
      const client = await clientService?.createClient(
        {
          coach_id: 'coach-001',
          client_type: 'individual',
          display_name: 'Test Student',
          email: 'test@test.co.za',
          whatsapp: '+27 82 000 0000',
          preferred_communication: 'whatsapp',
          notifications_enabled: true,
          notes: '',
          active: true,
        },
        { student_name: 'Test Student', school_name: '', parent_name: 'Test Parent' }
      );
      expect(client?.id)?.toBeTruthy();
      expect(client?.client_type)?.toBe('individual');
      expect(client?.display_name)?.toBe('Test Student');
    });

    it('creates a school client with details', async () => {
      const client = await clientService?.createClient(
        {
          coach_id: 'coach-001',
          client_type: 'school',
          display_name: 'Test School',
          email: 'admin@testschool.co.za',
          whatsapp: '+27 11 000 0000',
          preferred_communication: 'email',
          notifications_enabled: false,
          notes: '',
          active: true,
        },
        { school_name: 'Test School', contact_person: 'Mr. Test', learner_range: '10-20' }
      );
      expect(client?.client_type)?.toBe('school');
      expect(client?.display_name)?.toBe('Test School');
    });
  });

  describe('deleteClient', () => {
    it('removes client from list after deletion', async () => {
      const before = await clientService?.getClients('coach-001');
      const target = before?.[before?.length - 1];
      await clientService?.deleteClient(target?.id);
      const after = await clientService?.getClients('coach-001');
      expect(after?.find(c => c?.id === target?.id))?.toBeUndefined();
    });
  });
});