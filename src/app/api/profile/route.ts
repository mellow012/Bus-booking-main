import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/utils/supabase/admin';

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
    const userProfile = await prisma.user.findFirst({
      where: {
        OR: [
          { id: user.id },
          { uid: user.id },
          ...(user.email ? [{ email: user.email }] : [])
        ]
      },
      orderBy: {
        setupCompleted: 'desc'
      },
      include: {
        company: {
          select: {
            name: true,
          },
        },
        bookings: {
          select: {
            id: true,
            totalAmount: true,
            bookingStatus: true,
            bookingReference: true,
            seatNumbers: true,
            paymentStatus: true,
            createdAt: true,
            schedule: {
              select: {
                id: true,
                departureDateTime: true,
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
            payments: {
              select: {
                id: true,
                paymentId: true,
                amount: true,
                status: true,
                provider: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!userProfile) {
      console.log(`[GET /api/profile] No user found for Supabase user ${user.id}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`[GET /api/profile] Supabase user: ${user.id} | Prisma user: ${userProfile.id} (${userProfile.email}) | Bookings: ${userProfile.bookings?.length || 0}`);

    // Calculate stats
    const bookings = userProfile.bookings || [];
    const completedBookings = bookings.filter((b: any) => b.bookingStatus === 'confirmed');
    const pendingBookings = bookings.filter((b: any) => b.bookingStatus === 'pending');
    const cancelledBookings = bookings.filter((b: any) => b.bookingStatus === 'cancelled');
    
    const totalSpent = bookings.reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);
    const thisMonthBookings = bookings.filter((b: any) => {
      const bookingMonth = new Date(b.createdAt).getMonth();
      const currentMonth = new Date().getMonth();
      const bookingYear = new Date(b.createdAt).getFullYear();
      const currentYear = new Date().getFullYear();
      return bookingMonth === currentMonth && bookingYear === currentYear;
    });
    const thisMonthSpent = thisMonthBookings.reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);

    // Compile payments list from bookings
    const paymentsList: any[] = [];
    bookings.forEach((b: any) => {
      (b.payments || []).forEach((p: any) => {
        paymentsList.push({
          id: p.id,
          paymentId: p.paymentId,
          amount: p.amount,
          status: p.status,
          provider: p.provider,
          createdAt: p.createdAt,
          bookingRef: b.bookingReference,
          route: `${b.schedule?.route?.origin || 'Unknown'} to ${b.schedule?.route?.destination || 'Unknown'}`,
        });
      });
    });
    paymentsList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Travel insights
    const destinationCounts: Record<string, number> = {};
    const companyCounts: Record<string, number> = {};
    
    completedBookings.forEach((b: any) => {
      const dest = b.schedule?.route?.destination || 'Unknown';
      destinationCounts[dest] = (destinationCounts[dest] || 0) + 1;
      
      const company = b.schedule?.company?.name || 'Unknown';
      companyCounts[company] = (companyCounts[company] || 0) + 1;
    });

    const mostVisitedDest = Object.entries(destinationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const favoriteCompany = Object.entries(companyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const totalDistance = completedBookings.reduce((sum: number, b: any) => sum + (b.schedule?.route?.distance || 0), 0);
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
          thisMonthBookingsCount: thisMonthBookings.length,
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
        setupCompleted: userProfile.setupCompleted,
        role: userProfile.role,
        companyId: userProfile.companyId,
        region: userProfile.region,
        companyName: (userProfile as any).company?.name || null,
        preferences: userProfile.preferences,
        passwordSet: userProfile.passwordSet,
        payments: paymentsList,
        bookings: userProfile.bookings,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error: any) {
    await logger.logError('api', 'GET /api/profile error', error);
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
    const { firstName, lastName, phone, nationalId, sex, currentAddress, preferences } = body;

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { id: user.id },
          { uid: user.id }
        ]
      }
    });

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone && { phone }),
        ...(nationalId !== undefined && { nationalId }),
        ...(sex !== undefined && { sex }),
        ...(currentAddress !== undefined && { currentAddress }),
        ...(preferences !== undefined && { preferences }),
        // When a user updates their profile via this endpoint we consider
        // the setup flow complete and persist that server-side so subsequent
        // visits reflect view-only mode.
        setupCompleted: true,
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
        preferences: updated.preferences,
      },
    });
  } catch (error: any) {
    await logger.logError('api', 'PUT /api/profile error', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile
 * Delete user profile and all associated data
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { id: user.id },
          { uid: user.id }
        ]
      }
    });

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all booking IDs for this user
    const userBookings = await prisma.booking.findMany({
      where: { userId: existing.id },
      select: { id: true }
    });
    const bookingIds = userBookings.map((b: any) => b.id);

    // Get all group charter requests for this user
    const userCharters = await prisma.groupCharterRequest.findMany({
      where: { userId: existing.id },
      select: { id: true }
    });
    const charterIds = userCharters.map((c: any) => c.id);

    // Run delete transaction in correct sequence
    await prisma.$transaction([
      // 1. Delete ActivityLogs
      prisma.activityLog.deleteMany({ where: { userId: existing.id } }),
      // 2. Delete Notifications
      prisma.notification.deleteMany({ where: { userId: existing.id } }),
      // 3. Delete ChatMessages
      prisma.chatMessage.deleteMany({ where: { senderId: existing.id } }),
      // 4. Delete SeatReservations
      prisma.seatReservation.deleteMany({ where: { userId: existing.id } }),
      // 5. Delete GroupRequests
      prisma.groupRequest.deleteMany({ where: { userId: existing.id } }),
      // 6. Delete GroupCharterQuotes
      prisma.groupCharterQuote.deleteMany({ where: { requestId: { in: charterIds } } }),
      // 7. Delete GroupCharterRequests
      prisma.groupCharterRequest.deleteMany({ where: { userId: existing.id } }),
      // 8. Delete Payments associated with bookings
      prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } }),
      // 9. Delete BookingSegments
      prisma.bookingSegment.deleteMany({ where: { bookingId: { in: bookingIds } } }),
      // 10. Delete Bookings
      prisma.booking.deleteMany({ where: { userId: existing.id } }),
      // 11. Delete the User record
      prisma.user.delete({ where: { id: existing.id } })
    ]);

    // Delete user from Supabase Auth using the admin client
    try {
      const adminClient = createAdminClient();
      const { error: authError } = await adminClient.auth.admin.deleteUser(user.id);
      if (authError) {
        await logger.logError('api', 'DELETE /api/profile auth deletion error', authError);
      }
    } catch (authErr) {
      await logger.logError('api', 'DELETE /api/profile auth client creation/deletion error', authErr);
    }

    return NextResponse.json({ message: 'Account successfully deleted' });
  } catch (error: any) {
    await logger.logError('api', 'DELETE /api/profile error', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}

