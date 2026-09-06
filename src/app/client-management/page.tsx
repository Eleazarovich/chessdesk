import React from 'react';
import AppLayout from '@/components/AppLayout';
import ClientManagementContent from './components/ClientManagementContent';

export default function ClientManagementPage() {
  return (
    <AppLayout activePath="/client-management">
      <ClientManagementContent />
    </AppLayout>
  );
}