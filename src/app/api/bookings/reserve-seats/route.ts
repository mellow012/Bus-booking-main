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

    // Execute atomic reservation transaction with row-locking (FOR UPDATE)
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Acquire pessimistic lock on the Schedule row to serialize concurrent reservations for this schedule
        const locked: any[] = await tx.$queryRaw`
          SELECT "id" FROM "Schedule" WHERE "id" = ${scheduleId} FOR UPDATE
        `;

        if (!locked || locked.length === 0) {
          throw new ReservationError(404, { error: 'Schedule not found' });
        }

        // 2. Clean up expired stale reservations for this schedule
        await tx.seatReservation.deleteMany({
          where: {
            scheduleId,
            expiresAt: { lt: new Date() },
          },
        });

        // 3. Fetch schedule within the transaction
        const schedule = await tx.schedule.findUnique({
          where: { id: scheduleId },
        });

        if (!schedule) {
          throw new ReservationError(404, { error: 'Schedule not found' });
        }

        // 4. Check available seat count
        if (schedule.availableSeats < seatNumbers.length) {
          throw new ReservationError(400, {
            error: 'Not enough seats available',
            available: schedule.availableSeats,
            requested: seatNumbers.length,
          });
        }

        // 5. Check if seats are already permanently booked
        const bookedSeats = Array.isArray(schedule.bookedSeats) ? (schedule.bookedSeats as string[]) : [];
        const conflictingBookedSeats = seatNumbers.filter(seat => bookedSeats.includes(seat));

        if (conflictingBookedSeats.length > 0) {
          throw new ReservationError(400, {
            error: 'One or more seats are already booked',
            conflictingSeats: conflictingBookedSeats,
          });
        }

        // 6. Check for active temporary reservations on the same schedule
        const activeReservations = await tx.seatReservation.findMany({
          where: {
            scheduleId,
            status: 'reserved',
            expiresAt: { gt: new Date() },
          },
        });

        const otherReservations = activeReservations.filter((r: any) => r.userId !== user.id);
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

        // 7. Delete existing reservations for this user and schedule
        await tx.seatReservation.deleteMany({
          where: {
            scheduleId,
            userId: user.id,
          },
        });

        // 8. Create new seat reservation
        const expiresAt = new Date(Date.now() + SEAT_HOLD_DURATION);
        const reservation = await tx.seatReservation.create({
          data: {
            scheduleId,
            userId: user.id,
            seatNumbers,
            status: 'reserved',
            expiresAt,
          },
        });

        return reservation;
      },
      {
        timeout: 5000,
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

