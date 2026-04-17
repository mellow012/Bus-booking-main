import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';

const SEAT_HOLD_DURATION = 10 * 60 * 1000; // 10 minutes

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
    const { scheduleId, seatNumbers } = body;

    if (!scheduleId || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
      return NextResponse.json(
        { error: 'Missing requirements: scheduleId and seatNumbers array' },
        { status: 400 }
      );
    }

    // Get user and verify role
    const userRecord = await prisma.user.findUnique({
      where: { uid: user.id },
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
    const conflictingSeats = seatNumbers.filter(seat =>
      bookedSeats.includes(seat)
    );

    if (conflictingSeats.length > 0) {
      return NextResponse.json(
        {
          error: 'One or more seats are already booked',
          conflictingSeats,
        },
        { status: 400 }
      );
    }

    // Create seat reservation
    const expiresAt = new Date(Date.now() + SEAT_HOLD_DURATION);
    const reservation = await prisma.seatReservation.create({
      data: {
        scheduleId,
        userId: user.id,
        seatNumbers: JSON.stringify(seatNumbers),
        status: 'reserved',
        expiresAt,
      },
    });

    return NextResponse.json(
      {
        reservationId: reservation.id,
        expiresAt: reservation.expiresAt,
        holdDurationMinutes: 10,
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

