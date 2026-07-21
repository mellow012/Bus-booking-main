'use client';

import { Calendar, Bus as BusIcon } from 'lucide-react';
import { Bus, Schedule } from '@/types';
import { SCHEDULE_STATUS_LABELS, SCHEDULE_STATUS_STYLES, formatDateTime, getScheduleStatus } from '../utils/schedule';

interface ScheduleCardProps {
  schedule: Schedule;
  bus?: Bus;
  bookingsCount: number;
  revenue: number;
}

export default function ScheduleCard({ schedule, bus, bookingsCount, revenue }: ScheduleCardProps) {
  const status = getScheduleStatus(schedule);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors shadow-sm">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 shrink-0">
          <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>{formatDateTime(typeof schedule.departureDateTime === 'string' ? schedule.departureDateTime : schedule.departureDateTime.toISOString())}</span>
        </div>
        <span className="hidden sm:inline text-xs text-gray-300">|</span>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium shrink-0">
          <BusIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span>{bus ? `${bus.licensePlate} (${bus.capacity} seats)` : 'Unassigned bus'}</span>
        </div>
        <span className="hidden sm:inline text-xs text-gray-300">|</span>
        <span className="text-xs text-gray-600 shrink-0">
          <strong className="text-gray-900 font-semibold">{bookingsCount}</strong> Bookings
        </span>
        <span className="hidden sm:inline text-xs text-gray-300">|</span>
        <span className="text-xs font-bold text-green-600 shrink-0">
          MWK {revenue.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-3 justify-between sm:justify-end w-full sm:w-auto shrink-0">
        <span className="text-[10px] text-gray-400 font-medium">MWK {schedule.price?.toLocaleString()} / seat</span>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SCHEDULE_STATUS_STYLES[status]}`}>
          {SCHEDULE_STATUS_LABELS[status]}
        </span>
      </div>
    </div>
  );
}