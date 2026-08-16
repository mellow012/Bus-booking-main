import React from 'react';
import { Metadata } from 'next';
import { getChatterSchedule } from '@/lib/actions/chatter.actions';
import { toDate } from '@/lib/chatterHelpers';
import ChatterBookClient from './ChatterBookClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const dynamic = 'force-dynamic';

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
  const scheduleDate = toDate(schedule.travelDate);
  const description = `Join this group booking on TibhukeBus. travelDate: ${scheduleDate ? scheduleDate.toLocaleDateString() : 'TBD'}, Fare: MWK ${schedule.fare.toLocaleString()}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tibhukebus.com';
  const ogUrl = new URL(`${appUrl}/api/og`);
  ogUrl.searchParams.set('route', `${schedule.origin} to ${schedule.destination}`);
  ogUrl.searchParams.set('date', scheduleDate ? scheduleDate.toISOString() : '');
  ogUrl.searchParams.set('fare', String(schedule.fare));
  ogUrl.searchParams.set('company', schedule.busName);
  ogUrl.searchParams.set('busType', 'Group Booking');

  const ogImageUrl = ogUrl.toString();

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${appUrl}/chatter/${id}`,
      siteName: 'TibhukeBus',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ChatterBookingPage({ params }: Props) {
  const { id } = await params;
  const res = await getChatterSchedule(id);
  if (!res.success || !res.data) {
    // Provide a friendlier message depending on the underlying error.
    const errMsg = (res as any).error || '';
    const isDbError = /P1001|Can't reach database|timeout|ECONNRESET|Connect Timeout/i.test(errMsg);

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <Header />
        <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-3xl shadow-sm border border-slate-100 text-center">
          {isDbError ? (
            <>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Unable to load trip</h1>
              <p className="text-slate-500 mb-6">We're having trouble reaching our servers right now. The trip may still be available — please try again in a few minutes.</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Trip Not Found</h1>
              <p className="text-slate-500 mb-6">The group booking trip you are trying to reach does not exist or has been cancelled.</p>
            </>
          )}
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
