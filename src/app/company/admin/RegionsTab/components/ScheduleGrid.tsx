'use client';

import { Booking, Bus, Schedule, Route } from '@/types';
import { bookingMatchesSchedule } from '@/lib/booking-utils';
import ScheduleCard from './ScheduleCard';

interface ScheduleGridProps {
  schedules: Schedule[];
  buses: Bus[];
  bookings: Booking[];
  emptyMessage: string;
  baseUrl?: string;
  operators?: any[];
  route?: Route;
  onDeleteSuccess?: () => void;
}

export default function ScheduleGrid({ schedules, buses, bookings, emptyMessage, baseUrl, operators, route, onDeleteSuccess }: ScheduleGridProps) {
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
          
        const assignedOpId = schedule.assignedOperatorIds?.[0] || route?.assignedOperatorIds?.[0];
        const operatorName = operators?.find(op => op.id === assignedOpId || op.uid === assignedOpId)?.name;

        const seatsBooked = scheduleBookings.reduce((acc, b) => acc + (b.passengerDetails?.length || 1), 0);
        const totalSeats = bus?.capacity || 0;

        return (
          <ScheduleCard 
            key={schedule.id} 
            schedule={schedule} 
            bus={bus} 
            seatsBooked={seatsBooked}
            totalSeats={totalSeats}
            revenue={revenue} 
            baseUrl={baseUrl}
            operatorName={operatorName}
            onDeleteSuccess={onDeleteSuccess}
          />
        );
      })}
    </div>
  );
}