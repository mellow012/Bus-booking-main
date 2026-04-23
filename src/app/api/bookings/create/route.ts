// app/api/bookings/create/route.ts
//
// PAY-2: Payment amounts MUST be calculated server-side.
//
// SEGMENT PRICING (added):
//   Operators can set per-segment prices on a schedule via:
//     schedule.segmentPrices: { [key: `${originStopId}:${destinationStopId}`]: number }

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

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
  originStopId?:      string;
  destinationStopId?: string;
  promoCode?:         string;
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

  // Round to nearest 50 MWK
  const raw     = (segmentIntervals / totalIntervals) * fullPrice;
  const rounded = Math.round(raw / 50) * 50;

  return Math.max(50, rounded);
}

export async function POST(req: NextRequest) {
  try {
    // ── Authenticate ──────────────────────────────────────────────────────────
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // ── Fetch user profile ────────────────────────────────────────────────────
    const userData = await prisma.user.findUnique({ where: { id: userId } });
    if (!userData) {
      return NextResponse.json({ error: 'User profile not found in database.' }, { status: 404 });
    }

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
      promoCode
    } = body;

    if (!scheduleId || !routeId || !companyId) {
      return NextResponse.json(
        { error: 'scheduleId, routeId, and companyId are required' },
        { status: 400 },
      );
    }

    const passengerCount = seatNumbers?.length ?? 0;
    if (!passengerCount || passengerCount !== passengerDetails?.length) {
      return NextResponse.json(
        { error: 'seatNumbers and passengerDetails must have the same non-zero length' },
        { status: 400 },
      );
    }

    // ── Read schedule ─────────────────────────────────────────────────────────
    const scheduleData = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: { company: true }
    });

    if (!scheduleData) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Verify company is active
    if (scheduleData.company.status !== 'active') {
      const msg = scheduleData.company.status === 'inactive' 
        ? 'Bookings are paused for this company' 
        : 'This company is still in setup mode';
      return NextResponse.json({ error: msg }, { status: 403 });
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
    const routeData = await prisma.route.findUnique({
      where: { id: routeId }
    });

    // ── Calculate fare SERVER-SIDE ────────────────────────────────────────────
    const sd = scheduleData as any;
    const fullFare = sd.baseFare ?? sd.price ?? sd.fare;
    if (typeof fullFare !== 'number' || fullFare <= 0) {
      return NextResponse.json(
        { error: 'Schedule pricing is unavailable' },
        { status: 500 },
      );
    }

    const isSegment = !!(
      originStopId &&
      destinationStopId &&
      (originStopId !== '__origin__' || destinationStopId !== '__destination__')
    );

    let baseFare = fullFare;
    let fareSource: 'full_trip' | 'operator_set' | 'proportional_fallback' = 'full_trip';

    if (isSegment && originStopId && destinationStopId) {
      const segmentKey = `${originStopId}:${destinationStopId}`;
      const segmentPrices: Record<string, number> = sd.segmentPrices ?? {};
      const operatorPrice = segmentPrices[segmentKey];

      if (typeof operatorPrice === 'number' && operatorPrice > 0) {
        baseFare    = operatorPrice;
        fareSource  = 'operator_set';
      } else {
        const stopList   = buildStopList(routeData ?? scheduleData);
        const calculated = proportionalFare(fullFare, stopList, originStopId, destinationStopId);

        if (calculated !== null) {
          baseFare   = calculated;
          fareSource = 'proportional_fallback';
        } else {
          baseFare   = fullFare;
          fareSource = 'full_trip';
        }
      }
    }

    let totalAmount = baseFare * passengerCount;
    let discountAmount = 0;
    let appliedPromo = null;

    // ── Apply Promotion if provided ───────────────────────────────────────────
    if (promoCode) {
      const promotion = await prisma.promotion.findUnique({
        where: { code: promoCode.toUpperCase() },
      });

      if (promotion && promotion.isActive) {
        const now = new Date();
        const isValidDate = now >= promotion.startDate && now <= promotion.endDate;
        const isValidAmount = !promotion.minPurchase || totalAmount >= promotion.minPurchase;

        if (isValidDate && isValidAmount) {
          if (promotion.discountType === 'percentage') {
            discountAmount = (totalAmount * promotion.discountValue) / 100;
            if (promotion.maxDiscount && discountAmount > promotion.maxDiscount) {
              discountAmount = promotion.maxDiscount;
            }
          } else {
            discountAmount = promotion.discountValue;
          }

          // Cap discount at total amount
          discountAmount = Math.min(discountAmount, totalAmount);
          totalAmount -= discountAmount;
          appliedPromo = {
            code: promotion.code,
            discount: discountAmount,
            title: promotion.title
          };
        }
      }
    }

    // ── Normalise passenger details ───────────────────────────────────────────
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
    const bookingReference = generateBookingReference();

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const currentSched = await tx.schedule.findUnique({
        where: { id: scheduleId }
      });
      
      if (!currentSched || currentSched.availableSeats < passengerCount) {
        throw new Error('Not enough seats remaining');
      }
      
      const b = await tx.booking.create({
        data: {
          bookingReference,
          userId:         userData.id,
          companyId,
          scheduleId,
          routeId,
          totalAmount,
          currency:       'MWK',
          contactEmail: userData?.email ?? '',
          contactPhone: userData?.phone ?? '',
          bookingStatus: 'pending',
          paymentStatus: 'pending',
          passengerDetails: normalisedPassengers as any,
          seatNumbers: seatNumbers as any,
          bookingDate:   new Date(),
        }
      });
      
      await tx.schedule.update({
        where: { id: scheduleId },
        data: {
          availableSeats: { decrement: passengerCount },
          bookedSeats: { push: seatNumbers as any[] },
        }
      });
      
      return b;
    });

    return NextResponse.json({
      bookingId:        result.id,
      bookingReference,
      totalAmount,
      discountAmount,
      appliedPromo,
      baseFare,
      fullTripFare:     fullFare,
      fareSource,
      currency:         'MWK',
      isSegment:        isSegment,
    });

  } catch (err: any) {
    console.error('[bookings/create]', err);
    return NextResponse.json(
      { error: 'Failed to create booking: ' + (err.message || 'Server error') },
      { status: 500 },
    );
  }
}
