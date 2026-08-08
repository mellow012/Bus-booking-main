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

export type DerivedDisplayStatus = 'awaiting_payment' | 'reserved_cash' | 'confirmed' | 'in_transit' | 'delayed' | 'completed' | 'payment_failed' | 'expired' | 'cancelled' | 'flagged_for_review' | 'anomaly';

export function deriveBookingStatus({
  bookingStatus,
  paymentStatus,
  paymentMethod,
  tripStatus,
  departureTime,
  arrivalTime
}: {
  bookingStatus: string;
  paymentStatus: string;
  paymentMethod?: string;
  tripStatus?: string;
  departureTime?: Date | string | null;
  arrivalTime?: Date | string | null;
}): DerivedDisplayStatus {
  const isCash = paymentMethod === 'cash_on_boarding' || paymentMethod === 'cash';
  let baseStatus: DerivedDisplayStatus;

  if (bookingStatus === 'pending' && paymentStatus === 'pending') {
    baseStatus = 'awaiting_payment';
  } else if (bookingStatus === 'confirmed' && paymentStatus === 'paid') {
    baseStatus = 'confirmed';
  } else if (bookingStatus === 'confirmed' && paymentStatus === 'pending') {
    if (isCash) {
      baseStatus = 'reserved_cash';
    } else {
      console.warn(`Anomaly: confirmed booking with pending payment and non-cash method (${paymentMethod})`);
      baseStatus = 'anomaly';
    }
  } else if (bookingStatus === 'payment_failed' && paymentStatus === 'failed') {
    baseStatus = 'payment_failed';
  } else if (bookingStatus === 'expired' && paymentStatus === 'pending') {
    baseStatus = 'expired';
  } else if (bookingStatus === 'expired' && paymentStatus === 'paid') {
    baseStatus = 'flagged_for_review';
  } else if (bookingStatus === 'cancelled') {
    baseStatus = 'cancelled';
  } else if (bookingStatus === 'completed' && (paymentStatus === 'paid' || isCash)) {
    baseStatus = 'completed';
  } else {
    console.warn(`Anomaly: unhandled bookingStatus/paymentStatus pair: ${bookingStatus} / ${paymentStatus}`);
    baseStatus = 'anomaly';
  }

  // Journey-tracker states overrides
  const isActive = baseStatus === 'confirmed' || baseStatus === 'reserved_cash' || baseStatus === 'completed';
  
  if (isActive) {
    if (tripStatus === 'completed' || tripStatus === 'arrived') {
      return 'completed';
    }

    if (departureTime && arrivalTime) {
      const now = new Date();
      const dep = departureTime instanceof Date ? departureTime : new Date(departureTime);
      const arr = arrivalTime instanceof Date ? arrivalTime : new Date(arrivalTime);
      
      if (tripStatus === 'in_transit') {
        return 'in_transit';
      } else if (now >= arr && tripStatus !== 'completed') {
        if (now.getTime() > arr.getTime() + 5 * 60 * 60 * 1000) {
          return 'completed';
        }
        return 'delayed';
      } else if (now >= dep && now < arr) {
        return 'in_transit';
      }
    }
  }

  return baseStatus;
}

export function getDisplayStatusUI(status: DerivedDisplayStatus): { label: string; colorClass: string; isPulsing: boolean } {
  switch (status) {
    case 'awaiting_payment': return { label: 'Awaiting Payment', colorClass: 'bg-amber-100 text-amber-800 border-amber-200', isPulsing: false };
    case 'reserved_cash': return { label: 'Reserved (Cash)', colorClass: 'bg-gray-100 text-gray-800 border-gray-200', isPulsing: false };
    case 'confirmed': return { label: 'Confirmed', colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-200', isPulsing: false };
    case 'in_transit': return { label: 'In Transit', colorClass: 'bg-brand-50 text-brand-700 border-brand-200', isPulsing: true };
    case 'delayed': return { label: 'Delayed', colorClass: 'bg-amber-50 text-amber-700 border-amber-200', isPulsing: true };
    case 'completed': return { label: 'Completed', colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', isPulsing: false };
    case 'payment_failed': return { label: 'Payment Failed', colorClass: 'bg-red-100 text-red-800 border-red-200', isPulsing: false };
    case 'expired': return { label: 'Expired', colorClass: 'bg-gray-100 text-gray-800 border-gray-200', isPulsing: false };
    case 'cancelled': return { label: 'Cancelled', colorClass: 'bg-red-100 text-red-800 border-red-200', isPulsing: false };
    case 'flagged_for_review': return { label: 'Review Needed', colorClass: 'bg-orange-100 text-orange-800 border-orange-200', isPulsing: false };
    case 'anomaly': return { label: 'Unknown', colorClass: 'bg-gray-100 text-gray-800 border-gray-200', isPulsing: false };
    default: return { label: 'Unknown', colorClass: 'bg-gray-100 text-gray-800 border-gray-200', isPulsing: false };
  }
}
