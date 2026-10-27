'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from '@/components/AppShell';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import AdminOverview from '@/components/AdminOverview';

export default function Home() {
  const account = useAccount();
  const router = useRouter();
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('loadOrderId')) router.replace('/request' + window.location.search);
  }, [router]);
  return account?.role === 'Admin' ? <AdminOverview /> : <AnalyticsDashboard />;
}
