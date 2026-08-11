import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromServer } from '@/lib/auth-utils';

const rateLimits = new Map<string, number>();

// POST — submit a position sample for a trip (rider or conductor)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUserFromServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: scheduleId } = await params;
    if (!scheduleId || scheduleId === 'undefined') {
      return NextResponse.json({ error: 'Valid schedule ID is required' }, { status: 400 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid or missing JSON body' }, { status: 400 });
    }

    const { latitude, longitude, accuracy, heading, speed, source } = body;

    if (source === 'conductor') {
      if (user.role !== 'conductor' && user.role !== 'operator' && user.role !== 'superadmin' && user.role !== 'company_admin') {
        return NextResponse.json({ error: 'Unauthorized role for conductor source' }, { status: 403 });
      }
    }

    if (
      typeof latitude !== 'number' || typeof longitude !== 'number' ||
      latitude < -17.5 || latitude > -9.0 ||
      longitude < 32.5 || longitude > 36.0
    ) {
      return NextResponse.json(
        { error: 'Coordinates are invalid or outside Malawi bounds' },
        { status: 400 }
      );
    }

    // Rate limiting: check if same user+schedule posted in the last 20 seconds
    const rateKey = `${user.id}-${scheduleId}`;
    const lastPost = rateLimits.get(rateKey);
    if (lastPost && Date.now() - lastPost < 20000) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    rateLimits.set(rateKey, Date.now());

    const isChatter = new URL(request.url).searchParams.get('chatter') === 'true';

    if (isChatter) {
      const chatterSchedule = await prisma.chatterSchedule.findUnique({
        where: { id: scheduleId },
        select: { id: true, status: true },
      });

      if (!chatterSchedule) {
        return NextResponse.json({ error: 'Chatter schedule not found' }, { status: 404 });
      }

      if (source === 'rider') {
        const booking = await prisma.booking.findFirst({
          where: {
            userId: user.id,
            chatterScheduleId: scheduleId,
            bookingStatus: 'confirmed',
            paymentStatus: { in: ['paid', 'pending'] }
          }
        });

        if (!booking) {
          return NextResponse.json({ error: 'No active booking found for this trip' }, { status: 403 });
        }
      }

      const sample = await prisma.tripPositionSample.create({
        data: {
          chatterScheduleId: scheduleId,
          latitude,
          longitude,
          accuracy: typeof accuracy === 'number' ? accuracy : null,
          heading: typeof heading === 'number' ? heading : null,
          speed: typeof speed === 'number' ? speed : null,
          source: source === 'conductor' ? 'conductor' : 'rider',
        },
      });

      return NextResponse.json({ success: true, id: sample.id });
    } else {
      // Verify the schedule exists
      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
        select: { id: true, tripStatus: true },
      });

      if (!schedule) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
      }

      if (source === 'rider') {
        const booking = await prisma.booking.findFirst({
          where: {
            userId: user.id,
            scheduleId: scheduleId,
            bookingStatus: 'confirmed',
            paymentStatus: { in: ['paid', 'pending'] }
          }
        });

        if (!booking) {
          return NextResponse.json({ error: 'No active booking found for this trip' }, { status: 403 });
        }
      }

      const sample = await prisma.tripPositionSample.create({
        data: {
          scheduleId,
          latitude,
          longitude,
          accuracy: typeof accuracy === 'number' ? accuracy : null,
          heading: typeof heading === 'number' ? heading : null,
          speed: typeof speed === 'number' ? speed : null,
          source: source === 'conductor' ? 'conductor' : 'rider',
        },
      });

      return NextResponse.json({ success: true, id: sample.id });
    }
  } catch (error) {
    console.error('POST /api/trips/[id]/position error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET — get the latest position sample for a trip
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scheduleId } = await params;
    if (!scheduleId || scheduleId === 'undefined') {
      return NextResponse.json({ error: 'Valid schedule ID is required' }, { status: 400 });
    }

    const isChatter = new URL(request.url).searchParams.get('chatter') === 'true';
    const where = isChatter ? { chatterScheduleId: scheduleId } : { scheduleId };

    const ninetySecondsAgo = new Date(Date.now() - 90000);
    const recentSamples = await prisma.tripPositionSample.findMany({
      where: {
        ...where,
        createdAt: { gte: ninetySecondsAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    let latestSample = null;
    let stale = false;

    if (recentSamples.length > 0) {
      latestSample = recentSamples[0];
    } else {
      latestSample = await prisma.tripPositionSample.findFirst({
        where,
        orderBy: { createdAt: 'desc' },
      });
      if (!latestSample) {
        return NextResponse.json({
          available: false,
          message: 'No position data available for this trip',
        });
      }
      stale = true;
    }

    const latitude = latestSample.latitude;
    const longitude = latestSample.longitude;

    const threeMinsAgo = new Date(Date.now() - 3 * 60 * 1000);
    stale = stale || latestSample.createdAt < threeMinsAgo;

    return NextResponse.json({
      available: true,
      position: {
        latitude: latitude,
        longitude: longitude,
        accuracy: latestSample.accuracy,
        heading: latestSample.heading,
        speed: latestSample.speed,
        source: latestSample.source,
        timestamp: latestSample.createdAt.toISOString(),
      },
      stale
    });
  } catch (error) {
    console.error('GET /api/trips/[id]/position error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
