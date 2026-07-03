'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Booking, Bus, Schedule } from '@/types';
import { bookingMatchesSchedule } from '@/lib/booking-utils';
import { formatDateTime } from '../utils/schedule';

interface CompletedSchedulesArchiveProps {
  schedules: Schedule[];
  buses: Bus[];
  bookings: Booking[];
}

export default function CompletedSchedulesArchive({ schedules, buses, bookings }: CompletedSchedulesArchiveProps) {
  const [expanded, setExpanded] = useState(false);

  if (schedules.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          Completed schedules
        </span>
        <span className="text-xs text-gray-500">{schedules.length} archived</span>
      </button>

      {expanded && (
        <div className="space-y-3 mt-3">
          {schedules.map((schedule: Schedule) => {
            const bus = buses.find((b: Bus) => b.id === schedule.busId);
            const scheduleBookings = bookings.filter((b: Booking) => bookingMatchesSchedule(b, schedule.id));
            const revenue = scheduleBookings
              .filter((b: Booking) => b.paymentStatus === 'paid')
              .reduce((acc: number, b: Booking) => acc + (b.totalAmount || 0), 0);

            return (
              <div key={schedule.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-gray-900">
                    <div className="font-semibold">{formatDateTime(schedule.departureDateTime.toISOString())}</div>
                    <div className="text-xs text-gray-500">{bus ? `${bus.licensePlate} (${bus.capacity} seats)` : 'Unassigned bus'}</div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>{scheduleBookings.length} bookings</span>
                    <span>MWK {revenue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}