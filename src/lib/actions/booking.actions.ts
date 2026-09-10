'use server'

import prisma from '../prisma';
import { Prisma, type Prisma as PrismaTypes } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { Booking, BookingStatus } from '@/types';
import { createClient } from '@/utils/supabase/server';
import { parseUtcDate } from '@/lib/timezone';
import { getCurrentUserFromServer } from '@/lib/auth-utils';
import { logger } from '@/lib/logger';
import { invalidateScheduleCaches } from '@/lib/cache';
import { sendNotificationToUser, notifyCompanyStaff } from '@/lib/notificationService';
import { calculateSegmentFare } from '@/lib/segment-fare';
import { createSegmentBookingCore } from '@/lib/segment-booking-core';

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
  let authUser = await getCurrentUserFromServer();
  if (!authUser) {
    const supabase = await createClient();
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (supabaseUser) {
      authUser = { id: supabaseUser.id, email: supabaseUser.email };
    }
  }

  if (!authUser) return { error: 'Unauthorized' };

  const userId = authUser.id;
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
  }

  for (let i = 1; i < finalSegments.length; i++) {
    const prevSchedule = scheduleMap.get(finalSegments[i - 1].scheduleId);
    const currSchedule = scheduleMap.get(finalSegments[i].scheduleId);
    if (prevSchedule && currSchedule) {
      const prevArrival = new Date(prevSchedule.arrivalDateTime).getTime();
      const currDeparture = new Date(currSchedule.departureDateTime).getTime();
      if (currDeparture < prevArrival) {
        return { error: 'Return departure must be after outbound bus arrives' };
      }
    }
  }

  // ── Pricing ────────────────────────────────────────────────────────────────
  const pricedSegments = finalSegments.map((segment, idx) => {
    const cs = scheduleMap.get(segment.scheduleId)!;
    const { fare, fareSource } = calculateSegmentFare(cs, routeData, segment.originStopId, segment.destinationStopId);
    return { ...segment, schedule: cs, fare, fareSource, segmentIndex: idx };
  });

  const isRoundTrip = Boolean(returnDate) || finalSegments.length > 1;
  const combinedGrossTotal = pricedSegments.reduce((sum, s) => sum + s.fare * passengerCount, 0);

  let returnTripDiscountPercent = 0;
  let returnTripDiscountAmount = 0;

  if (isRoundTrip && pricedSegments.length > 0) {
    const returnSegment = pricedSegments[pricedSegments.length - 1];
    const returnSchedule = returnSegment.schedule;
    const returnCompany = returnSchedule.company;

    const rawDiscount = (returnCompany as any)?.returnTripDiscountPercent ?? Number((returnCompany?.paymentSettings as any)?.returnDiscount) ?? 0;
    if (typeof rawDiscount === 'number' && rawDiscount > 0 && rawDiscount <= 100) {
      returnTripDiscountPercent = rawDiscount;
      returnTripDiscountAmount = Math.round(combinedGrossTotal * (returnTripDiscountPercent / 100));
    }
  }

  let totalAmount = Math.max(0, combinedGrossTotal - returnTripDiscountAmount);

  let promoDiscountAmount = 0;
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
          promoDiscountAmount = (totalAmount * promotion.discountValue) / 100;
          if (promotion.maxDiscount && promoDiscountAmount > promotion.maxDiscount) promoDiscountAmount = promotion.maxDiscount;
        } else {
          promoDiscountAmount = promotion.discountValue;
        }
        promoDiscountAmount = Math.min(promoDiscountAmount, totalAmount);
        totalAmount -= promoDiscountAmount;
        appliedPromo = { code: promotion.code, discount: promoDiscountAmount, title: promotion.title };
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

  // Delegate transactional seat/segment persistence to the new core. The core performs
  // interval-overlap checking, creates Booking + BookingSegment rows, recomputes occupancy,
  // and may create a payment row when provided. We preserve all pre-transaction pricing,
  // promo and discount logic above and pass totalAmount to the core so notifications and
  // post-transaction side-effects remain identical.

  let result;
  try {
    result = await prisma.$transaction(async (tx: PrismaTypes.TransactionClient) => {
      const coreInput = {
        booking: {
          bookingReference,
          userId: userData.id,
          companyId,
          scheduleId: finalSegments[0].scheduleId,
          routeId,
          discountPercent: returnTripDiscountPercent,
          discountAmount: returnTripDiscountAmount,
          currency: 'MWK',
          contactEmail: userData?.email ?? '',
          contactPhone: userData?.phone ?? '',
          bookingStatus: 'pending',
          paymentStatus: 'pending',
          passengerDetails: normalisedPassengers as any,
          originStopId: topOriginStopId ?? undefined,
          destinationStopId: topDestinationStopId ?? undefined,
          returnDate: returnDate ? new Date(returnDate) : undefined,
          metadata: {
            ...(returnDate ? { returnDate } : {}),
            discountPercent: returnTripDiscountPercent,
            discountAmount: returnTripDiscountAmount,
            grossAmount: combinedGrossTotal,
            segments: finalSegments.map((s) => ({ scheduleId: s.scheduleId, date: s.date, originStopId: s.originStopId, destinationStopId: s.destinationStopId })),
          },
          bookingDate: new Date(),
        } as any,
        segments: finalSegments.map((s, idx) => ({ ...s, segmentIndex: idx })),
        passengerCount,
        fareMode: 'segment' as const,
        totalAmount,
        payment: undefined,
      };

      return await createSegmentBookingCore(tx as any, coreInput as any);
    }, { timeout: 25000, maxWait: 5000 });
  } catch (error: any) {
    const message = error?.message || '';
    if (/^Not enough seats remaining$|^Seat\(s\) already booked:|^Seat .+ is already occupied on an overlapping segment$/i.test(message)) {
      return { error: message };
    }
    if (/expired transaction|timeout|unable to start a transaction in the given time/i.test(message)) {
      return { error: 'Booking creation timed out while saving your trip. Please try again in a moment.' };
    }
    throw error;
  }

  // ── Post-transaction side effects (non-blocking) ───────────────────────────
  invalidateScheduleCaches();

  // Dispatch notifications in background so booking response is instant (< 100ms)
  Promise.allSettled([
    sendNotificationToUser(userData.id, {
      title: 'Booking created',
      body: `Your booking ${bookingReference} for ${routeData?.name ?? 'your trip'} is pending payment.`,
      type: 'booking', priority: 'high',
      clickAction: `/bookings/${result.booking.id}`,
      data: { bookingId: result.booking.id, scheduleId: finalSegments[0].scheduleId, companyId },
    }),
    notifyCompanyStaff(companyId, {
      title: 'New Booking Created 🚌',
      body: `A new booking (${bookingReference}) was created for ${routeData?.name ?? 'a route'}. Awaiting payment.`,
      type: 'system', priority: 'medium',
      clickAction: `/company/admin?tab=bookings`,
      data: { bookingId: result.booking.id }
    }),
  ]).catch((sendError) => {
    console.warn('[createBookingFull] Notification send failed:', sendError);
  });

  const isSegmentRoute = finalSegments.some((s) =>
    !!s.originStopId && !!s.destinationStopId &&
    (s.originStopId !== '__origin__' || s.destinationStopId !== '__destination__'),
  );

  await logger.logBooking('created', result.booking.id, {
    userId: userData.id, companyId,
    scheduleId: finalSegments[0].scheduleId,
    metadata: { bookingReference, totalAmount, fareSource, isSegment: isSegmentRoute },
  });

  revalidatePath('/bookings');

  return {
    bookingId: result.booking.id, bookingReference, totalAmount, discountAmount: returnTripDiscountAmount + promoDiscountAmount,
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
        route: data.routeId ? { connect: { id: data.routeId } } : undefined,
        
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

    invalidateScheduleCaches();

    try { revalidatePath('/bookings'); } catch (_) {}
    try { revalidatePath('/company/conductor/dashboard'); } catch (_) {}
    try { revalidatePath('/company/admin'); } catch (_) {}
    return { success: true, data: (booking as any) as Booking };
  } catch (error: unknown) {
    console.error('Error creating booking:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function createWalkOnBooking(data: Partial<Booking> & {
  bookingReference?: string;
  scheduleId: string;
  companyId: string;
  routeId: string;
  totalAmount: number;
  passengerDetails: any[];
  seatNumbers: string[];
  originStopId?: string;
  destinationStopId?: string;
  contactPhone?: string;
  contactEmail?: string;
}) {
  const authUser = await getCurrentUserFromServer();
  if (!authUser) return { success: false, error: 'Unauthorized' };
  if (!['super_admin', 'superadmin', 'chief_of_operations', 'company_admin', 'conductor'].includes(authUser.role ?? '')) {
    return { success: false, error: 'Forbidden' };
  }

  const schedule = await prisma.schedule.findUnique({ where: { id: data.scheduleId } });
  if (!schedule) return { success: false, error: 'Schedule not found' };
  if (authUser.role === 'company_admin' && schedule.companyId !== authUser.companyId) {
    return { success: false, error: 'Forbidden: schedule does not belong to your company' };
  }
  if (authUser.role === 'conductor') {
    const conductor = await prisma.operator.findUnique({
      where: { uid: authUser.id },
      select: { id: true, companyId: true },
    });
    if (!conductor || conductor.companyId !== authUser.companyId) {
      return { success: false, error: 'Forbidden: conductor record does not belong to your company' };
    }

    if (schedule.conductorId) {
      if (schedule.conductorId !== conductor.id) {
        return { success: false, error: 'Forbidden: not assigned to this schedule' };
      }
    } else {
      const bus = await prisma.bus.findUnique({
        where: { id: schedule.busId },
        select: { conductorIds: true, companyId: true },
      });
      if (!bus || bus.companyId !== authUser.companyId || !bus.conductorIds.includes(authUser.id)) {
        return { success: false, error: 'Forbidden: not assigned to this schedule\'s bus' };
      }
    }
  }

  const passengerCount = data.passengerDetails.length;
  try {
    const result = await prisma.$transaction(async (tx: PrismaTypes.TransactionClient) => {
      const bookingRef = data.bookingReference ?? generateBookingReference();
      const coreInput = {
        booking: {
          bookingReference: bookingRef,
          userId: authUser.id,
          companyId: data.companyId,
          routeId: data.routeId,
          bookingStatus: 'confirmed',
          paymentStatus: 'paid',
          passengerDetails: data.passengerDetails as any,
          originStopId: data.originStopId,
          destinationStopId: data.destinationStopId,
          bookingDate: new Date(),
          isWalkOn: true,
          bookedBy: authUser.id,
          paidAt: new Date(),
        } as any,
        segments: [{ scheduleId: data.scheduleId, seatNumbers: data.seatNumbers, originStopId: data.originStopId, destinationStopId: data.destinationStopId }],
        passengerCount,
        fareMode: 'segment' as const,
        totalAmount: data.totalAmount,
        payment: {
          paymentId: `PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          amount: data.totalAmount || 0,
          currency: 'MWK',
          customerEmail: data.contactEmail,
          customerPhone: data.contactPhone,
          paymentType: 'cash',
          provider: 'manual',
          status: 'paid',
          txRef: `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        },
      } as any;

      return await createSegmentBookingCore(tx as any, coreInput as any);
    }, { timeout: 25000, maxWait: 5000 });

    invalidateScheduleCaches();
    try { revalidatePath('/company/conductor/dashboard'); } catch {};
    return { success: true, data: result.booking };
  } catch (error: unknown) {
    console.error('Error creating walk-on booking:', error);
    const message = error instanceof Error ? error.message : String(error);
    if (/^Seat .+ is already occupied on an overlapping segment$/i.test(message)) {
      return { success: false, error: message };
    }
    return { success: false, error: message };
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

export async function cancelBooking(bookingId: string, scheduleId?: string, seatNumbers?: string[]) {
  try {
    const result = await prisma.$transaction(async (tx: PrismaTypes.TransactionClient) => {
      // 1. Fetch booking with segments and schedule to release seats and enforce 2-hour refund policy
      const existingBooking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { segments: true, schedule: true, chatterSchedule: true },
      });

      if (!existingBooking) {
        throw new Error('Booking not found');
      }

      const travelDate = existingBooking.schedule?.departureDateTime ?? existingBooking.chatterSchedule?.travelDate;
      if (travelDate) {
        const dep = travelDate instanceof Date ? travelDate : parseUtcDate(travelDate as any);
        const depTime = dep.getTime();
        const timeUntilDep = depTime - Date.now();
        if (timeUntilDep < 2 * 60 * 60 * 1000) {
          throw new Error('Bookings cannot be cancelled or refunded within 2 hours of scheduled departure time as per TibhukeBus policy.');
        }
      }

      // 2. Update booking status
      const booking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          bookingStatus: 'cancelled',
          cancellationDate: new Date(),
        },
      });

      // 3. Build target schedule releases
      const releases: Array<{ scheduleId: string; seatNumbers: string[] }> = [];

      if (Array.isArray(existingBooking.segments) && existingBooking.segments.length > 0) {
        for (const seg of existingBooking.segments) {
          const sns = parseSeatArray(seg.seatNumbers);
          releases.push({ scheduleId: seg.scheduleId, seatNumbers: sns });
        }
      } else {
        const targetSchedId = scheduleId || existingBooking.scheduleId;
        const targetSeats = seatNumbers && seatNumbers.length > 0 ? seatNumbers : parseSeatArray(existingBooking.seatNumbers);
        if (targetSchedId) {
          releases.push({ scheduleId: targetSchedId, seatNumbers: targetSeats });
        }
      }

      // 4. Release seats and update bookedSeats on each schedule
      for (const rel of releases) {
        if (!rel.scheduleId || rel.seatNumbers.length === 0) continue;
        const sched = await tx.schedule.findUnique({ where: { id: rel.scheduleId } });
        if (!sched) continue;

        const currentBooked = parseSeatArray(sched.bookedSeats);
        const updatedBooked = currentBooked.filter((s) => !rel.seatNumbers.includes(s));

        await tx.schedule.update({
          where: { id: rel.scheduleId },
          data: {
            availableSeats: { increment: rel.seatNumbers.length },
            bookedSeats: updatedBooked as any,
          },
        });
      }

      return booking;
    });

    try {
      revalidatePath('/bookings');
      revalidatePath('/admin');
    } catch {
      // Safe fallback when executed in non-Next.js context (e.g. background tasks or unit tests)
    }
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
        chatterSchedule: true,
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
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 mins default
      },
    });
    return { success: true, data: reservation };
  } catch (error: unknown) {
    console.error('Error creating reservation:', error);
    return { success: false, error: (error as Error).message };
  }
}
