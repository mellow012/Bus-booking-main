import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

    // Verify schedule hasn't departed
    const now = new Date();
    if (new Date(schedule.departureDateTime) < now) {
      return NextResponse.json(
        {
          error: 'Schedule has already departed',
          departureTime: schedule.departureDateTime,
        },
        { status: 410 }
      );
    }

    return NextResponse.json({
      schedule: {
        id: schedule.id,
        departureDateTime: schedule.departureDateTime,
        arrivalDateTime: schedule.arrivalDateTime,
        availableSeats: schedule.availableSeats,
        bookedSeats: Array.isArray(schedule.bookedSeats) ? schedule.bookedSeats : [],
        price: schedule.price,
        baseFare: schedule.baseFare,
        segmentPrices: schedule.segmentPrices || {},
        departureLocation: schedule.departureLocation,
        arrivalLocation: schedule.arrivalLocation,
      },
      bus: schedule.bus,
      route: schedule.route,
      company: schedule.company,
    });
  } catch (error) {
    console.error('GET /api/bookings/details/[scheduleId] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch booking details' },
      { status: 500 }
    );
  }
}
