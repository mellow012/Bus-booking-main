'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Booking, Bus } from '@/types';
import { bookingMatchesSchedule } from '@/lib/booking-utils';
import { BranchUpcomingTrip } from '../types';
import { formatDateTime } from '../utils/schedule';
import { Calendar, Bus as BusIcon, Route as RouteIcon } from 'lucide-react';
import Pagination from './Pagination';

interface AllBranchesOverviewProps {
  trips: BranchUpcomingTrip[];
  buses: Bus[];
  bookings: Booking[];
}

export default function AllBranchesOverview({ trips, buses, bookings }: AllBranchesOverviewProps) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const handleOpenSchedule = (scheduleId: string) => {
    router.push(`/company/admin?tab=bookings&scheduleId=${encodeURIComponent(scheduleId)}`);
  };

  const startIndex = (currentPage - 1) * pageSize;
  const pagedTrips = trips.slice(startIndex, startIndex + pageSize);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Upcoming trips across all branches</h3>
          <p className="mt-1 text-sm text-gray-500">See the nearest active and future trips across every branch.</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700 shrink-0">
          {trips.length} trip{trips.length === 1 ? '' : 's'}
        </span>
      </div>

      {trips.length === 0 ? (
        <p className="text-sm text-gray-500">No active or upcoming trips are scheduled across branches yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {pagedTrips.map(({ schedule, route, branch, departure, arrival }) => {
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
                className="w-full text-left rounded-xl border border-gray-200 bg-white p-3 hover:border-indigo-300 hover:bg-indigo-50/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm active:scale-[0.99]"
              >
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 shrink-0">
                    <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>{formatDateTime(new Date(departure).toISOString())}</span>
                  </div>
                  
                  <span className="hidden sm:inline text-xs text-gray-300">|</span>
                  
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 shrink-0">
                    <RouteIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{route.origin} → {route.destination}</span>
                  </div>

                  <span className="hidden sm:inline text-xs text-gray-300">|</span>

                  <div className="text-xs text-gray-500 shrink-0">
                    Branch: <span className="font-semibold text-gray-900">{branch.name}</span>
                  </div>

                  <span className="hidden sm:inline text-xs text-gray-300">|</span>

                  <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                    <BusIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{bus?.licensePlate || 'TBD'}</span>
                  </div>

                  <span className="hidden sm:inline text-xs text-gray-300">|</span>

                  <span className="text-xs text-gray-600 shrink-0">
                    Booked: <strong className="text-gray-900 font-semibold">{bookedSeats}</strong>
                    {capacity !== null && <span className="text-gray-400"> / {capacity} seats</span>}
                  </span>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
                  {seatsLeft !== null && (
                    <span className="text-[10px] text-gray-500 font-medium">
                      {seatsLeft} seats left
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest rounded-full px-2.5 py-0.5 ${
                      isCurrent ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {isCurrent ? 'Current' : 'Upcoming'}
                  </span>
                </div>
              </button>
            );
          })}

          <Pagination
            page={currentPage}
            totalItems={trips.length}
            pageSize={pageSize}
            onPrevious={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            onNext={() => setCurrentPage((p) => Math.min(p + 1, Math.ceil(trips.length / pageSize)))}
          />
        </div>
      )}
    </div>
  );
}