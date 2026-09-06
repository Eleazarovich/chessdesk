'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/services/authService';
import AppLayout from '@/components/AppLayout';
import DashboardContent from './components/DashboardContent';

export default function DashboardPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const user = authService?.getStoredUser();
    if (!user) {
      router?.replace('/sign-up-login-screen');
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) return null;

  return (
    <AppLayout activePath="/">
      <DashboardContent />
    </AppLayout>
  );
}