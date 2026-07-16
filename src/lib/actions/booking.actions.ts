'use server'

import prisma from '../prisma';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { Booking, BookingStatus } from '@/types';
import { createClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logger';
import { serverCache } from '@/lib/cache';
import { sendNotificationToUser, notifyCompanyStaff } from '@/lib/notificationService';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PassengerDetail {
  firstName: string;
  lastName: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  seatNumber: string;
  ticketType?: 'adult' | 'child' | 'senior' | 'infant';
  phone?: string;
  originStopId?: string;
  destinationStopId?: string;
  originStopName?: string;
  destinationStopName?: string;
}

interface BookingSegmentInput {
  scheduleId: string;
  date?: string;
  seatNumbers: string[];
  originStopId?: string;
  destinationStopId?: string;
}

export interface CreateBookingPayload {
  routeId: string;
  companyId: string;
  scheduleId?: string;
  seatNumbers?: string[];
  passengerDetails?: PassengerDetail[];
  segments?: BookingSegmentInput[];
  originStopId?: string;
  destinationStopId?: string;
  promoCode?: string;
  returnDate?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (private — not exported)
// ─────────────────────────────────────────────────────────────────────────────

function generateBookingReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = 'BK-';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

interface RouteStop { id: string; name: string; }

function buildStopList(routeData: any): RouteStop[] {
  const stops: RouteStop[] = [];
  if (routeData?.origin) stops.push({ id: '__origin__', name: routeData.origin });
  if (Array.isArray(routeData?.stops)) {
    for (const s of routeData.stops) {
      if (s?.id && s?.name) stops.push({ id: s.id, name: s.name });
    }
  }
  if (routeData?.destination) stops.push({ id: '__destination__', name: routeData.destination });
  return stops;
}

function proportionalFare(fullPrice: number, stopList: RouteStop[], originId: string, destId: string): number | null {
  const originIdx = stopList.findIndex((s) => s.id === originId);
  const destIdx = stopList.findIndex((s) => s.id === destId);
  if (originIdx === -1 || destIdx === -1 || destIdx <= originIdx) return null;
  const totalIntervals = stopList.length - 1;
  const segmentIntervals = destIdx - originIdx;
  if (totalIntervals <= 0) return null;
  const raw = (segmentIntervals / totalIntervals) * fullPrice;
  return Math.max(50, Math.round(raw / 50) * 50);
}

function parseSeatArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((s): s is string => typeof s === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === 'string');
    } catch { return []; }
  }
  return [];
}

function calculateSegmentFare(
  scheduleData: any, routeData: any,
  originStopId?: string, destinationStopId?: string,
): { fare: number; fareSource: 'full_trip' | 'operator_set' | 'proportional_fallback' } {
  const fullFare = scheduleData.baseFare ?? scheduleData.price ?? scheduleData.fare;
  let baseFare = fullFare;
  let fareSource: 'full_trip' | 'operator_set' | 'proportional_fallback' = 'full_trip';

  const isSegment = !!(originStopId && destinationStopId &&
    (originStopId !== '__origin__' || destinationStopId !== '__destination__'));

  if (isSegment && originStopId && destinationStopId) {
    const segmentKey = `${originStopId}:${destinationStopId}`;
    const segmentPrices: Record<string, number> = scheduleData.segmentPrices ?? {};
    const operatorPrice = segmentPrices[segmentKey];

    if (typeof operatorPrice === 'number' && operatorPrice > 0) {
      baseFare = operatorPrice;
      fareSource = 'operator_set';
    } else {
      const stopList = buildStopList(routeData ?? scheduleData);
      const calculated = proportionalFare(fullFare, stopList, originStopId, destinationStopId);
      if (calculated !== null) { baseFare = calculated; fareSource = 'proportional_fallback'; }
    }
  }
  return { fare: baseFare, fareSource };
}

// ─────────────────────────────────────────────────────────────────────────────
// createBookingFull — replaces POST /api/bookings/create
// ─────────────────────────────────────────────────────────────────────────────

export async function createBookingFull(body: CreateBookingPayload): Promise<{
  bookingId?: string;
  bookingReference?: string;
  totalAmount?: number;
  discountAmount?: number;
  appliedPromo?: { code: string; discount: number; title: string } | null;
  baseFare?: number;
  fullTripFare?: number;
  fareSource?: string;
  currency?: string;
  isSegment?: boolean;
  error?: string;
}> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) return { error: 'Unauthorized' };

  const userId = supabaseUser.id;
  const userData = await prisma.user.findFirst({ where: { OR: [{ id: userId }, { uid: userId }] } });
  if (!userData) return { error: 'User profile not found in database.' };

  const {
    routeId, companyId, scheduleId, seatNumbers, passengerDetails,
    originStopId, destinationStopId, promoCode, returnDate, segments,
  } = body;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!routeId || !companyId) return { error: 'routeId and companyId are required' };
  if (returnDate && typeof returnDate !== 'string') return { error: 'Return date must be a valid date string' };
  if (!passengerDetails || !Array.isArray(passengerDetails) || passengerDetails.length === 0)
    return { error: 'passengerDetails are required' };

  const passengerCount = passengerDetails.length;
  const finalSegments: BookingSegmentInput[] = Array.isArray(segments) && segments.length > 0
    ? segments
    : scheduleId
      ? [{ scheduleId, seatNumbers: seatNumbers ?? [], originStopId, destinationStopId }]
      : [];

  if (finalSegments.length === 0) return { error: 'At least one booking segment is required' };
  if (finalSegments.some((s) => !s.scheduleId)) return { error: 'Each booking segment must include a scheduleId' };

  for (const segment of finalSegments) {
    if (!Array.isArray(segment.seatNumbers) || segment.seatNumbers.length !== passengerCount)
      return { error: 'Each booking segment must include seat numbers for every passenger' };
    const sns = parseSeatArray(segment.seatNumbers);
    if (sns.length !== segment.seatNumbers.length) return { error: 'Each booking segment must include valid seat numbers' };
    if (new Set(sns).size !== sns.length) return { error: 'Seat numbers must be unique within each booking segment' };
  }

  // ── Load schedules + route ─────────────────────────────────────────────────
  const scheduleIds = Array.from(new Set(finalSegments.map((s) => s.scheduleId)));
  const scheduleDataSet = await prisma.schedule.findMany({
    where: { id: { in: scheduleIds } }, include: { company: true },
  });
  if (scheduleDataSet.length !== scheduleIds.length) return { error: 'One or more schedules were not found' };

  const routeData = await prisma.route.findUnique({ where: { id: routeId } });
  if (!routeData) return { error: 'Route not found' };

  const scheduleMap = new Map(scheduleDataSet.map((s) => [s.id, s]));

  // ── Seat conflict check ────────────────────────────────────────────────────
  const requestedSeatsBySchedule = new Map<string, string[]>();
  for (const segment of finalSegments) {
    const sns = parseSeatArray(segment.seatNumbers);
    requestedSeatsBySchedule.set(segment.scheduleId, [
      ...(requestedSeatsBySchedule.get(segment.scheduleId) || []), ...sns,
    ]);
  }

  for (const [sid, sns] of requestedSeatsBySchedule.entries()) {
    const schedule = scheduleMap.get(sid);
    if (!schedule) return { error: 'Schedule not found' };
    if ((schedule.availableSeats ?? 0) < sns.length)
      return { error: `Only ${schedule.availableSeats} seat(s) remaining on schedule ${sid}` };

    const existingBooked = parseSeatArray(schedule.bookedSeats);
    const conflicts = sns.filter((s) => existingBooked.includes(s));
    if (conflicts.length > 0)
      return { error: `Seat(s) already booked on schedule ${sid}: ${conflicts.join(', ')}` };

    const activeReservations = await prisma.seatReservation.findMany({
      where: { scheduleId: sid, status: 'reserved', expiresAt: { gt: new Date() }, userId: { not: userData.id } },
    });
    const reservedSeats = activeReservations.flatMap((r) => parseSeatArray(r.seatNumbers));
    const reserveConflicts = sns.filter((s) => reservedSeats.includes(s));
    if (reserveConflicts.length > 0)
      return { error: `Seat(s) temporarily reserved on schedule ${sid}: ${reserveConflicts.join(', ')}` };
  }

  // ── Business rule checks ───────────────────────────────────────────────────
  for (const segment of finalSegments) {
    const cs = scheduleMap.get(segment.scheduleId);
    if (!cs) return { error: 'Schedule not found' };
    if (cs.companyId !== companyId) return { error: 'Schedule company mismatch' };
    if (cs.company.status !== 'active') {
      const msg = cs.company.status === 'inactive'
        ? 'Bookings are paused for this company'
        : 'This company is still in setup mode';
      return { error: msg };
    }
    if (cs.status !== 'active') return { error: 'One or more selected schedules are no longer available for booking' };
    if ((cs.availableSeats ?? 0) < passengerCount)
      return { error: `Only ${cs.availableSeats} seat(s) remaining on schedule ${cs.id}` };
  }

  const firstSchedule = scheduleMap.get(finalSegments[0].scheduleId)!;
  if (returnDate) {
    const parsedReturn = new Date(returnDate);
    if (Number.isNaN(parsedReturn.getTime())) return { error: 'Return date must be a valid date' };
    if (parsedReturn < new Date(firstSchedule.departureDateTime))
      return { error: 'Return date must be on or after the departure date' };
  }

  // ── Pricing ────────────────────────────────────────────────────────────────
  const pricedSegments = finalSegments.map((segment, idx) => {
    const cs = scheduleMap.get(segment.scheduleId)!;
    const { fare, fareSource } = calculateSegmentFare(cs, routeData, segment.originStopId, segment.destinationStopId);
    return { ...segment, schedule: cs, fare, fareSource, segmentIndex: idx };
  });

  const isReturnTripBooking = Boolean(returnDate) && finalSegments.length === 1;
  const paymentSettings = (firstSchedule.company?.paymentSettings as Record<string, any>) || {};
  const returnDiscount = Number(paymentSettings.returnDiscount) || 0;

  let totalAmount = pricedSegments.reduce((sum, s) => sum + s.fare * passengerCount, 0);
  const baseAmount = totalAmount;

  if (isReturnTripBooking) {
    const outboundTotal = baseAmount;
    const returnTotal = outboundTotal * (1 - returnDiscount / 100);
    totalAmount = Math.round(outboundTotal + returnTotal);
  }

  let discountAmount = 0;
  let appliedPromo = null;
  const fareSource = pricedSegments[0]?.fareSource ?? 'full_trip';
  const fullTripFare = (pricedSegments[0]?.schedule as any)?.baseFare ?? (pricedSegments[0]?.schedule as any)?.price ?? 0;

  if (promoCode) {
    const promotion = await prisma.promotion.findUnique({ where: { code: promoCode.toUpperCase() } });
    if (promotion && promotion.isActive) {
      const now = new Date();
      const isValidDate = now >= promotion.startDate && now <= promotion.endDate;
      const isValidAmount = !promotion.minPurchase || totalAmount >= promotion.minPurchase;
      if (isValidDate && isValidAmount) {
        if (promotion.discountType === 'percentage') {
          discountAmount = (totalAmount * promotion.discountValue) / 100;
          if (promotion.maxDiscount && discountAmount > promotion.maxDiscount) discountAmount = promotion.maxDiscount;
        } else {
          discountAmount = promotion.discountValue;
        }
        discountAmount = Math.min(discountAmount, totalAmount);
        totalAmount -= discountAmount;
        appliedPromo = { code: promotion.code, discount: discountAmount, title: promotion.title };
      }
    }
  }

  // ── Build passenger list ───────────────────────────────────────────────────
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

  // ── DB transaction ─────────────────────────────────────────────────────────
  let result;
  try {
    result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const txSchedule = await tx.schedule.findUnique({ where: { id: finalSegments[0].scheduleId } });
        if (!txSchedule || txSchedule.availableSeats < passengerCount)
          throw new Error('Not enough seats remaining');

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
            seatNumbers: Array.from(new Set(finalSegments.flatMap((s) => parseSeatArray(s.seatNumbers)))) as any,
            originStopId: topOriginStopId ?? undefined,
            destinationStopId: topDestinationStopId ?? undefined,
            returnDate: returnDate ? new Date(returnDate) : undefined,
            metadata: {
              ...(returnDate ? { returnDate } : {}),
              returnDiscount,
              returnDiscountAmount: isReturnTripBooking ? Math.round(baseAmount * (returnDiscount / 100)) : 0,
              originalAmount: isReturnTripBooking ? baseAmount * 2 : baseAmount,
              segments: finalSegments.map((s) => ({
                scheduleId: s.scheduleId, date: s.date,
                originStopId: s.originStopId, destinationStopId: s.destinationStopId,
              })),
            },
            bookingDate: new Date(),
          },
        });

        for (const segment of pricedSegments) {
          await tx.bookingSegment.create({
            data: {
              bookingId: booking.id, companyId,
              scheduleId: segment.scheduleId, segmentIndex: segment.segmentIndex,
              date: segment.date ? new Date(segment.date) : new Date(segment.schedule.departureDateTime),
              seatNumbers: segment.seatNumbers as any, passengerCount,
              price: segment.fare, currency: 'MWK',
              originStopId: segment.originStopId ?? undefined,
              destinationStopId: segment.destinationStopId ?? undefined,
              metadata: { fareSource: segment.fareSource },
            },
          });

          const txRow = await tx.schedule.findUnique({ where: { id: segment.scheduleId } });
          if (!txRow) throw new Error('Schedule not found during booking update');

          const existingBooked = Array.isArray(txRow.bookedSeats)
            ? txRow.bookedSeats.filter((s): s is string => typeof s === 'string') : [];
          const updatedBooked = Array.from(new Set([
            ...existingBooked,
            ...(Array.isArray(segment.seatNumbers) ? segment.seatNumbers : []),
          ]));

          await tx.schedule.update({
            where: { id: segment.scheduleId },
            data: { availableSeats: { decrement: passengerCount }, bookedSeats: updatedBooked as any },
          });
        }

        return booking;
      },
      {
        timeout: 20000,
        maxWait: 30000,
      }
    );
  } catch (error: any) {
    const message = error?.message || '';
    if (/expired transaction|timeout/i.test(message)) {
      return { error: 'Booking creation timed out while saving your trip. Please try again in a moment.' };
    }
    throw error;
  }

  // ── Post-transaction side effects ──────────────────────────────────────────
  serverCache.invalidate('schedules');

  try {
    await sendNotificationToUser(userData.id, {
      title: 'Booking created',
      body: `Your booking ${bookingReference} for ${routeData?.name ?? 'your trip'} is pending payment.`,
      type: 'booking', priority: 'high',
      clickAction: `/bookings/${result.id}`,
      data: { bookingId: result.id, scheduleId: finalSegments[0].scheduleId, companyId },
    });

    await notifyCompanyStaff(companyId, {
      title: 'New Booking Created 🚌',
      body: `A new booking (${bookingReference}) was created for ${routeData?.name ?? 'a route'}. Awaiting payment.`,
      type: 'system', priority: 'medium',
      clickAction: `/company/admin?tab=bookings`,
      data: { bookingId: result.id }
    });
  } catch (sendError) {
    console.warn('[createBookingFull] Notification send failed:', sendError);
  }

  const isSegmentRoute = pricedSegments.some((s) =>
    !!s.originStopId && !!s.destinationStopId &&
    (s.originStopId !== '__origin__' || s.destinationStopId !== '__destination__'),
  );

  await logger.logBooking('created', result.id, {
    userId: userData.id, companyId,
    scheduleId: finalSegments[0].scheduleId,
    metadata: { bookingReference, totalAmount, fareSource, isSegment: isSegmentRoute },
  });

  revalidatePath('/bookings');

  return {
    bookingId: result.id, bookingReference, totalAmount, discountAmount,
    appliedPromo, baseFare: pricedSegments[0]?.fare ?? 0,
    fullTripFare, fareSource, currency: 'MWK', isSegment: isSegmentRoute,
  };
}



/**
 * --- Bookings ---
 */
export async function getBookingsForSchedule(scheduleId: string) {
  try {
    const bookings = await prisma.booking.findMany({
      where: { scheduleId },
      include: {
        schedule: {
          include: {
            route: true,
            bus: true
          }
        },
        user: true
      }
    });
    return { success: true, data: bookings as any[] };
  } catch (error: unknown) {
    console.error('Error fetching bookings for schedule:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function createBooking(data: Partial<Booking> & {
  bookingReference: string;
  scheduleId: string;
  companyId: string;
  routeId: string;
  totalAmount: number;
  passengerDetails: any[];
  seatNumbers: string[];
  contactEmail?: string;
  contactPhone: string;
}) {
  try {
    const booking = await prisma.booking.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        bookingReference: data.bookingReference,
        totalAmount: data.totalAmount,
        currency: data.currency || 'MWK',
        bookingStatus: data.bookingStatus || 'pending',
        paymentStatus: data.paymentStatus || 'pending',
        passengerDetails: data.passengerDetails as any,
        seatNumbers: data.seatNumbers as any,
        contactEmail: data.contactEmail || '',
        contactPhone: data.contactPhone,
        bookingDate: data.bookingDate ? new Date(data.bookingDate) : new Date(),
        routeId: data.routeId,
        
        // Relations using connect
        company: { connect: { id: data.companyId } },
        schedule: { connect: { id: data.scheduleId } },
        user: { connect: { id: data.userId || (data as any).bookedBy || data.companyId } }, // Fallback for walk-on

        // Walk-on specific fields
        ...((data as any).isWalkOn !== undefined ? { isWalkOn: (data as any).isWalkOn } : {}),
        ...((data as any).bookedBy !== undefined ? { bookedBy: (data as any).bookedBy } : {}),
        ...((data as any).originStopId !== undefined ? { originStopId: (data as any).originStopId } : {}),
        ...((data as any).destinationStopId !== undefined ? { destinationStopId: (data as any).destinationStopId } : {}),
        ...((data as any).paidAt !== undefined ? { paidAt: (data as any).paidAt } : {}),
        
        ...((data as any).paymentMethod !== undefined ? {
          payments: {
            create: [{
              paymentId: `PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
              amount: data.totalAmount || 0,
              currency: data.currency || 'MWK',
              paymentType: (data as any).paymentMethod,
              provider: (data as any).paymentMethod,
              status: data.paymentStatus || 'pending',
              txRef: `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            }]
          }
        } : {}),
      },
      include: { payments: true }
    });
    revalidatePath('/bookings');
    revalidatePath('/company/conductor/dashboard');
    revalidatePath('/company/admin');
    return { success: true, data: (booking as any) as Booking };
  } catch (error: unknown) {
    console.error('Error creating booking:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateBooking(id: string, data: Partial<Booking>) {
  try {
    const oldBooking = await prisma.booking.findUnique({ where: { id }, select: { bookingStatus: true, userId: true, bookingReference: true } });
    
    const { id: _, createdAt, updatedAt, ...updatableData } = data;
    const booking = await prisma.booking.update({
      where: { id },
      data: {
        ...(updatableData as any),
        paidAt: updatableData.paidAt ? new Date(updatableData.paidAt) : undefined,
        updatedAt: new Date(),
        ...((updatableData as any).paymentMethod !== undefined ? {
          payments: {
            create: [{
              paymentId: `PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
              amount: 0,
              currency: 'MWK',
              paymentType: (updatableData as any).paymentMethod,
              provider: (updatableData as any).paymentMethod,
              status: updatableData.paymentStatus || 'paid',
              txRef: `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            }]
          }
        } : {}),
      },
      include: { payments: true }
    });

    if (oldBooking && oldBooking.userId) {
      if (data.bookingStatus === 'confirmed' && oldBooking.bookingStatus !== 'confirmed') {
        await sendNotificationToUser(oldBooking.userId, {
          title: 'Booking Confirmed ✅',
          body: `Your booking ${oldBooking.bookingReference} has been confirmed. Have a safe trip!`,
          type: 'booking',
          clickAction: `/bookings?ref=${oldBooking.bookingReference}`,
          priority: 'high'
        });
      } else if (data.bookingStatus === 'cancelled' && oldBooking.bookingStatus !== 'cancelled') {
        await sendNotificationToUser(oldBooking.userId, {
          title: 'Booking Cancelled ❌',
          body: `Your booking ${oldBooking.bookingReference} has been cancelled.`,
          type: 'cancellation',
          clickAction: `/bookings`,
          priority: 'medium'
        });
      }
    }

    revalidatePath('/bookings');
    revalidatePath('/company/conductor/dashboard');
    revalidatePath('/company/admin');
    return { success: true, data: (booking as any) as Booking };
  } catch (error: unknown) {
    console.error('Error updating booking:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function cancelBooking(bookingId: string, scheduleId: string, seatNumbers: string[]) {
  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Update booking status
      const booking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          bookingStatus: 'cancelled',
          cancellationDate: new Date(),
        },
      });

      // 2. Release seats in schedule
      await tx.schedule.update({
        where: { id: scheduleId },
        data: {
          availableSeats: { increment: seatNumbers.length },
        },
      });

      return booking;
    });

    revalidatePath('/bookings');
    revalidatePath('/admin');
    return { success: true, data: result };
  } catch (error: unknown) {
    console.error('Error cancelling booking:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteBooking(id: string) {
  try {
    await prisma.booking.delete({ where: { id } });
    revalidatePath('/bookings');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting booking:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getUserBookings(userId: string) {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: userId },
      include: {
        schedule: {
          include: {
            route: true,
            bus: true
          }
        },
        company: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    return { success: true, data: bookings as unknown[] };
  } catch (error: unknown) {
    console.error('Error fetching user bookings:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * --- Seat Reservations ---
 */
export async function createSeatReservation(data: {
  scheduleId: string;
  userId: string;
  seatNumbers: string[];
  status?: string;
}) {
  try {
    const reservation = await (prisma as unknown as {
      seatReservation: { create: (o: object) => Promise<unknown> }
    }).seatReservation.create({
      data: {
        scheduleId: data.scheduleId,
        userId: data.userId,
        seatNumbers: data.seatNumbers,
        status: data.status || 'reserved',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 mins default
      },
    });
    return { success: true, data: reservation };
  } catch (error: unknown) {
    console.error('Error creating reservation:', error);
    return { success: false, error: (error as Error).message };
  }
}
