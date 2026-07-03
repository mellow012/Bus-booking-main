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
import { logger } from '@/lib/logger';
import { getClientIp } from '@/lib/rateLimiter';
import { serverCache } from '@/lib/cache';
import { sendNotificationToUser } from '@/lib/notificationService';

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

interface BookingSegmentInput {
  scheduleId: string;
  date?: string;
  seatNumbers: string[];
  originStopId?: string;
  destinationStopId?: string;
}

interface CreateBookingRequest {
  routeId:          string;
  companyId:        string;
  scheduleId?:      string;
  seatNumbers?:     string[];
  passengerDetails?: PassengerDetail[];
  segments?:        BookingSegmentInput[];
  originStopId?:    string;
  destinationStopId?: string;
  promoCode?:       string;
  returnDate?:      string;
}

/** Generate a short human-readable booking reference, e.g. BK-A3F9X2 */
function generateBookingReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = 'BK-';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

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
  const originIdx = stopList.findIndex((s) => s.id === originId);
  const destIdx = stopList.findIndex((s) => s.id === destId);

  if (originIdx === -1 || destIdx === -1) return null;
  if (destIdx <= originIdx) return null;

  const totalIntervals = stopList.length - 1;
  const segmentIntervals = destIdx - originIdx;

  if (totalIntervals <= 0) return null;

  const raw = (segmentIntervals / totalIntervals) * fullPrice;
  const rounded = Math.round(raw / 50) * 50;

  return Math.max(50, rounded);
}

function parseSeatArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((seat): seat is string => typeof seat === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((seat): seat is string => typeof seat === 'string');
    } catch {
      return [];
    }
  }
  return [];
}

function calculateSegmentFare(
  scheduleData: any,
  routeData: any,
  originStopId?: string,
  destinationStopId?: string,
): { fare: number; fareSource: 'full_trip' | 'operator_set' | 'proportional_fallback' } {
  const sd = scheduleData as any;
  const fullFare = sd.baseFare ?? sd.price ?? sd.fare;
  let baseFare = fullFare;
  let fareSource: 'full_trip' | 'operator_set' | 'proportional_fallback' = 'full_trip';

  const isSegment = !!(
    originStopId &&
    destinationStopId &&
    (originStopId !== '__origin__' || destinationStopId !== '__destination__')
  );

  if (isSegment && originStopId && destinationStopId) {
    const segmentKey = `${originStopId}:${destinationStopId}`;
    const segmentPrices: Record<string, number> = sd.segmentPrices ?? {};
    const operatorPrice = segmentPrices[segmentKey];

    if (typeof operatorPrice === 'number' && operatorPrice > 0) {
      baseFare = operatorPrice;
      fareSource = 'operator_set';
    } else {
      const stopList = buildStopList(routeData ?? scheduleData);
      const calculated = proportionalFare(fullFare, stopList, originStopId, destinationStopId);

      if (calculated !== null) {
        baseFare = calculated;
        fareSource = 'proportional_fallback';
      } else {
        baseFare = fullFare;
        fareSource = 'full_trip';
      }
    }
  }

  return { fare: baseFare, fareSource };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const userData = await prisma.user.findUnique({ where: { id: userId } });
    if (!userData) {
      return NextResponse.json({ error: 'User profile not found in database.' }, { status: 404 });
    }

    let body: CreateBookingRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      scheduleId,
      routeId,
      companyId,
      seatNumbers,
      passengerDetails,
      originStopId,
      destinationStopId,
      promoCode,
      returnDate,
      segments,
    } = body;

    if (!routeId || !companyId) {
      return NextResponse.json({ error: 'routeId and companyId are required' }, { status: 400 });
    }

    if (returnDate && typeof returnDate !== 'string') {
      return NextResponse.json({ error: 'Return date must be a valid date string' }, { status: 400 });
    }

    if (!passengerDetails || !Array.isArray(passengerDetails) || passengerDetails.length === 0) {
      return NextResponse.json({ error: 'passengerDetails are required' }, { status: 400 });
    }

    const passengerCount = passengerDetails.length;
    const finalSegments: BookingSegmentInput[] = Array.isArray(segments) && segments.length > 0
      ? segments
      : scheduleId
        ? [{ scheduleId, seatNumbers: seatNumbers ?? [], originStopId, destinationStopId }]
        : [];

    if (finalSegments.length === 0) {
      return NextResponse.json({ error: 'At least one booking segment is required' }, { status: 400 });
    }

    if (finalSegments.some((segment) => !segment.scheduleId)) {
      return NextResponse.json({ error: 'Each booking segment must include a scheduleId' }, { status: 400 });
    }

    for (const segment of finalSegments) {
      if (!Array.isArray(segment.seatNumbers) || segment.seatNumbers.length !== passengerCount) {
        return NextResponse.json({ error: 'Each booking segment must include seat numbers for every passenger' }, { status: 400 });
      }

      const seatNumbers = parseSeatArray(segment.seatNumbers);
      if (seatNumbers.length !== segment.seatNumbers.length) {
        return NextResponse.json({ error: 'Each booking segment must include valid seat numbers' }, { status: 400 });
      }

      if (new Set(seatNumbers).size !== seatNumbers.length) {
        return NextResponse.json({ error: 'Seat numbers must be unique within each booking segment' }, { status: 400 });
      }
    }

    const scheduleIds = Array.from(new Set(finalSegments.map((segment) => segment.scheduleId)));
    const scheduleDataSet = await prisma.schedule.findMany({
      where: { id: { in: scheduleIds } },
      include: { company: true },
    });

    if (scheduleDataSet.length !== scheduleIds.length) {
      return NextResponse.json({ error: 'One or more schedules were not found' }, { status: 404 });
    }

    const routeData = await prisma.route.findUnique({ where: { id: routeId } });
    if (!routeData) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    const scheduleMap = new Map(scheduleDataSet.map((schedule) => [schedule.id, schedule]));

    const requestedSeatsBySchedule = new Map<string, string[]>();
    for (const segment of finalSegments) {
      const seatNumbers = parseSeatArray(segment.seatNumbers);
      requestedSeatsBySchedule.set(
        segment.scheduleId,
        [...(requestedSeatsBySchedule.get(segment.scheduleId) || []), ...seatNumbers],
      );
    }

    for (const [scheduleId, seatNumbers] of requestedSeatsBySchedule.entries()) {
      const schedule = scheduleMap.get(scheduleId);
      if (!schedule) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
      }

      if ((schedule.availableSeats ?? 0) < seatNumbers.length) {
        return NextResponse.json({ error: `Only ${schedule.availableSeats} seat(s) remaining on schedule ${scheduleId}` }, { status: 409 });
      }

      const existingBookedSeats = parseSeatArray(schedule.bookedSeats);
      const conflictingBookedSeats = seatNumbers.filter((seat) => existingBookedSeats.includes(seat));
      if (conflictingBookedSeats.length > 0) {
        return NextResponse.json({ error: `Seat(s) already booked on schedule ${scheduleId}: ${conflictingBookedSeats.join(', ')}` }, { status: 409 });
      }

      const activeReservations = await prisma.seatReservation.findMany({
        where: {
          scheduleId,
          status: 'reserved',
          expiresAt: { gt: new Date() },
          userId: { not: userId },
        },
      });
      const reservedSeats = activeReservations.flatMap((reservation) => parseSeatArray(reservation.seatNumbers));
      const conflictingReservedSeats = seatNumbers.filter((seat) => reservedSeats.includes(seat));
      if (conflictingReservedSeats.length > 0) {
        return NextResponse.json({ error: `Seat(s) temporarily reserved on schedule ${scheduleId}: ${conflictingReservedSeats.join(', ')}` }, { status: 409 });
      }
    }

    for (const segment of finalSegments) {
      const currentSchedule = scheduleMap.get(segment.scheduleId);
      if (!currentSchedule) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
      }

      if (currentSchedule.companyId !== companyId) {
        return NextResponse.json({ error: 'Schedule company mismatch' }, { status: 403 });
      }

      if (currentSchedule.company.status !== 'active') {
        const msg = currentSchedule.company.status === 'inactive'
          ? 'Bookings are paused for this company'
          : 'This company is still in setup mode';
        return NextResponse.json({ error: msg }, { status: 403 });
      }

      if (currentSchedule.status !== 'active') {
        return NextResponse.json({ error: 'One or more selected schedules are no longer available for booking' }, { status: 409 });
      }

      if ((currentSchedule.availableSeats ?? 0) < passengerCount) {
        return NextResponse.json({ error: `Only ${currentSchedule.availableSeats} seat(s) remaining on schedule ${currentSchedule.id}` }, { status: 409 });
      }
    }

    const firstSchedule = scheduleMap.get(finalSegments[0].scheduleId)!;
    if (returnDate) {
      const parsedReturnDate = new Date(returnDate);
      if (Number.isNaN(parsedReturnDate.getTime())) {
        return NextResponse.json({ error: 'Return date must be a valid date' }, { status: 400 });
      }
      const departureDate = new Date(firstSchedule.departureDateTime);
      if (parsedReturnDate < departureDate) {
        return NextResponse.json({ error: 'Return date must be on or after the departure date' }, { status: 400 });
      }
    }

    const pricedSegments = finalSegments.map((segment, index) => {
      const currentSchedule = scheduleMap.get(segment.scheduleId)!;
      const { fare, fareSource } = calculateSegmentFare(
        currentSchedule,
        routeData,
        segment.originStopId,
        segment.destinationStopId,
      );

      return {
        ...segment,
        schedule: currentSchedule,
        fare,
        fareSource,
        segmentIndex: index,
      };
    });

    const isReturnTripBooking = Boolean(returnDate) && finalSegments.length === 1;
    let totalAmount = pricedSegments.reduce((sum, segment) => sum + segment.fare * passengerCount, 0);
    if (isReturnTripBooking) {
      totalAmount = totalAmount * 2;
    }

    let discountAmount = 0;
    let appliedPromo = null;
    const fareSource = pricedSegments[0]?.fareSource ?? 'full_trip';
    const fullTripFare = (pricedSegments[0]?.schedule as any)?.baseFare ?? (pricedSegments[0]?.schedule as any)?.price ?? 0;

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

          discountAmount = Math.min(discountAmount, totalAmount);
          totalAmount -= discountAmount;
          appliedPromo = {
            code: promotion.code,
            discount: discountAmount,
            title: promotion.title,
          };
        }
      }
    }

    const firstPassenger = passengerDetails[0];
    const topOriginStopId = originStopId ?? firstPassenger?.originStopId ?? null;
    const topDestinationStopId = destinationStopId ?? firstPassenger?.destinationStopId ?? null;
    const topOriginStopName = firstPassenger?.originStopName ?? null;
    const topDestinationStopName = firstPassenger?.destinationStopName ?? null;

    const normalisedPassengers = passengerDetails.map((p) => ({
      name: [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.firstName,
      age: p.age ?? 0,
      gender: p.gender ?? 'other',
      seatNumber: p.seatNumber,
      ticketType: p.ticketType ?? 'adult',
      originStopId: topOriginStopId,
      destinationStopId: topDestinationStopId,
      originStopName: topOriginStopName,
      destinationStopName: topDestinationStopName,
    }));

    const bookingReference = generateBookingReference();

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const txSchedule = await tx.schedule.findUnique({ where: { id: finalSegments[0].scheduleId } });
      if (!txSchedule || txSchedule.availableSeats < passengerCount) {
        throw new Error('Not enough seats remaining');
      }

      const booking = await tx.booking.create({
        data: {
          bookingReference,
          userId: userData.id,
          companyId,
          scheduleId: finalSegments[0].scheduleId,
          routeId,
          totalAmount,
          currency: 'MWK',
          contactEmail: userData?.email ?? '',
          contactPhone: userData?.phone ?? '',
          bookingStatus: 'pending',
          paymentStatus: 'pending',
          passengerDetails: normalisedPassengers as any,
          seatNumbers: Array.from(new Set(finalSegments.flatMap((segment) => parseSeatArray(segment.seatNumbers)))) as any,
          originStopId: topOriginStopId ?? undefined,
          destinationStopId: topDestinationStopId ?? undefined,
          returnDate: returnDate ? new Date(returnDate) : undefined,
          metadata: {
            ...(returnDate ? { returnDate } : {}),
            segments: finalSegments.map((segment) => ({
              scheduleId: segment.scheduleId,
              date: segment.date,
              originStopId: segment.originStopId,
              destinationStopId: segment.destinationStopId,
            })),
          },
          bookingDate: new Date(),
        },
      });

      for (const segment of pricedSegments) {
        await tx.bookingSegment.create({
          data: {
            bookingId: booking.id,
            companyId,
            scheduleId: segment.scheduleId,
            segmentIndex: segment.segmentIndex,
            date: segment.date ? new Date(segment.date) : new Date(segment.schedule.departureDateTime),
            seatNumbers: segment.seatNumbers as any,
            passengerCount,
            price: segment.fare,
            currency: 'MWK',
            originStopId: segment.originStopId ?? undefined,
            destinationStopId: segment.destinationStopId ?? undefined,
            metadata: { fareSource: segment.fareSource },
          },
        });

        const txScheduleRow = await tx.schedule.findUnique({ where: { id: segment.scheduleId } });
        if (!txScheduleRow) {
          throw new Error('Schedule not found during booking update');
        }

        const existingBookedSeats = Array.isArray(txScheduleRow.bookedSeats)
          ? txScheduleRow.bookedSeats.filter((seat): seat is string => typeof seat === 'string')
          : [];
        const updatedBookedSeats = Array.from(
          new Set([...existingBookedSeats, ...(Array.isArray(segment.seatNumbers) ? segment.seatNumbers : [])])
        );

        await tx.schedule.update({
          where: { id: segment.scheduleId },
          data: {
            availableSeats: { decrement: passengerCount },
            bookedSeats: updatedBookedSeats as any,
          },
        });
      }

      return booking;
    });

    serverCache.invalidate('schedules');

    try {
      await sendNotificationToUser(userData.id, {
        title: 'Booking created',
        body: `Your booking ${bookingReference} for ${routeData?.name ?? 'your trip'} is pending payment.`,
        type: 'booking',
        priority: 'high',
        clickAction: `/bookings/${result.id}`,
        data: {
          bookingId: result.id,
          scheduleId: finalSegments[0].scheduleId,
          companyId,
        },
      });
    } catch (sendError) {
      console.warn('[bookings/create] Notification send failed:', sendError);
    }

    const isSegmentRoute = pricedSegments.some((segment) =>
      !!segment.originStopId &&
      !!segment.destinationStopId &&
      (segment.originStopId !== '__origin__' || segment.destinationStopId !== '__destination__'),
    );

    await logger.logBooking('created', result.id, {
      userId,
      companyId,
      scheduleId: finalSegments[0].scheduleId,
      metadata: { bookingReference, totalAmount, fareSource, isSegment: isSegmentRoute },
    });

    return NextResponse.json({
      bookingId: result.id,
      bookingReference,
      totalAmount,
      discountAmount,
      appliedPromo,
      baseFare: pricedSegments[0]?.fare ?? 0,
      fullTripFare,
      fareSource,
      currency: 'MWK',
      isSegment: isSegmentRoute,
    });
  } catch (err: any) {
    await logger.logError('booking', '[bookings/create] Failed to create booking', err, {
      ip: getClientIp(req),
    });
    return NextResponse.json(
      { error: 'Failed to create booking: ' + (err.message || 'Server error') },
      { status: 500 },
    );
  }
}
