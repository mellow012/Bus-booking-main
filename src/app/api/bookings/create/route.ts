// app/api/bookings/create/route.ts
//
// PAY-2: Payment amounts MUST be calculated server-side.
// The old client-side flow read totalAmount from a client-created Firestore
// document — a buyer could set totalAmount: 1 and pay MWK 1 for any ticket.
//
// This API route:
//   1. Accepts only routeId, scheduleId, seatNumbers, and passengers from the client.
//   2. Reads baseFare from the trusted Firestore schedule document.
//   3. Calculates totalAmount = baseFare × passengers server-side.
//   4. Creates the booking with the server-calculated amount.
//   5. Returns the bookingId for the client to proceed to payment.
//
// The client must NEVER supply a price. If the price in the payment request
// doesn't match the booking's server-calculated amount, reject the payment.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

interface PassengerDetail {
  firstName:           string;
  lastName:            string;
  age?:                number;
  gender?:             'male' | 'female' | 'other';
  seatNumber:          string;
  ticketType?:         'adult' | 'child' | 'senior';
  phone?:              string;
  originStopId?:       string;
  destinationStopId?:  string;
  originStopName?:     string;
  destinationStopName?: string;
}

interface CreateBookingRequest {
  scheduleId:       string;
  routeId:          string;
  companyId:        string;
  seatNumbers:      string[];
  passengerDetails: PassengerDetail[];
}

/** Generate a short human-readable booking reference, e.g. BK-A3F9X2 */
function generateBookingReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = 'BK-';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
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

    // ── Fetch the user's profile for contactEmail / contactPhone ──────────────
    const userSnap = await adminDb.collection('users').doc(userId).get();
    const userData = userSnap.data();

    // ── Parse request body ────────────────────────────────────────────────────
    let body: CreateBookingRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { scheduleId, routeId, companyId, seatNumbers, passengerDetails } = body;

    if (!scheduleId || !routeId || !companyId) {
      return NextResponse.json(
        { error: 'scheduleId, routeId, and companyId are required' },
        { status: 400 }
      );
    }

    if (!seatNumbers?.length || !passengerDetails?.length) {
      return NextResponse.json(
        { error: 'seatNumbers and passengerDetails are required' },
        { status: 400 }
      );
    }

    if (seatNumbers.length !== passengerDetails.length) {
      return NextResponse.json(
        { error: 'seatNumbers and passengerDetails must have the same length' },
        { status: 400 }
      );
    }

    const passengerCount = seatNumbers.length;

    // ── Read schedule from Firestore (authoritative source for pricing) ────────
    // We check the top-level schedules collection first (optimized path),
    // then fall back to the nested path for backward compatibility.
    let scheduleData: FirebaseFirestore.DocumentData | undefined;
    let scheduleRef: FirebaseFirestore.DocumentReference | undefined;

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
        { status: 409 }
      );
    }

    if ((scheduleData.availableSeats ?? 0) < passengerCount) {
      return NextResponse.json(
        { error: `Only ${scheduleData.availableSeats} seat(s) remaining` },
        { status: 409 }
      );
    }

    // ── Calculate price SERVER-SIDE ───────────────────────────────────────────
    // baseFare comes from the trusted Firestore schedule document, not the client.
    const baseFare = scheduleData.baseFare ?? scheduleData.price ?? scheduleData.fare;
    if (typeof baseFare !== 'number' || baseFare <= 0) {
      console.error('[bookings/create] Schedule missing valid baseFare:', scheduleId, baseFare);
      return NextResponse.json(
        { error: 'Schedule pricing is unavailable — please contact support' },
        { status: 500 }
      );
    }

    const totalAmount = baseFare * passengerCount;

    // ── Read route for origin/destination labels ───────────────────────────────
    const routeRef  = adminDb
      .collection('companies').doc(companyId)
      .collection('routes').doc(routeId);
    const routeSnap = await routeRef.get();
    const routeData = routeSnap.data();

    // ── Normalise passenger details ───────────────────────────────────────────
    // The bookings page expects passengerDetails[].name (full name), age, gender,
    // seatNumber.  The client sends firstName + lastName separately, so we
    // reconstruct `name` here so the shape matches the Booking type exactly.
    //
    // Stop IDs/names are promoted to the top-level booking doc as well so the
    // bookings page (and BookingCard) can read them without iterating passengers.
    const normalisedPassengers = passengerDetails.map((p) => ({
      name:        [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.firstName,
      age:         p.age ?? 0,
      gender:      p.gender ?? 'other',
      seatNumber:  p.seatNumber,
      ticketType:  p.ticketType ?? 'adult',
      // Keep stop info per-passenger too (useful for partial-segment tickets)
      originStopId:        p.originStopId        ?? null,
      destinationStopId:   p.destinationStopId   ?? null,
      originStopName:      p.originStopName      ?? null,
      destinationStopName: p.destinationStopName ?? null,
    }));

    // Hoist the first passenger's stop selection to the booking root so
    // BookingCard.resolveStopName() / the bookings list can display it.
    // (All passengers on one booking share the same segment.)
    const firstPassenger  = passengerDetails[0];
    const topOriginStopId       = firstPassenger?.originStopId       ?? null;
    const topDestinationStopId  = firstPassenger?.destinationStopId  ?? null;
    const topOriginStopName     = firstPassenger?.originStopName     ?? null;
    const topDestinationStopName = firstPassenger?.destinationStopName ?? null;

    // ── Create the booking document ───────────────────────────────────────────
    const now            = Timestamp.now();
    const bookingRef     = adminDb.collection('bookings').doc();
    const bookingReference = generateBookingReference();

    const bookingDoc = {
      id:               bookingRef.id,
      bookingReference,                          // ← FIX: was missing; bookings page relies on this
      userId,
      companyId,
      scheduleId,
      routeId,
      origin:           routeData?.origin      ?? scheduleData.origin      ?? '',
      destination:      routeData?.destination ?? scheduleData.destination ?? '',
      departureDateTime: scheduleData.departureDateTime,
      seatNumbers,
      passengerDetails: normalisedPassengers,    // ← FIX: shape now matches Booking type (name, age, gender, seatNumber)
      passengers:       passengerCount,

      // ── Stop segment (top-level) — BookingCard reads these directly ───────
      originStopId:         topOriginStopId,        // ← FIX: was only per-passenger, now also at root
      destinationStopId:    topDestinationStopId,
      originStopName:       topOriginStopName,
      destinationStopName:  topDestinationStopName,

      // ── Server-calculated price — never from the client ───────────────────
      baseFare,
      totalAmount,
      pricePerPerson:   baseFare,                // ← FIX: BookingCard shows a per-person breakdown
      currency:         scheduleData.currency ?? 'MWK',

      // ── Contact info from user profile ────────────────────────────────────
      contactEmail:  userData?.email ?? '',      // ← FIX: required by Booking type, was missing
      contactPhone:  userData?.phone ?? '',      // ← FIX: required by Booking type, was missing

      bookingStatus:    'pending',
      paymentStatus:    'pending',
      bookedBy:         'customer',
      bookingDate:      now,
      createdAt:        now,
      updatedAt:        now,
    };

    // ── Write booking + decrement schedule seats atomically ───────────────────
    // FIX: the old API created the booking doc but never updated availableSeats
    // or bookedSeats on the schedule, so the seat map stayed stale.
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
      currency:         bookingDoc.currency,
      // Return the server-calculated amount so the client can display it,
      // but the payment flow MUST use this value — not a locally computed one.
    });

  } catch (err: any) {
    console.error('[bookings/create]', err);
    return NextResponse.json(
      { error: 'Failed to create booking. Please try again.' },
      { status: 500 }
    );
  }
}