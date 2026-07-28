import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';
import { apiRateLimiter, getClientIp } from '@/lib/rateLimit';

const SEAT_HOLD_DURATION = 5 * 60 * 1000; // 5 minutes

function parseSeatNumbers(value: unknown): string[] {
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

class ReservationError extends Error {
  status: number;
  payload: any;

  constructor(status: number, payload: any) {
    super(typeof payload === 'string' ? payload : payload.error || 'Reservation error');
    this.status = status;
    this.payload = payload;
  }
}

/**
 * POST /api/bookings/reserve-seats
 * Reserve seats for a user atomically with row locking to prevent double-booking
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const user = await getCurrentUser(req);
    const rateLimitKey = user?.id ? `${ip}:${user.id}` : ip;
    const { success, reset } = await apiRateLimiter.limit(rateLimitKey);
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter > 0 ? retryAfter : 60) } }
      );
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { scheduleId } = body;
    const seatNumbers = parseSeatNumbers(body.seatNumbers);

    if (!scheduleId || seatNumbers.length === 0) {
      return NextResponse.json(
        { error: 'Missing requirements: scheduleId and seatNumbers array' },
        { status: 400 }
      );
    }

    // Get user and verify role
    const userRecord = await prisma.user.findFirst({
      where: {
        OR: [
          { id: user.id },
          { uid: user.id },
        ],
      },
    });

    if (!userRecord) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    if (userRecord.role !== 'customer') {
      const labels: Record<string, string> = {
        operator: 'Bus Operator',
        conductor: 'Bus Conductor',
        company_admin: 'Company Administrator',
        superadmin: 'Super Administrator',
      };
      return NextResponse.json(
        {
          error: 'Access Denied',
          message: `You are logged in as a ${labels[userRecord.role] || userRecord.role}. Only customer accounts can book bus tickets. Please log out and create a customer account to book tickets.`,
        },
        { status: 403 }
      );
    }

    // Execute atomic reservation transaction with per-seat non-blocking transactional advisory locks
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Try to acquire per-seat non-blocking transactional advisory lock for each requested seat.
        // If another user is currently in the middle of reserving the exact same seat, fail immediately with 400.
        // Two users requesting DIFFERENT seats proceed concurrently in parallel (0s lock wait).
        const sortedSeatNumbers = [...seatNumbers].sort();
        for (const seat of sortedSeatNumbers) {
          const lockKey = `${scheduleId}:${seat}`;
          const res = await tx.$queryRaw<[{ locked: boolean }]>`
            SELECT pg_try_advisory_xact_lock(hashtext(${lockKey})) as locked
          `;
          if (!res || !res[0] || !res[0].locked) {
            throw new ReservationError(400, {
              error: 'One or more seats are currently being reserved by another customer',
              conflictingSeats: [seat],
            });
          }
        }

        // 2. Fetch schedule along with active non-expired reservations in a single query
        const schedule = await tx.schedule.findUnique({
          where: { id: scheduleId },
          include: {
            bus: true,
            reservations: {
              where: {
                status: 'reserved',
                expiresAt: { gt: new Date() },
              },
            },
          },
        });

        if (!schedule) {
          throw new ReservationError(404, { error: 'Schedule not found' });
        }

        // 3. Check requested seat numbers against bus total capacity limit
        const busCapacity = schedule.bus?.capacity || 60;
        const invalidSeats = seatNumbers.filter(s => {
          const num = parseInt(s, 10);
          return isNaN(num) || num <= 0 || num > busCapacity;
        });

        if (invalidSeats.length > 0) {
          throw new ReservationError(400, {
            error: 'One or more requested seat numbers exceed bus capacity',
            invalidSeats,
          });
        }

        // 4. Check if seats are already permanently booked (direct + segment bookings)
        const [activeDirectBookings, activeSegmentBookings] = await Promise.all([
          tx.booking.findMany({
            where: { scheduleId, bookingStatus: { not: 'cancelled' } },
            select: { seatNumbers: true },
          }),
          tx.bookingSegment.findMany({
            where: { scheduleId, booking: { bookingStatus: { not: 'cancelled' } } },
            select: { seatNumbers: true },
          }),
        ]);

        const staticBookedSeats = parseSeatNumbers(schedule.bookedSeats);
        const allBookedSeatsSet = new Set<string>([
          ...staticBookedSeats,
          ...activeDirectBookings.flatMap((b) => parseSeatNumbers(b.seatNumbers)),
          ...activeSegmentBookings.flatMap((s) => parseSeatNumbers(s.seatNumbers)),
        ]);

        const conflictingBookedSeats = seatNumbers.filter((seat) => allBookedSeatsSet.has(seat));

        if (conflictingBookedSeats.length > 0) {
          throw new ReservationError(400, {
            error: 'One or more seats are already booked',
            conflictingSeats: conflictingBookedSeats,
          });
        }

        // 5. Check for active temporary reservations on the same schedule by other users
        const activeReservations = schedule.reservations || [];
        const targetUserId = userRecord.id;
        const otherReservations = activeReservations.filter((r: any) => r.userId !== targetUserId && r.userId !== user.id);
        const reservedSeats = otherReservations.flatMap((reservation: any) =>
          parseSeatNumbers(reservation.seatNumbers)
        );

        const conflictingReservedSeats = seatNumbers.filter((seat) => reservedSeats.includes(seat));
        if (conflictingReservedSeats.length > 0) {
          throw new ReservationError(400, {
            error: 'One or more seats are already reserved by another customer',
            conflictingSeats: conflictingReservedSeats,
          });
        }

        // 6. Explicit atomic capacity check: total occupied (booked + reserved) vs bus capacity
        const busCap = schedule.bus?.capacity || 40;
        const totalOccupiedCount = allBookedSeatsSet.size + reservedSeats.length;
        const effectiveAvailable = Math.max(0, busCap - totalOccupiedCount);
        if (effectiveAvailable < seatNumbers.length) {
          throw new ReservationError(400, {
            error: 'Not enough seats available on this schedule',
            available: Math.max(0, effectiveAvailable),
            requested: seatNumbers.length,
          });
        }

        // 6. Delete existing reservations for this user and schedule
        await tx.seatReservation.deleteMany({
          where: {
            scheduleId,
            OR: [
              { userId: targetUserId },
              { userId: user.id },
            ],
          },
        });

        // 7. Create new seat reservation
        const expiresAt = new Date(Date.now() + SEAT_HOLD_DURATION);
        const reservation = await tx.seatReservation.create({
          data: {
            scheduleId,
            userId: targetUserId,
            seatNumbers,
            status: 'reserved',
            expiresAt,
          },
        });

        return reservation;
      },
      {
        maxWait: 10000,
        timeout: 15000,
      }
    );

    return NextResponse.json(
      {
        reservationId: result.id,
        expiresAt: result.expiresAt,
        holdDurationMinutes: 5,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof ReservationError) {
      return NextResponse.json(error.payload, { status: error.status });
    }
    console.error('POST /api/bookings/reserve-seats error:', error);
    return NextResponse.json(
      { error: 'Failed to reserve seats' },
      { status: 500 }
    );
  }
}

