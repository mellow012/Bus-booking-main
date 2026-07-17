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
    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 flex flex-col h-full">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>{formatDateTime(typeof schedule.departureDateTime === 'string' ? schedule.departureDateTime : schedule.departureDateTime.toISOString())}</span>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SCHEDULE_STATUS_STYLES[status]}`}>
          {SCHEDULE_STATUS_LABELS[status]}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        <BusIcon className="w-3 h-3 shrink-0" />
        <span>{bus ? `${bus.licensePlate} (${bus.capacity} seats)` : 'Unassigned bus'}</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">MWK {schedule.price?.toLocaleString()} per seat</p>

      <div className="mt-auto flex items-center justify-between border-t border-gray-200 pt-3">
        <div>
          <div className="font-bold text-gray-900">{bookingsCount}</div>
          <div className="text-[10px] text-gray-500 uppercase">Bookings</div>
        </div>
        <div className="text-right">
          <div className="font-bold text-green-600">MWK {revenue.toLocaleString()}</div>
          <div className="text-[10px] text-gray-500 uppercase">Revenue</div>
        </div>
      </div>
    </div>
  );
}