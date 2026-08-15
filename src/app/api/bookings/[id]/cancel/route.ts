import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { parseUtcDate } from '@/lib/timezone';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/bookings/[id]/cancel
 * Cancel a booking
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookingId = (await params).id;

    // Fetch booking with schedule to restore available seats
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { schedule: true, chatterSchedule: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Verify ownership
    if (booking.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if already cancelled
    if (booking.bookingStatus === 'cancelled') {
      return NextResponse.json(
        { error: 'Booking is already cancelled' },
        { status: 400 }
      );
    }

    // Check refund/cancellation 2-hour pre-departure cutoff policy
    const depRaw = booking.schedule?.departureDateTime ?? booking.chatterSchedule?.travelDate ?? Date.now();
    const departureTime = depRaw instanceof Date ? depRaw : parseUtcDate(depRaw);
    const twoHoursMs = 2 * 60 * 60 * 1000;
    const timeUntilDeparture = departureTime.getTime() - Date.now();

    if (timeUntilDeparture <= 0) {
      return NextResponse.json(
        { error: 'Cannot cancel booking after departure time.' },
        { status: 400 }
      );
    }

    if (timeUntilDeparture < twoHoursMs) {
      return NextResponse.json(
        {
          error: 'Refund Cutoff Exceeded',
          message: 'Bookings cannot be cancelled or refunded within 2 hours of scheduled departure time as per TibhukeBus policy.',
          policyCutoffHours: 2,
        },
        { status: 400 }
      );
    }

    // Count seats from passengerDetails JSON
    const passengerCount = Array.isArray(booking.passengerDetails)
      ? booking.passengerDetails.length
      : 0;

    // Cancel booking and restore available seats in transaction
    const txOps: any[] = [
      // Update booking status
      prisma.booking.update({
        where: { id: bookingId },
        data: {
          bookingStatus: 'cancelled',
          cancellationDate: new Date(),
          updatedAt: new Date(),
        },
      }),
    ];

    if (!booking.chatterScheduleId && booking.scheduleId) {
      txOps.push(
        prisma.schedule.update({
          where: { id: booking.scheduleId },
          data: {
            availableSeats: {
              increment: passengerCount,
            },
          },
        })
      );
    }

    const result = await prisma.$transaction(txOps);

    return NextResponse.json({
      message: 'Booking cancelled successfully',
      booking: result[0],
    });
  } catch (error) {
    await logger.logError('booking', 'POST /api/bookings/[id]/cancel error', error);
    return NextResponse.json(
      { error: 'Failed to cancel booking' },
      { status: 500 }
    );
  }
}
