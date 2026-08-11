import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserFromServer } from '@/lib/auth-utils';
import { getRepChatterSchedules } from '@/lib/actions/chatter.actions';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MySchedulesClient from './MySchedulesClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My Schedules | TibhukeBus',
  description: 'Manage your active group booking schedules and requests.',
};

export default async function MySchedulesPage() {
  const user = await getCurrentUserFromServer();
  if (!user) {
    redirect('/auth/login?redirectTo=/chatter/my-schedules');
  }

  const res = await getRepChatterSchedules();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <Header />

      {/* Main content area */}
      <main className="flex-grow pt-28 pb-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-gray-100">
            <MySchedulesClient
              initialSchedules={(res.success ? res.data?.schedules || [] : []) as any}
              initialRequests={(res.success ? res.data?.requests || [] : []) as any}
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
