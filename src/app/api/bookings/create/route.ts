// app/api/bookings/create/route.ts
//
// PAY-2: Payment amounts MUST be calculated server-side.
//
// SEGMENT PRICING (added):
//   Operators can set per-segment prices on a schedule via:
//     schedule.segmentPrices: { [key: `${originStopId}:${destinationStopId}`]: number }
//
//   Lookup order:
//     1. Exact key match in segmentPrices  → use operator-set price
//     2. No match                          → proportional fallback:
//                                            (segmentStopCount / totalStopCount) × fullPrice
//     3. Cannot calculate proportion       → use fullPrice (full trip, or truly no stops set)
//
//   The segment stop IDs passed by the client are trusted for PRICING LOOKUP ONLY.
//   The server never accepts a price value from the client.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

interface PassengerDetail {
  firstName:            string;
  lastName:             string;
  age?:                 number;
  gender?:              'male' | 'female' | 'other';
  seatNumber:           string;
  ticketType?:          'adult' | 'child' | 'senior';
  phone?:               string;
  originStopId?:        string;
  destinationStopId?:   string;
  originStopName?:      string;
  destinationStopName?: string;
}

interface CreateBookingRequest {
  scheduleId:       string;
  routeId:          string;
  companyId:        string;
  seatNumbers:      string[];
  passengerDetails: PassengerDetail[];
  // Optional: segment stop IDs for pricing lookup.
  // These are used ONLY to look up the price server-side — never trusted as a price value.
  originStopId?:      string;
  destinationStopId?: string;
}

/** Generate a short human-readable booking reference, e.g. BK-A3F9X2 */
function generateBookingReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = 'BK-';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

// ─── Stop index helpers ───────────────────────────────────────────────────────

interface RouteStop { id: string; name: string; }

/**
 * Build a flat ordered stop list from a route document.
 * Includes the route origin as index 0 and destination as the last entry,
 * with any intermediate stops in between.
 */
function buildStopList(routeData: any): RouteStop[] {
  const stops: RouteStop[] = [];

  if (routeData?.origin) {
    stops.push({ id: '__origin__', name: routeData.origin });
  }

  if (Array.isArray(routeData?.stops)) {
    for (const s of routeData.stops) {
      if (s?.id && s?.name) stops.push({ id: s.id, name: s.name });
    }
  }

  if (routeData?.destination) {
    stops.push({ id: '__destination__', name: routeData.destination });
  }

  return stops;
}

/**
 * Calculate the proportional fare for a segment.
 *
 * segmentStops = number of stop-intervals traversed  (e.g. stop[1]→stop[3] = 2 intervals)
 * totalStops   = total intervals on the full route   (stops.length - 1)
 *
 * Returns null if the stop IDs cannot be found in the list (so caller can fall back).
 */
function proportionalFare(
  fullPrice: number,
  stopList:  RouteStop[],
  originId:  string,
  destId:    string,
): number | null {
  const originIdx = stopList.findIndex(s => s.id === originId);
  const destIdx   = stopList.findIndex(s => s.id === destId);

  if (originIdx === -1 || destIdx === -1) return null;
  if (destIdx <= originIdx)               return null;

  const totalIntervals   = stopList.length - 1;
  const segmentIntervals = destIdx - originIdx;

  if (totalIntervals <= 0) return null;

  // Round to nearest 50 MWK (standard rounding for Malawi bus fares)
  const raw     = (segmentIntervals / totalIntervals) * fullPrice;
  const rounded = Math.round(raw / 50) * 50;

  // Never go below MWK 50
  return Math.max(50, rounded);
}

export async function POST(req: NextRequest) {
  try {
    // ── Authenticate ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.slice(7);
    let decodedToken;
    try {
      decodedToken = await getAdminAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const userId = decodedToken.uid;

    // ── Fetch user profile ────────────────────────────────────────────────────
    const userSnap = await adminDb.collection('users').doc(userId).get();
    const userData = userSnap.data();

    // ── Parse request body ────────────────────────────────────────────────────
    let body: CreateBookingRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      scheduleId, routeId, companyId,
      seatNumbers, passengerDetails,
      originStopId, destinationStopId,
    } = body;

    if (!scheduleId || !routeId || !companyId) {
      return NextResponse.json(
        { error: 'scheduleId, routeId, and companyId are required' },
        { status: 400 },
      );
    }

    if (!seatNumbers?.length || !passengerDetails?.length) {
      return NextResponse.json(
        { error: 'seatNumbers and passengerDetails are required' },
        { status: 400 },
      );
    }

    if (seatNumbers.length !== passengerDetails.length) {
      return NextResponse.json(
        { error: 'seatNumbers and passengerDetails must have the same length' },
        { status: 400 },
      );
    }

    const passengerCount = seatNumbers.length;

    // ── Read schedule ─────────────────────────────────────────────────────────
    let scheduleData: FirebaseFirestore.DocumentData | undefined;
    let scheduleRef:  FirebaseFirestore.DocumentReference | undefined;

    const topLevelRef  = adminDb.collection('schedules').doc(scheduleId);
    const topLevelSnap = await topLevelRef.get();

    if (topLevelSnap.exists) {
      scheduleData = topLevelSnap.data();
      scheduleRef  = topLevelRef;
    } else {
      const nestedRef  = adminDb
        .collection('companies').doc(companyId)
        .collection('routes').doc(routeId)
        .collection('schedules').doc(scheduleId);
      const nestedSnap = await nestedRef.get();
      if (nestedSnap.exists) {
        scheduleData = nestedSnap.data();
        scheduleRef  = nestedRef;
      }
    }

    if (!scheduleData || !scheduleRef) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // ── Validate availability ─────────────────────────────────────────────────
    if (scheduleData.status !== 'active') {
      return NextResponse.json(
        { error: 'This schedule is no longer available for booking' },
        { status: 409 },
      );
    }

    if ((scheduleData.availableSeats ?? 0) < passengerCount) {
      return NextResponse.json(
        { error: `Only ${scheduleData.availableSeats} seat(s) remaining` },
        { status: 409 },
      );
    }

    // ── Read route ────────────────────────────────────────────────────────────
    const routeRef  = adminDb.collection('routes').doc(routeId);
    const routeSnap = await routeRef.get();
    const routeData = routeSnap.data();

    // ── Calculate fare SERVER-SIDE ────────────────────────────────────────────
    // Full trip base fare — always required and trusted from Firestore
    const fullFare = scheduleData.baseFare ?? scheduleData.price ?? scheduleData.fare;
    if (typeof fullFare !== 'number' || fullFare <= 0) {
      console.error('[bookings/create] Schedule missing valid baseFare:', scheduleId, fullFare);
      return NextResponse.json(
        { error: 'Schedule pricing is unavailable — please contact support' },
        { status: 500 },
      );
    }

    // Determine whether this is a segment booking
    const isSegment = !!(
      originStopId &&
      destinationStopId &&
      originStopId      !== '__origin__'      ||
      destinationStopId !== '__destination__'
    ) && !(
      // Not a segment if it spans the full route
      originStopId      === '__origin__' &&
      destinationStopId === '__destination__'
    );

    let baseFare = fullFare; // default: full trip
    let fareSource: 'full_trip' | 'operator_set' | 'proportional_fallback' = 'full_trip';

    if (isSegment && originStopId && destinationStopId) {
      const segmentKey = `${originStopId}:${destinationStopId}`;

      // 1. Check operator-set segment price
      const segmentPrices: Record<string, number> = scheduleData.segmentPrices ?? {};
      const operatorPrice = segmentPrices[segmentKey];

      if (typeof operatorPrice === 'number' && operatorPrice > 0) {
        baseFare    = operatorPrice;
        fareSource  = 'operator_set';
      } else {
        // 2. Proportional fallback
        const stopList   = buildStopList(routeData ?? scheduleData);
        const calculated = proportionalFare(fullFare, stopList, originStopId, destinationStopId);

        if (calculated !== null) {
          baseFare   = calculated;
          fareSource = 'proportional_fallback';
          console.info(
            `[bookings/create] Proportional fare for ${segmentKey}: ` +
            `MWK ${calculated} (${Math.round((calculated / fullFare) * 100)}% of full MWK ${fullFare})`
          );
        } else {
          // 3. Cannot calculate — fall back to full price and log a warning
          console.warn(
            `[bookings/create] Cannot find stop IDs ${segmentKey} in route ${routeId}. ` +
            `Falling back to full trip price MWK ${fullFare}.`
          );
          baseFare   = fullFare;
          fareSource = 'full_trip';
        }
      }
    }

    const totalAmount = baseFare * passengerCount;

    // ── Normalise passenger details ───────────────────────────────────────────
    // Pull stop IDs from the request body (not per-passenger for now — all passengers
    // on one booking share the same segment).
    const firstPassenger         = passengerDetails[0];
    const topOriginStopId        = originStopId        ?? firstPassenger?.originStopId        ?? null;
    const topDestinationStopId   = destinationStopId   ?? firstPassenger?.destinationStopId   ?? null;
    const topOriginStopName      = firstPassenger?.originStopName      ?? null;
    const topDestinationStopName = firstPassenger?.destinationStopName ?? null;

    const normalisedPassengers = passengerDetails.map((p) => ({
      name:               [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.firstName,
      age:                p.age ?? 0,
      gender:             p.gender ?? 'other',
      seatNumber:         p.seatNumber,
      ticketType:         p.ticketType ?? 'adult',
      originStopId:       topOriginStopId,
      destinationStopId:  topDestinationStopId,
      originStopName:     topOriginStopName,
      destinationStopName: topDestinationStopName,
    }));

    // ── Create booking ────────────────────────────────────────────────────────
    const now              = Timestamp.now();
    const bookingRef       = adminDb.collection('bookings').doc();
    const bookingReference = generateBookingReference();

    const bookingDoc = {
      id:               bookingRef.id,
      bookingReference,
      userId,
      companyId,
      scheduleId,
      routeId,
      origin:      routeData?.origin      ?? scheduleData.origin      ?? '',
      destination: routeData?.destination ?? scheduleData.destination ?? '',
      departureDateTime: scheduleData.departureDateTime,

      seatNumbers,
      passengerDetails: normalisedPassengers,
      passengers:       passengerCount,

      // Segment info at booking root (BookingCard reads these directly)
      originStopId:         topOriginStopId,
      destinationStopId:    topDestinationStopId,
      originStopName:       topOriginStopName,
      destinationStopName:  topDestinationStopName,
      isSegment:            isSegment && topOriginStopId !== null,

      // Pricing — server-calculated, never from client
      fullTripFare:   fullFare,         // always the full trip price for reference
      baseFare,                         // actual per-person fare charged
      totalAmount,
      pricePerPerson: baseFare,
      fareSource,                       // audit trail: 'full_trip' | 'operator_set' | 'proportional_fallback'
      currency:       scheduleData.currency ?? 'MWK',

      // Contact
      contactEmail: userData?.email ?? '',
      contactPhone: userData?.phone ?? '',

      bookingStatus: 'pending',
      paymentStatus: 'pending',
      bookedBy:      'customer',
      bookingDate:   now,
      createdAt:     now,
      updatedAt:     now,
    };

    // Atomic write: create booking + decrement schedule seats
    const batch = adminDb.batch();
    batch.set(bookingRef, bookingDoc);
    batch.update(scheduleRef, {
      availableSeats: FieldValue.increment(-passengerCount),
      bookedSeats:    FieldValue.arrayUnion(...seatNumbers),
      updatedAt:      now,
    });
    await batch.commit();

    return NextResponse.json({
      bookingId:        bookingRef.id,
      bookingReference,
      totalAmount,
      baseFare,
      fullTripFare:     fullFare,
      fareSource,
      currency:         bookingDoc.currency,
      isSegment:        bookingDoc.isSegment,
    });

  } catch (err: any) {
    console.error('[bookings/create]', err);
    return NextResponse.json(
      { error: 'Failed to create booking. Please try again.' },
      { status: 500 },
    );
  }
}