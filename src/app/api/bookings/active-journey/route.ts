import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatTime12, parseUtcDate } from '@/lib/timezone';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ activeJourney: null });
    }

    const userData = await prisma.user.findFirst({
      where: {
        OR: [
          { id: user.id },
          { uid: user.id },
        ],
      },
    });

    if (!userData) {
      return NextResponse.json({ activeJourney: null });
    }

    // Fetch user's paid & confirmed bookings strictly
    const bookings = await prisma.booking.findMany({
      where: {
        userId: userData.id,
        bookingStatus: 'confirmed',
        paymentStatus: 'paid',
      },
      include: {
        schedule: {
          include: {
            route: true,
            company: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
            bus: {
              select: {
                id: true,
                licensePlate: true,
                busType: true,
              },
            },
          },
        },
        segments: {
          include: {
            schedule: {
              include: {
                route: true,
                bus: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ activeJourney: null });
    }

    const now = new Date();
    const candidateJourneys: any[] = [];

    for (const booking of bookings) {
      const hasPaidTicket = booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid';

      if (!hasPaidTicket) continue;

      const outboundSchedule = booking.schedule;
      if (!outboundSchedule) continue;

      const outboundArrTime = new Date(outboundSchedule.arrivalDateTime);
      const outboundCompleted =
        outboundSchedule.tripStatus === 'completed' ||
        (outboundSchedule.tripStatus !== 'in_transit' && now >= outboundArrTime);

      // Return segment resolution: reuse existing outboundCompleted logic
      const returnSegment = booking.segments?.find(
        (s: any) => s.scheduleId !== booking.scheduleId
      );
      const activeSegment = outboundCompleted && returnSegment ? returnSegment : null;

      const currentSchedule = activeSegment ? activeSegment.schedule : outboundSchedule;
      const currentRoute = activeSegment
        ? activeSegment.schedule.route
        : outboundSchedule.route;
      const currentCompany = outboundSchedule.company;

      if (!currentSchedule || !currentRoute) continue;

      const depTime = new Date(currentSchedule.departureDateTime);
      const arrTime = new Date(currentSchedule.arrivalDateTime);
      const fifteenMinsBeforeDep = new Date(depTime.getTime() - 15 * 60 * 1000);
      const oneHourAfterArr = new Date(arrTime.getTime() + 60 * 60 * 1000);

      // Strict time-bound windows:
      // 1. Upcoming: T-15 mins before departure up to departure time
      // 2. In Transit: Between departure and arrival time
      // 3. Arrived: Between arrival time and 1 hour post-arrival
      const isUpcoming  = now >= fifteenMinsBeforeDep && now < depTime && currentSchedule.tripStatus !== 'cancelled';
      const isInTransit = (currentSchedule.tripStatus === 'in_transit' || (now >= depTime && now < arrTime)) && currentSchedule.tripStatus !== 'completed' && currentSchedule.tripStatus !== 'cancelled';
      const isArrived   = now >= arrTime && now <= oneHourAfterArr && currentSchedule.tripStatus !== 'cancelled';

      if (isUpcoming || isInTransit || isArrived) {
        candidateJourneys.push({
          bookingId: booking.id,
          scheduleId: currentSchedule.id,
          origin: currentRoute.origin || 'Departure',
          destination: currentRoute.destination || 'Arrival',
          departureTime: formatTime12(parseUtcDate(currentSchedule.departureDateTime)),
          arrivalTime: formatTime12(parseUtcDate(currentSchedule.arrivalDateTime)),
          departureDateTime: currentSchedule.departureDateTime,
          arrivalDateTime: currentSchedule.arrivalDateTime,
          companyName: currentCompany?.name || 'Bus Operator',
          companyLogo: currentCompany?.logo || null,
          tripStatus: isArrived ? 'completed' : isUpcoming ? 'scheduled' : (currentSchedule.tripStatus || 'in_transit'),
          bookingStatus: booking.bookingStatus,
          paymentStatus: booking.paymentStatus,
          isReturnSegment: !!activeSegment,
        });
      }
    }

    if (candidateJourneys.length === 0) {
      return NextResponse.json({ activeJourney: null });
    }

    // If multiple in-transit bookings exist for one user (e.g. multi-seat or simultaneous group bookings),
    // select the soonest arrivalDateTime as primary.
    candidateJourneys.sort((a, b) => {
      return new Date(a.arrivalDateTime).getTime() - new Date(b.arrivalDateTime).getTime();
    });

    return NextResponse.json({ activeJourney: candidateJourneys[0] });
  } catch (error) {
    await logger.logError('api', 'GET /api/bookings/active-journey error', error);
    return NextResponse.json({ activeJourney: null });
  }
}
