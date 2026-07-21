'use client';

import { Booking, Bus, Schedule } from '@/types';
import { bookingMatchesSchedule } from '@/lib/booking-utils';
import ScheduleCard from './ScheduleCard';

interface ScheduleGridProps {
  schedules: Schedule[];
  buses: Bus[];
  bookings: Booking[];
  emptyMessage: string;
}

export default function ScheduleGrid({ schedules, buses, bookings, emptyMessage }: ScheduleGridProps) {
  if (schedules.length === 0) {
    return <div className="py-10 text-center text-sm text-gray-500">{emptyMessage}</div>;
  }

  return (
    <div className="flex flex-col gap-3 mt-4">
      {schedules.map((schedule: Schedule) => {
        const bus = buses.find((b: Bus) => b.id === schedule.busId);
        const scheduleBookings = bookings.filter((b: Booking) => bookingMatchesSchedule(b, schedule.id));
        const revenue = scheduleBookings
          .filter((b: Booking) => b.paymentStatus === 'paid')
          .reduce((acc: number, b: Booking) => acc + (b.totalAmount || 0), 0);

        return <ScheduleCard key={schedule.id} schedule={schedule} bus={bus} bookingsCount={scheduleBookings.length} revenue={revenue} />;
      })}
    </div>
  );
}