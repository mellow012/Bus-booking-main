'use client';

import { useRouter } from 'next/navigation';
import { Booking, Bus } from '@/types';
import { bookingMatchesSchedule } from '@/lib/booking-utils';
import { BranchUpcomingTrip } from '../types';
import { formatDateTime } from '../utils/schedule';

interface AllBranchesOverviewProps {
  trips: BranchUpcomingTrip[];
  buses: Bus[];
  bookings: Booking[];
}

export default function AllBranchesOverview({ trips, buses, bookings }: AllBranchesOverviewProps) {
  const router = useRouter();

  const handleOpenSchedule = (scheduleId: string) => {
    router.push(`/company/admin?tab=bookings&scheduleId=${encodeURIComponent(scheduleId)}`);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Upcoming trips across all branches</h3>
          <p className="mt-1 text-sm text-gray-500">See the nearest active and future trips across every branch.</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
          {trips.length} trip{trips.length === 1 ? '' : 's'}
        </span>
      </div>

      {trips.length === 0 ? (
        <p className="text-sm text-gray-500">No active or upcoming trips are scheduled across branches yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {trips.map(({ schedule, route, branch, departure, arrival }) => {
            const isCurrent = Date.now() >= departure && Date.now() <= arrival;
            const bus = buses.find((item: Bus) => item.id === schedule.busId);
            const bookedSeats = bookings.filter((booking: Booking) => bookingMatchesSchedule(booking, schedule.id) && booking.bookingStatus !== 'cancelled').length;
            const capacity = typeof bus?.capacity === 'number' ? bus.capacity : null;
            const seatsLeft = capacity !== null ? Math.max(capacity - bookedSeats, 0) : null;

            return (
              <button
                key={schedule.id}
                type="button"
                onClick={() => handleOpenSchedule(schedule.id)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm text-left transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/40"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {route.origin} → {route.destination}
                    </p>
                    <p className="text-xs text-gray-500">{route.name || branch.name}</p>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest rounded-full px-2.5 py-1 ${
                      isCurrent ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {isCurrent ? 'Current' : 'Upcoming'}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <span className="font-medium text-gray-900">Branch:</span> {branch.name}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Departure:</span> {formatDateTime(new Date(departure).toISOString())}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Bus:</span> {bus?.licensePlate || 'TBD'}
                  </p>
                  <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                    <span>Booked: <span className="font-semibold text-gray-900">{bookedSeats}</span></span>
                    <span>Seats left: <span className="font-semibold text-emerald-600">{seatsLeft ?? '—'}</span></span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}