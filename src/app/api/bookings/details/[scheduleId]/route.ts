import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-utils';

/**
 * GET /api/bookings/details/[scheduleId]
 * Fetch booking details: schedule, bus, route, and company info
 * Public endpoint - no auth required (data is public for browsing)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  try {
    const { scheduleId } = await params;

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    // Fetch schedule with all related data
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        bus: {
          select: {
            id: true,
            licensePlate: true,
            busType: true,
            capacity: true,
            amenities: true,
          },
        },
        route: {
          select: {
            id: true,
            name: true,
            origin: true,
            destination: true,
            distance: true,
            duration: true,
            baseFare: true,
            stops: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            logo: true,
            email: true,
            phone: true,
            status: true,
            returnTripDiscountPercent: true,
            paymentSettings: true,
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Verify company is active
    if (schedule.company.status !== 'active') {
      const msg = schedule.company.status === 'inactive' 
        ? 'Company operations are currently paused' 
        : 'Company is still setting up';
      return NextResponse.json(
        { error: msg },
        { status: 403 }
      );
    }

    // Verify schedule hasn't been completed or cancelled
    if (schedule.status === 'completed' || schedule.status === 'cancelled') {
      return NextResponse.json(
        {
          error: `Schedule is no longer available for booking (${schedule.status})`,
          departureTime: schedule.departureDateTime,
        },
        { status: 410 }
      );
    }

    function parseSeatArray(value: unknown): string[] {
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

    const user = await getCurrentUser(req);

    // Dynamically consolidate all active booked seats (direct + segment bookings)
    const [activeDirectBookings, activeSegmentBookings, activeReservations] = await Promise.all([
      prisma.booking.findMany({
        where: {
          scheduleId,
          bookingStatus: { not: 'cancelled' },
        },
        select: { seatNumbers: true },
      }),
      prisma.bookingSegment.findMany({
        where: {
          scheduleId,
          booking: {
            bookingStatus: { not: 'cancelled' },
          },
        },
        select: { seatNumbers: true },
      }),
      prisma.seatReservation.findMany({
        where: {
          scheduleId,
          status: 'reserved',
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    const staticBookedSeats = parseSeatArray(schedule.bookedSeats);
    const allBookedSeatsSet = new Set<string>([
      ...staticBookedSeats,
      ...activeDirectBookings.flatMap((b) => parseSeatArray(b.seatNumbers)),
      ...activeSegmentBookings.flatMap((s) => parseSeatArray(s.seatNumbers)),
    ]);
    const consolidatedBookedSeats = Array.from(allBookedSeatsSet);
    const busCapacity = schedule.bus?.capacity || 40;
    const dynamicAvailableSeats = Math.max(busCapacity - consolidatedBookedSeats.length, 0);

    const userReservation = user
      ? activeReservations.find((r) => r.userId === user.id)
      : null;

    const otherReservations = userReservation
      ? activeReservations.filter((r) => r.id !== userReservation.id)
      : activeReservations;

    const reservedSeats = otherReservations.flatMap((reservation) =>
      parseSeatArray(reservation.seatNumbers)
    );

    const myActiveReservation = userReservation
      ? {
          id: userReservation.id,
          seatNumbers: parseSeatArray(userReservation.seatNumbers),
          expiresAt: userReservation.expiresAt,
        }
      : null;

    return NextResponse.json({
      schedule: {
        id: schedule.id,
        departureDateTime: schedule.departureDateTime,
        arrivalDateTime: schedule.arrivalDateTime,
        availableSeats: dynamicAvailableSeats,
        bookedSeats: consolidatedBookedSeats,
        reservedSeats,
        price: schedule.price,
        baseFare: schedule.baseFare,
        segmentPrices: schedule.segmentPrices || {},
        departureLocation: schedule.departureLocation,
        arrivalLocation: schedule.arrivalLocation,
        currentStopId: schedule.currentStopId,
        departedStops: Array.isArray(schedule.departedStops) ? schedule.departedStops : [],
      },
      bus: schedule.bus,
      route: schedule.route,
      company: schedule.company,
      myActiveReservation,
    });
  } catch (error) {
    console.error('GET /api/bookings/details/[scheduleId] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch booking details' },
      { status: 500 }
    );
  }
}
