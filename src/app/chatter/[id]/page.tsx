import React from 'react';
import { Metadata } from 'next';
import { getChatterSchedule } from '@/lib/actions/chatter.actions';
import ChatterBookClient from './ChatterBookClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const res = await getChatterSchedule(id);
  if (!res.success || !res.data) {
    return { title: 'Trip Booking | TibhukeBus' };
  }
  const schedule = res.data;
  const title = `Book ${schedule.busName}: ${schedule.origin} to ${schedule.destination}`;
  const description = `Join this group booking on TibhukeBus. travelDate: ${new Date(schedule.travelDate).toLocaleDateString()}, Fare: MWK ${schedule.fare.toLocaleString()}`;

  const ogUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/og`);
  ogUrl.searchParams.set('route', `${schedule.origin} to ${schedule.destination}`);
  ogUrl.searchParams.set('date', schedule.travelDate.toISOString());
  ogUrl.searchParams.set('fare', String(schedule.fare));
  ogUrl.searchParams.set('company', schedule.busName);
  ogUrl.searchParams.set('busType', 'Group Booking');

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

export default async function ChatterBookingPage({ params }: Props) {
  const { id } = await params;
  const res = await getChatterSchedule(id);

  if (!res.success || !res.data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <Header />
        <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-3xl shadow-sm border border-slate-100 text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Trip Not Found</h1>
          <p className="text-slate-500 mb-6">The group booking trip you are trying to reach does not exist or has been cancelled.</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <Header />
      <main className="flex-grow pt-28 pb-16">
        <ChatterBookClient schedule={res.data} />
      </main>
      <Footer />
    </div>
  );
}
