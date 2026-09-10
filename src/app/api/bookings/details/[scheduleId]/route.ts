import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-utils';
import { intervalFor, intervalsOverlap } from '@/lib/segment-booking-core';

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
            images: true,
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
            isPartner: true,
            bookingEnabled: true,
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

    // Check if online booking is enabled for this operator
    if (schedule.company.bookingEnabled === false) {
      return NextResponse.json(
        { 
          error: 'Online booking is not currently available for this operator. Timetable is provided for informational purposes.',
          isScheduleOnly: true,
          phone: schedule.company.phone,
        },
        { status: 403 }
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
    const requestedOriginStopId = req.nextUrl.searchParams.get('originStopId') || '__origin__';
    const requestedDestinationStopId = req.nextUrl.searchParams.get('destinationStopId') || '__destination__';
    let requestedInterval;
    try {
      requestedInterval = intervalFor({
        scheduleId,
        seatNumbers: [],
        originStopId: requestedOriginStopId,
        destinationStopId: requestedDestinationStopId,
      }, schedule.route);
    } catch {
      return NextResponse.json(
        { error: 'Invalid booking segment' },
        { status: 400 }
      );
    }

    // Consolidate only bookings and holds that overlap the requested segment.
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
        select: { seatNumbers: true, originStopId: true, destinationStopId: true },
      }),
      prisma.seatReservation.findMany({
        where: {
          scheduleId,
          status: 'reserved',
          expiresAt: { gt: new Date() },
        },
        select: { id: true, userId: true, seatNumbers: true, originStopId: true, destinationStopId: true, expiresAt: true },
      }),
    ]);

    const staticBookedSeats = parseSeatArray(schedule.bookedSeats);
    const overlappingSegmentBookings = activeSegmentBookings.filter((booking) => {
      try {
        return intervalsOverlap(
          requestedInterval,
          intervalFor({
            scheduleId,
            seatNumbers: [],
            originStopId: booking.originStopId ?? undefined,
            destinationStopId: booking.destinationStopId ?? undefined,
          }, schedule.route),
        );
      } catch {
        return true;
      }
    });
    const allBookedSeatsSet = new Set<string>([
      ...staticBookedSeats,
      ...activeDirectBookings.flatMap((b) => parseSeatArray(b.seatNumbers)),
      ...overlappingSegmentBookings.flatMap((s) => parseSeatArray(s.seatNumbers)),
    ]);
    const consolidatedBookedSeats = Array.from(allBookedSeatsSet);
    const busCapacity = schedule.bus?.capacity || 40;
    const dynamicAvailableSeats = Math.max(busCapacity - consolidatedBookedSeats.length, 0);

    const overlappingReservations = activeReservations.filter((reservation) => {
      try {
        return intervalsOverlap(
          requestedInterval,
          intervalFor({
            scheduleId,
            seatNumbers: [],
            originStopId: reservation.originStopId ?? undefined,
            destinationStopId: reservation.destinationStopId ?? undefined,
          }, schedule.route),
        );
      } catch {
        return true;
      }
    });
    const userReservation = user
      ? overlappingReservations.find((r) => r.userId === user.id)
      : null;

    const otherReservations = userReservation
      ? overlappingReservations.filter((r) => r.id !== userReservation.id)
      : overlappingReservations;

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
