import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { invalidateScheduleCaches } from '@/lib/cache';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  // Expect format: 'Bearer <secret>'
  if (!cronSecret || !authHeader) return false;
  return authHeader === `Bearer ${cronSecret}`;
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
      // return NextResponse.json({ success: true, expired: 0, message: 'No stale bookings found' });
      // Proceed to past schedule cleanup instead of returning early
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

    // --- NEW LOGIC: Past Schedule Cleanup ---
    let scheduleProcessedCount = 0;
    const scheduleStats = { expired: 0, noShow: 0 };

    try {
      const pastSchedules = await prisma.schedule.findMany({
        where: {
          arrivalDateTime: { lt: new Date() },
          isCompleted: false,
        },
        include: {
          bookings: {
            where: {
              paymentStatus: 'pending',
            },
          },
        },
      });

      for (const schedule of pastSchedules) {
        try {
          await prisma.$transaction(async (tx) => {
            let updatedBookedSeats = Array.isArray(schedule.bookedSeats) ? [...(schedule.bookedSeats as string[])] : [];
            let passengersToRelease = 0;

            for (const booking of schedule.bookings) {
              const newStatus = booking.bookingStatus === 'pending' ? 'expired' : 'no-show';
              
              await tx.booking.update({
                where: { id: booking.id },
                data: { 
                  bookingStatus: newStatus,
                  updatedAt: new Date(),
                },
              });

              if (Array.isArray(booking.seatNumbers) && booking.seatNumbers.length > 0) {
                const bookingSeats = booking.seatNumbers as string[];
                updatedBookedSeats = updatedBookedSeats.filter(seat => !bookingSeats.includes(seat));
              }

              if (Array.isArray(booking.passengerDetails)) {
                 passengersToRelease += booking.passengerDetails.length;
              }

              if (newStatus === 'expired') scheduleStats.expired++;
              else scheduleStats.noShow++;
              
              if (booking.userId) {
                await tx.seatReservation.updateMany({
                  where: {
                    userId: booking.userId,
                    scheduleId: schedule.id,
                    status: 'reserved'
                  },
                  data: {
                    status: 'expired'
                  }
                });
              }
            }

            await tx.schedule.update({
              where: { id: schedule.id },
              data: {
                isCompleted: true,
                tripStatus: 'completed',
                isArchived: true,
                status: 'archived',
                bookedSeats: updatedBookedSeats,
                availableSeats: schedule.availableSeats + passengersToRelease,
              },
            });
            
          });
          scheduleProcessedCount++;
        } catch (err: any) {
          errors.push({ scheduleId: schedule.id, error: err.message });
        }
      }
    } catch (scheduleErr: any) {
      await logger.logError('api', 'Error in past schedule cleanup block of expire-bookings cron', scheduleErr);
      errors.push({ type: 'schedule-cleanup', error: scheduleErr.message });
    }
    // --- END NEW LOGIC ---

    if (expiredCount > 0 || scheduleProcessedCount > 0) invalidateScheduleCaches();

    return NextResponse.json({
      success: true,
      staleBookingsExpired: expiredCount,
      pastSchedulesCleaned: scheduleProcessedCount,
      scheduleBookingStats: scheduleStats,
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
