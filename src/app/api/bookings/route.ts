import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';

/**
 * GET /api/bookings
 * Fetch user's bookings with pagination and filtering
 * Query params: page, limit, status, sortBy (date, price)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '10', 10));
    const status = searchParams.get('status')?.toLowerCase(); // 'pending', 'confirmed', 'cancelled'
    const sortBy = searchParams.get('sortBy') ?? 'date'; // 'date', 'price'

    // ── Fetch user profile ────────────────────────────────────────────────────
    const userData = await prisma.user.findUnique({ where: { uid: user.id } });
    if (!userData) {
      return NextResponse.json({ error: 'User profile not found in database. Please complete registration.' }, { status: 404 });
    }

    const where: any = { userId: userData.id };
    if (status && ['pending', 'confirmed', 'cancelled'].includes(status)) {
      where.bookingStatus = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Determine sort order
    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'price') {
      orderBy = { totalAmount: 'desc' };
    }

    // Fetch bookings with relationships
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          schedule: {
            include: {
              route: {
                select: {
                  id: true,
                  origin: true,
                  destination: true,
                  distance: true,
                },
              },
              bus: {
                select: {
                  id: true,
                  licensePlate: true,
                  busType: true,
                },
              },
              company: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    // Transform response to flat structure
    const transformedBookings = bookings.map(booking => ({
      id: booking.id,
      bookingReference: booking.bookingReference,
      userId: booking.userId,
      scheduleId: booking.scheduleId,
      numberOfSeats: Array.isArray(booking.passengerDetails) ? booking.passengerDetails.length : 0,
      totalAmount: booking.totalAmount,
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      // Schedule details
      scheduleDate: booking.schedule.departureDateTime,
      departureTime: booking.schedule.departureDateTime,
      arrivalTime: booking.schedule.arrivalDateTime,
      origin: booking.schedule.route.origin,
      destination: booking.schedule.route.destination,
      distance: booking.schedule.route.distance,
      busType: booking.schedule.bus.busType,
      licensePlate: booking.schedule.bus.licensePlate,
      companyName: booking.schedule.company.name,
      companyLogo: booking.schedule.company.logo,
      availableSeats: booking.schedule.availableSeats,
    }));

    return NextResponse.json({
      data: transformedBookings,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('GET /api/bookings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}

