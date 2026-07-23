import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

function formatTimeString(dateTime: Date | string): string {
  const d = new Date(dateTime);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

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

    // Fetch user's confirmed bookings
    const bookings = await prisma.booking.findMany({
      where: {
        userId: userData.id,
        bookingStatus: 'confirmed',
        paymentStatus: { in: ['paid', 'pending'] },
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
      const isCash = (booking as any).paymentMethod === 'cash_on_boarding';
      const hasSecuredSeat = booking.bookingStatus === 'confirmed' &&
        (booking.paymentStatus === 'paid' || isCash);

      if (!hasSecuredSeat) continue;

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

      // In transit check: schedule tripStatus is 'in_transit' or current time is between departure and arrival
      const isInTransit =
        currentSchedule.tripStatus === 'in_transit' ||
        (now >= depTime &&
          now < arrTime &&
          currentSchedule.tripStatus !== 'completed' &&
          currentSchedule.tripStatus !== 'cancelled');

      if (isInTransit) {
        candidateJourneys.push({
          bookingId: booking.id,
          scheduleId: currentSchedule.id,
          origin: currentRoute.origin || 'Departure',
          destination: currentRoute.destination || 'Arrival',
          departureTime: formatTimeString(currentSchedule.departureDateTime),
          arrivalTime: formatTimeString(currentSchedule.arrivalDateTime),
          departureDateTime: currentSchedule.departureDateTime,
          arrivalDateTime: currentSchedule.arrivalDateTime,
          companyName: currentCompany?.name || 'Bus Operator',
          companyLogo: currentCompany?.logo || null,
          tripStatus: currentSchedule.tripStatus || 'in_transit',
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
