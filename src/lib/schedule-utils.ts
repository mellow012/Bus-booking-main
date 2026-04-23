import { Schedule, Route } from "@prisma/client";

export type TripStatus = 
  | 'scheduled' 
  | 'boarding' 
  | 'en_route' 
  | 'arrived' 
  | 'completed' 
  | 'cancelled' 
  | 'delayed';

/**
 * Calculates the current trip status based on time and manual overrides
 */
export function calculateTripStatus(schedule: any): TripStatus {
  if (schedule.status === 'cancelled') return 'cancelled';
  if (schedule.isCompleted) return 'completed';
  if (schedule.tripStatus === 'delayed') return 'delayed';

  const now = new Date();
  const departure = new Date(schedule.departureDateTime);
  const arrival = new Date(schedule.arrivalDateTime);

  // Manual tripStatus from database takes precedence if set to specific values
  // We check for these specifically to allow manual conductor overrides
  const manualStatus = schedule.tripStatus as string;
  if (['boarding', 'en_route', 'arrived'].includes(manualStatus)) {
    return manualStatus as TripStatus;
  }

  // Automatic calculation based on time
  if (now > arrival) return 'completed';
  if (now >= departure && now <= arrival) return 'en_route';
  
  // Boarding starts 2 hours before departure as requested by user
  const boardingStart = new Date(departure.getTime() - 2 * 60 * 60 * 1000);
  if (now >= boardingStart && now < departure) return 'boarding';

  return 'scheduled';
}

/**
 * Checks if a specific segment of a route is bookable.
 * A segment is bookable if the bus hasn't departed the origin stop yet.
 */
export function isSegmentBookable(schedule: any, originStopId?: string): boolean {
  const status = calculateTripStatus(schedule);
  
  // If the trip hasn't started yet, it's bookable
  if (status === 'scheduled' || status === 'boarding') return true;
  
  // If completed or cancelled, it's not bookable
  if (status === 'completed' || status === 'cancelled') return false;

  // If en_route, check if the bus has passed the requested origin stop
  if (status === 'en_route') {
    // If no origin stop is specified (e.g. main origin), and trip has started, it's not bookable
    if (!originStopId) return false; 
    
    const stops = (schedule.route?.stops as any[]) || [];
    if (stops.length === 0) return false; // Can't determine segments without stops data

    // If currentStopId is not set, we assume it's at the beginning (still bookable if origin is ahead)
    if (!schedule.currentStopId) return true;

    const currentIndex = stops.findIndex((s: any) => s.id === schedule.currentStopId);
    const originIndex = stops.findIndex((s: any) => s.id === originStopId);
    
    // If we can't find either stop in the route, default to safe (not bookable)
    if (currentIndex === -1 || originIndex === -1) return false;

    // Bookable only if the origin stop is strictly after the bus's current stop
    return originIndex > currentIndex;
  }

  return false;
}

/**
 * Enhanced status for UI display
 */
export function getStatusDisplay(status: TripStatus) {
  switch (status) {
    case 'scheduled': return { label: 'Scheduled', color: 'bg-blue-100 text-blue-700' };
    case 'boarding':  return { label: 'Boarding',  color: 'bg-amber-100 text-amber-700' };
    case 'en_route':  return { label: 'En Route',  color: 'bg-emerald-100 text-emerald-700' };
    case 'arrived':   return { label: 'Arrived',   color: 'bg-indigo-100 text-indigo-700' };
    case 'completed': return { label: 'Completed', color: 'bg-gray-100 text-gray-700' };
    case 'cancelled': return { label: 'Cancelled', color: 'bg-red-100 text-red-700' };
    case 'delayed':   return { label: 'Delayed',   color: 'bg-orange-100 text-orange-700' };
    default:          return { label: 'Unknown',   color: 'bg-slate-100 text-slate-700' };
  }
}
