import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/profile
 * Fetch user profile with travel insights and stats
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user and their bookings
    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        bookings: {
          select: {
            id: true,
            totalAmount: true,
            bookingStatus: true,
            createdAt: true,
            schedule: {
              select: {
                id: true,
                route: {
                  select: {
                    origin: true,
                    destination: true,
                    distance: true,
                  },
                },
                bus: {
                  select: {
                    id: true,
                    licensePlate: true,
                  },
                },
                company: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate stats
    const bookings = userProfile.bookings || [];
    const completedBookings = bookings.filter(b => b.bookingStatus === 'confirmed');
    const pendingBookings = bookings.filter(b => b.bookingStatus === 'pending');
    const cancelledBookings = bookings.filter(b => b.bookingStatus === 'cancelled');
    
    const totalSpent = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const thisMonthBookings = bookings.filter(b => {
      const bookingMonth = new Date(b.createdAt).getMonth();
      const currentMonth = new Date().getMonth();
      const bookingYear = new Date(b.createdAt).getFullYear();
      const currentYear = new Date().getFullYear();
      return bookingMonth === currentMonth && bookingYear === currentYear;
    });
    const thisMonthSpent = thisMonthBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    // Travel insights
    const destinationCounts: Record<string, number> = {};
    const companyCounts: Record<string, number> = {};
    
    completedBookings.forEach(b => {
      const dest = b.schedule?.route?.destination || 'Unknown';
      destinationCounts[dest] = (destinationCounts[dest] || 0) + 1;
      
      const company = b.schedule?.company?.name || 'Unknown';
      companyCounts[company] = (companyCounts[company] || 0) + 1;
    });

    const mostVisitedDest = Object.entries(destinationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const favoriteCompany = Object.entries(companyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const totalDistance = completedBookings.reduce((sum, b) => sum + (b.schedule?.route?.distance || 0), 0);
    const avgCost = completedBookings.length > 0 ? totalSpent / completedBookings.length : 0;

    return NextResponse.json({
      data: {
        id: userProfile.id,
        email: userProfile.email,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        phone: userProfile.phone,
        createdAt: userProfile.createdAt,
        updatedAt: userProfile.updatedAt,
        stats: {
          totalBookings: bookings.length,
          completedBookings: completedBookings.length,
          pendingBookings: pendingBookings.length,
          cancelledBookings: cancelledBookings.length,
          totalSpent,
          thisMonthSpent,
          averageBookingValue: Math.round(bookings.length > 0 ? totalSpent / bookings.length : 0),
        },
        insights: {
          mostVisitedDestination: mostVisitedDest,
          favoriteCompany,
          totalDistance,
          averageTripCost: Math.round(avgCost),
          travelFrequency: completedBookings.length > 30 ? 'Frequent' : completedBookings.length > 10 ? 'Regular' : 'Occasional',
        },
        nationalId: userProfile.nationalId,
        sex: userProfile.sex,
        currentAddress: userProfile.currentAddress,
      },
    });
  } catch (error) {
    console.error('GET /api/profile error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profile
 * Update user profile
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { firstName, lastName, phone, nationalId, sex, currentAddress } = body;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone && { phone }),
        ...(nationalId !== undefined && { nationalId }),
        ...(sex !== undefined && { sex }),
        ...(currentAddress !== undefined && { currentAddress }),
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
        nationalId: updated.nationalId,
        sex: updated.sex,
        currentAddress: updated.currentAddress,
      },
    });
  } catch (error) {
    console.error('PUT /api/profile error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

