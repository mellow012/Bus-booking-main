import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

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

    // ── Fetch user profile (support both DB `id` and external `uid`) ──────────
    logger.logSuccess('api', `GET /api/bookings current user: ${user?.id ?? 'unknown'}`, { metadata: { user } });
    const userData = await prisma.user.findFirst({
      where: {
        OR: [
          { id: user.id },
          { uid: user.id },
        ],
      },
    });
    if (!userData) {
      await logger.logWarning('api', `User not found for id/uid: ${user.id}`, { metadata: { userId: user.id } });
      return NextResponse.json({ error: 'User profile not found in database. Please complete registration.' }, { status: 404 });
    }

    const where: any = { userId: userData.id, bookingStatus: { not: 'deleted' } };
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
                  stops: true,
                  operators: {
                    select: {
                      id: true,
                      uid: true,
                      email: true,
                      name: true,
                    },
                  },
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
                  phone: true,
                },
              },
              operator: {
                select: {
                  id: true,
                  uid: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          segments: {
            include: {
              schedule: {
                include: {
                  route: {
                    select: {
                      id: true,
                      origin: true,
                      destination: true,
                      distance: true,
                      stops: true,
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
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    // Collect unique operator ids and uids (both direct schedule operators and route operators)
    const operatorUids = new Set<string>();
    const operatorIds = new Set<string>();

    bookings.forEach((b: any) => {
      const directOpUid = b.schedule?.operator?.uid;
      const directOpId = b.schedule?.operator?.id;
      if (directOpUid) operatorUids.add(directOpUid);
      if (directOpId) operatorIds.add(directOpId);

      const routeOps = b.schedule?.route?.operators || [];
      routeOps.forEach((ro: any) => {
        if (ro.uid) operatorUids.add(ro.uid);
        if (ro.id) operatorIds.add(ro.id);
      });
    });

    let operatorPhoneMap: Record<string, string> = {};
    if (operatorUids.size > 0 || operatorIds.size > 0) {
      const operatorUsers = await prisma.user.findMany({
        where: {
          OR: [
            { uid: { in: Array.from(operatorUids) } },
            { id: { in: Array.from(operatorIds) } },
          ]
        },
        select: { id: true, uid: true, phone: true },
      });
      
      operatorUsers.forEach((u) => {
        if (u.uid) operatorPhoneMap[u.uid] = u.phone || '';
        if (u.id) operatorPhoneMap[u.id] = u.phone || '';
      });
    }

    // Attach operatorPhone to each booking
    const enrichedBookings = bookings.map((b: any) => {
      // 1. Try direct schedule operator phone
      const opUid = b.schedule?.operator?.uid;
      const opId = b.schedule?.operator?.id;
      let phone = (opUid ? operatorPhoneMap[opUid] : '') || (opId ? operatorPhoneMap[opId] : '') || '';

      // 2. Fallback to first route operator phone
      if (!phone) {
        const routeOps = b.schedule?.route?.operators || [];
        for (const ro of routeOps) {
          const rPhone = (ro.uid ? operatorPhoneMap[ro.uid] : '') || (ro.id ? operatorPhoneMap[ro.id] : '') || '';
          if (rPhone) {
            phone = rPhone;
            break;
          }
        }
      }

      return {
        ...b,
        schedule: {
          ...b.schedule,
          operatorPhone: phone,
        },
      };
    });

    return NextResponse.json({
      data: enrichedBookings,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    await logger.logError('api', 'GET /api/bookings error', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}

