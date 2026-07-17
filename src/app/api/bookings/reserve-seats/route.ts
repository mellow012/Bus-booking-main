import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';

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

/**
 * POST /api/bookings/reserve-seats
 * Reserve seats for a user and validate they are a customer
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
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
    // Look up the user profile by either database `id` or legacy `uid`
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

    // Verify schedule exists and has seats
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Check availability
    if (schedule.availableSeats < seatNumbers.length) {
      return NextResponse.json(
        {
          error: 'Not enough seats available',
          available: schedule.availableSeats,
          requested: seatNumbers.length,
        },
        { status: 400 }
      );
    }

    // Check if seats are already booked
    const bookedSeats = Array.isArray(schedule.bookedSeats) ? schedule.bookedSeats : [];
    const conflictingBookedSeats = seatNumbers.filter(seat => bookedSeats.includes(seat));

    if (conflictingBookedSeats.length > 0) {
      return NextResponse.json(
        {
          error: 'One or more seats are already booked',
          conflictingSeats: conflictingBookedSeats,
        },
        { status: 400 }
      );
    }

    // Check for active reservations on the same schedule
    const activeReservations = await prisma.seatReservation.findMany({
      where: {
        scheduleId,
        status: 'reserved',
        expiresAt: { gt: new Date() },
      },
    });
    
    // Filter out reservations made by the CURRENT user, so they can re-reserve or change seats
    const otherReservations = activeReservations.filter((r: any) => r.userId !== user.id);
    
    const reservedSeats = otherReservations.flatMap((reservation: any) =>
      parseSeatNumbers(reservation.seatNumbers)
    );
    const conflictingReservedSeats = seatNumbers.filter(
      (seat) => reservedSeats.includes(seat)
    );

    if (conflictingReservedSeats.length > 0) {
      return NextResponse.json(
        {
          error: 'One or more seats are already reserved by another customer',
          conflictingSeats: conflictingReservedSeats,
        },
        { status: 400 }
      );
    }

    // Delete any existing reservations for this user and schedule to prevent duplicates
    await prisma.seatReservation.deleteMany({
      where: {
        scheduleId,
        userId: user.id,
      },
    });

    // Create seat reservation
    const expiresAt = new Date(Date.now() + SEAT_HOLD_DURATION);
    const reservation = await prisma.seatReservation.create({
      data: {
        scheduleId,
        userId: user.id,
        seatNumbers,
        status: 'reserved',
        expiresAt,
      },
    });

    return NextResponse.json(
      {
        reservationId: reservation.id,
        expiresAt: reservation.expiresAt,
        holdDurationMinutes: 5,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/bookings/reserve-seats error:', error);
    return NextResponse.json(
      { error: 'Failed to reserve seats' },
      { status: 500 }
    );
  }
}

