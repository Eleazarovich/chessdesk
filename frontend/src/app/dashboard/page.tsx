'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import DashboardContent from '../components/DashboardContent';

export default function DashboardPage() {
  return (
    <AppLayout activePath="/dashboard">
      <DashboardContent />
    </AppLayout>
  );
}
