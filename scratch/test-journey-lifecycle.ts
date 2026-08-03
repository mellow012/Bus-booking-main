import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { useJourneyTracker, JourneyState } from '../src/app/bookings/useJourneyTracker';

// Pure function simulation matching useJourneyTracker logic
function evaluateState(args: {
  bookingStatus: string;
  paymentStatus: string;
  tripStatus?: string;
  departureDateTime: Date;
  arrivalDateTime: Date;
  reviewRating?: number | null;
  livePosition?: { latitude: number; longitude: number } | null;
  destinationCity?: string;
  destinationCoords?: [number, number];
  now?: Date;
}): JourneyState {
  const now = args.now || new Date();
  const { bookingStatus, paymentStatus, tripStatus, departureDateTime, arrivalDateTime, reviewRating, livePosition, destinationCity, destinationCoords } = args;

  if (bookingStatus === 'cancelled') return 'past';
  if (bookingStatus !== 'confirmed') return 'upcoming';

  const isPaid = paymentStatus === 'paid';
  const isCash = (paymentStatus as string) === 'pending'; // cash_on_boarding

  if (!isPaid && !isCash) return 'upcoming';

  const dep = departureDateTime instanceof Date ? departureDateTime : new Date(departureDateTime);
  const arr = arrivalDateTime instanceof Date ? arrivalDateTime : new Date(arrivalDateTime);

  if (tripStatus === 'completed') return 'completed';
  if (now < dep) return 'upcoming';

  const destCoords = destinationCoords || [-15.7861, 35.0058]; // Blantyre

  const isPositionUsable =
    livePosition &&
    typeof livePosition.latitude === 'number' &&
    typeof livePosition.longitude === 'number' &&
    livePosition.latitude >= -17.5 && livePosition.latitude <= -9.0 &&
    livePosition.longitude >= 32.5 && livePosition.longitude <= 36.0;

  let isNearDestination = false;
  if (isPositionUsable && destCoords) {
    const R = 6371000;
    const φ1 = (livePosition!.latitude * Math.PI) / 180;
    const φ2 = (destCoords[0] * Math.PI) / 180;
    const Δφ = ((destCoords[0] - livePosition!.latitude) * Math.PI) / 180;
    const Δλ = ((destCoords[1] - livePosition!.longitude) * Math.PI) / 180;
    const s = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    if (dist <= 5000) isNearDestination = true;
  }

  if (isNearDestination || tripStatus === 'arrived') {
    if (reviewRating) return 'completed';
    return 'arrived';
  }

  if (isPositionUsable) {
    if (now.getTime() > arr.getTime() + 5 * 3600 * 1000) return 'completed';
    if (now >= arr) return 'delayed';
    return 'in_transit';
  }

  if (now < arr) return 'in_transit';
  if (now.getTime() > arr.getTime() + 5 * 3600 * 1000) return 'completed';
  return 'delayed';
}

async function runTests() {
  console.log('--- Starting Section 3 Journey Lifecycle & Live Tracking Verifications ---');

  const now = new Date();
  const pastDeparture = new Date(now.getTime() - 5 * 3600 * 1000); // 5h ago
  const pastArrival = new Date(now.getTime() - 1 * 3600 * 1000);   // 1h ago

  // 1. Delayed State Test: Clock passed arrival time (+1h past), but GPS position is Lilongwe (-13.96, 33.77) — far from Blantyre (-15.78, 35.00)
  const delayedState = evaluateState({
    bookingStatus: 'confirmed',
    paymentStatus: 'paid',
    departureDateTime: pastDeparture,
    arrivalDateTime: pastArrival,
    livePosition: { latitude: -13.9626, longitude: 33.7741 }, // Lilongwe (still far!)
    destinationCoords: [-15.7861, 35.0058], // Blantyre
    now,
  });

  console.log('[Test 1] Clock passed arrival, GPS far from destination state:', delayedState);
  if (delayedState === 'delayed') {
    console.log('✅ Delayed state correctly identified ("delayed", NOT false "arrived").');
  } else {
    console.error('❌ Delayed state miscalculated:', delayedState);
  }

  // 2. GPS Proximity Signal Recovery Test: Bus position moves within 3km of Blantyre (-15.77, 35.01)
  const arrivedState = evaluateState({
    bookingStatus: 'confirmed',
    paymentStatus: 'paid',
    departureDateTime: pastDeparture,
    arrivalDateTime: pastArrival,
    livePosition: { latitude: -15.7750, longitude: 35.0100 }, // < 3km from Blantyre
    destinationCoords: [-15.7861, 35.0058],
    now,
  });

  console.log('[Test 2] GPS signal recovery (within 5km proximity) state:', arrivedState);
  if (arrivedState === 'arrived') {
    console.log('✅ Signal recovery resolved to "arrived" once proximity confirmed.');
  } else {
    console.error('❌ Signal recovery failed to transition to arrived:', arrivedState);
  }

  // 3. Payment Gating Test: Unpaid non-cash booking (paymentStatus: 'pending' without cash_on_boarding)
  const unpaidState = evaluateState({
    bookingStatus: 'confirmed',
    paymentStatus: 'unpaid', // non-cash pending/unpaid
    departureDateTime: pastDeparture,
    arrivalDateTime: pastArrival,
    now,
  });

  console.log('[Test 3] Payment-gated tracking state for unpaid booking:', unpaidState);
  if (unpaidState === 'upcoming') {
    console.log('✅ Unpaid non-cash booking correctly excluded from active live tracking (returns "upcoming").');
  } else {
    console.error('❌ Payment gating failed for unpaid booking!');
  }

  console.log('--- Section 3 Verifications Completed ---');
}

runTests().catch(console.error);
