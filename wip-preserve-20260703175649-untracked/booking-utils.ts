import { Booking } from '@/types';

export const bookingMatchesSchedule = (booking: Booking, scheduleId: string): boolean => {
  if (!scheduleId) return false;
  if (booking.scheduleId === scheduleId) return true;

  const metadata = (booking as any).metadata;
  if (Array.isArray(metadata?.segments)) {
    return metadata.segments.some((segment: any) => segment?.scheduleId === scheduleId);
  }

  const relationSegments = (booking as any).segments;
  if (Array.isArray(relationSegments)) {
    return relationSegments.some((segment: any) => segment?.scheduleId === scheduleId);
  }

  return false;
};
