import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  const authHeader = request.headers.get('authorization') || '';
  const xCronSecret = request.headers.get('x-cron-secret') || '';
  const querySecret = request.nextUrl.searchParams.get('secret') || '';

  if (authHeader === `Bearer ${cronSecret}` || authHeader === cronSecret) return true;
  if (xCronSecret === cronSecret) return true;
  if (querySecret === cronSecret) return true;

  return false;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      await logger.logError('api', 'Unauthorized access attempt to expire-bookings cron endpoint', new Error('Unauthorized'));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cutoffDate = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago

    // Find bookings that are still pending and older than 20 minutes
    const staleBookings = await prisma.booking.findMany({
      where: {
        bookingStatus: 'pending',
        createdAt: {
          lt: cutoffDate,
        },
      },
      select: {
        id: true,
        scheduleId: true,
        userId: true,
        seatNumbers: true,
        passengerDetails: true,
      },
    });

    if (staleBookings.length === 0) {
      return NextResponse.json({ success: true, expired: 0, message: 'No stale bookings found' });
    }

    let expiredCount = 0;
    const errors: any[] = [];

    for (const booking of staleBookings) {
      try {
        await prisma.$transaction(async (tx) => {
          // Double-check the status hasn't changed to prevent race conditions
          const currentBooking = await tx.booking.findUnique({
            where: { id: booking.id },
            select: { bookingStatus: true, passengerDetails: true },
          });

          if (!currentBooking || currentBooking.bookingStatus !== 'pending') {
            return;
          }

          // Update booking to expired
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              bookingStatus: 'expired',
              updatedAt: new Date(),
            },
          });

          // Release the held seats back to the schedule
          if (booking.scheduleId) {
            const passengerCount = Array.isArray(currentBooking.passengerDetails) ? currentBooking.passengerDetails.length : 0;
            
            const schedule = await tx.schedule.findUnique({
              where: { id: booking.scheduleId },
              select: { bookedSeats: true, availableSeats: true }
            });

            if (schedule) {
              const currentBookedSeats = Array.isArray(schedule.bookedSeats) ? schedule.bookedSeats as string[] : [];
              const bookingSeats = Array.isArray(booking.seatNumbers) ? booking.seatNumbers as string[] : [];
              
              const newBookedSeats = currentBookedSeats.filter(seat => !bookingSeats.includes(seat));
              
              await tx.schedule.update({
                where: { id: booking.scheduleId },
                data: {
                  availableSeats: schedule.availableSeats + passengerCount,
                  bookedSeats: newBookedSeats,
                },
              });
            }

            // Expire lingering SeatReservation rows scoped to this user and schedule
            await tx.seatReservation.updateMany({
              where: {
                userId: booking.userId,
                scheduleId: booking.scheduleId,
                status: 'reserved'
              },
              data: {
                status: 'expired'
              }
            });
          }
          expiredCount++;
        });
      } catch (err: any) {
        errors.push({ id: booking.id, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      expired: expiredCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    await logger.logError('api', 'Error in expire-bookings cron endpoint', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
