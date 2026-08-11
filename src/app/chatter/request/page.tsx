import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserFromServer } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import RequestFormClient from './RequestFormClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Request Group Booking | TibhukeBus',
  description: 'Submit a group booking request to platform bus operators.',
};

export default async function RequestGroupBookingPage() {
  const user = await getCurrentUserFromServer();
  if (!user) {
    redirect('/auth/login?redirectTo=/chatter/request');
  }

  const companies = await prisma.company.findMany({
    select: { id: true, name: true, logo: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <Header />
      <main className="flex-grow pt-28 pb-16">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Request Group Booking</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                Choose a company and send a group booking request
              </p>
            </div>
            <RequestFormClient companies={companies} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
