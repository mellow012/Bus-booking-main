// Updated for interval-aware SERIALIZABLE locking
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';
import { apiRateLimiter, getClientIp } from '@/lib/rateLimit';
import { Prisma } from '@prisma/client';

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
 * Reserve seats for a user under SERIALIZABLE isolation level with interval-aware overlap checks.
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
    const { scheduleId, originStopId, destinationStopId } = body;
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

    // Retry loop specifically for Postgres 40001 / Prisma P2034 serialization_failure
    let reservationResult: any = null;
    let attempt = 0;
    const maxAttempts = 15;

    while (attempt < maxAttempts) {
      try {
        attempt++;
        reservationResult = await prisma.$transaction(
          async (tx) => {
            // 0. Acquire per-seat advisory locks for each requested seat in deterministic (sorted) order
            // Using 2-argument Postgres advisory lock: key1 = scheduleId hash, key2 = seat hash.
            // This ensures concurrent users reserving different seats run in parallel without predicate lock storms,
            // while concurrent users requesting the same seat on the same schedule are serialized cleanly.
            const sortedSeatNumbers = [...seatNumbers].sort();
            for (const seat of sortedSeatNumbers) {
              await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scheduleId}), hashtext(${seat}))`;
            }

            // 1. Fetch schedule and route to determine stop timeline indices
            const schedule = await tx.schedule.findUnique({
              where: { id: scheduleId },
              include: {
                bus: true,
                route: true,
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

            // Determine route stop indices
            const routeStops: any[] = Array.isArray(schedule.route?.stops) ? (schedule.route.stops as any[]) : [];
            const sortedStops = [...routeStops].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            const stopTimeline = [
              { id: '__origin__', order: -1 },
              ...sortedStops,
              { id: '__destination__', order: 9999 },
            ];

            const reqOriginIdx = stopTimeline.findIndex((s) => s.id === (originStopId || '__origin__'));
            const reqDestIdx = stopTimeline.findIndex((s) => s.id === (destinationStopId || '__destination__'));

            const userO = reqOriginIdx !== -1 ? reqOriginIdx : 0;
            const userD = reqDestIdx !== -1 ? reqDestIdx : stopTimeline.length - 1;

            // 2. Validate seat numbers against bus capacity
            const busCapacity = schedule.bus?.capacity || 60;
            const invalidSeats = seatNumbers.filter((s) => {
              const num = parseInt(s, 10);
              return isNaN(num) || num <= 0 || num > busCapacity;
            });

            if (invalidSeats.length > 0) {
              throw new ReservationError(400, {
                error: 'One or more requested seat numbers exceed bus capacity',
                invalidSeats,
              });
            }

            // 3. Query existing non-cancelled BookingSegments for this schedule
            const activeSegments = await tx.bookingSegment.findMany({
              where: {
                scheduleId,
                booking: { bookingStatus: { in: ['pending', 'confirmed', 'completed'] } },
              },
              select: {
                seatNumbers: true,
                originStopId: true,
                destinationStopId: true,
              },
            });

            // 4. Check for overlapping interval conflicts on existing bookings
            const conflictingBookedSeats: string[] = [];
            for (const seg of activeSegments) {
              const segSeats = parseSeatNumbers(seg.seatNumbers);
              const matchingSeats = seatNumbers.filter((s) => segSeats.includes(s));
              if (matchingSeats.length === 0) continue;

              const segOIdx = stopTimeline.findIndex((s) => s.id === (seg.originStopId || '__origin__'));
              const segDIdx = stopTimeline.findIndex((s) => s.id === (seg.destinationStopId || '__destination__'));
              const segO = segOIdx !== -1 ? segOIdx : 0;
              const segD = segDIdx !== -1 ? segDIdx : stopTimeline.length - 1;

              // Overlap condition: max(O1, O2) < min(D1, D2)
              if (Math.max(userO, segO) < Math.min(userD, segD)) {
                conflictingBookedSeats.push(...matchingSeats);
              }
            }

            if (conflictingBookedSeats.length > 0) {
              throw new ReservationError(400, {
                error: 'One or more seats are already booked for your selected travel interval',
                conflictingSeats: Array.from(new Set(conflictingBookedSeats)),
              });
            }

            // 5. Check for active temporary reservations by other users for overlapping travel intervals
            const targetUserId = userRecord.id;
            const activeReservations = schedule.reservations || [];
            const otherReservations = activeReservations.filter(
              (r: any) => r.userId !== targetUserId && r.userId !== user.id
            );

            const conflictingReservedSeats: string[] = [];
            for (const res of otherReservations) {
              const resSeats = parseSeatNumbers(res.seatNumbers);
              const matchingSeats = seatNumbers.filter((s) => resSeats.includes(s));
              if (matchingSeats.length === 0) continue;

              const resOIdx = stopTimeline.findIndex((s) => s.id === ((res as any).originStopId || '__origin__'));
              const resDIdx = stopTimeline.findIndex((s) => s.id === ((res as any).destinationStopId || '__destination__'));
              const resO = resOIdx !== -1 ? resOIdx : 0;
              const resD = resDIdx !== -1 ? resDIdx : stopTimeline.length - 1;

              if (Math.max(userO, resO) < Math.min(userD, resD)) {
                conflictingReservedSeats.push(...matchingSeats);
              }
            }

            if (conflictingReservedSeats.length > 0) {
              throw new ReservationError(400, {
                error: 'One or more seats are already reserved by another customer for your selected travel interval',
                conflictingSeats: Array.from(new Set(conflictingReservedSeats)),
              });
            }

            // 6. Delete existing reservations for this user and schedule
            await tx.seatReservation.deleteMany({
              where: {
                scheduleId,
                OR: [{ userId: targetUserId }, { userId: user.id }],
              },
            });

            // 7. Create new seat reservation
            const expiresAt = new Date(Date.now() + SEAT_HOLD_DURATION);
            const reservation = await tx.seatReservation.create({
              data: {
                scheduleId,
                userId: targetUserId,
                seatNumbers,
                originStopId: originStopId || '__origin__',
                destinationStopId: destinationStopId || '__destination__',
                status: 'reserved',
                expiresAt,
              },
            });

            return reservation;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            maxWait: 30000,
            timeout: 60000,
          }
        );

        // Success! Break retry loop
        break;
      } catch (error: any) {
        if (error instanceof ReservationError) {
          throw error; // Business logic errors should NOT be retried
        }

        // Detect serialization/write-conflict errors from all possible sources:
        // - Prisma P2034 (PrismaClientKnownRequestError)
        // - Postgres 40001 (serialization_failure)
        // - DriverAdapterError: TransactionWriteConflict (Neon/PlanetScale adapters)
        const errorMsg = (error?.message || '').toLowerCase();
        const errorName = (error?.name || '').toLowerCase();
        const errorStr = String(error).toLowerCase();
        const errorCode = error?.code || '';
        const searchable = `${errorMsg} ${errorName} ${errorStr}`;
        const isSerializationError =
          errorCode === 'P2034' ||
          errorCode === '40001' ||
          searchable.includes('p2034') ||
          searchable.includes('40001') ||
          searchable.includes('serialization_failure') ||
          searchable.includes('write conflict') ||
          searchable.includes('writeconflict') ||
          searchable.includes('transactionwriteconflict') ||
          searchable.includes('deadlock') ||
          searchable.includes('could not serialize access due to concurrent update');

        if (isSerializationError && attempt < maxAttempts) {
          const jitter = Math.floor(Math.random() * 300);
          const backoffMs = Math.min(Math.pow(2, attempt) * 50 + jitter, 4000);
          console.warn(`[reserve-seats] Serialization conflict (attempt ${attempt}/${maxAttempts}). Retrying in ${backoffMs}ms... Error: ${error?.message}`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        throw error;
      }
    }

    return NextResponse.json(
      {
        reservationId: reservationResult.id,
        expiresAt: reservationResult.expiresAt,
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
