import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST — submit a position sample for a trip (rider or conductor)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        { error: 'latitude and longitude are required numbers' },
        { status: 400 }
      );
    }

    // Verify the schedule exists
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, tripStatus: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
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

    const latest = await prisma.tripPositionSample.findFirst({
      where: { scheduleId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return NextResponse.json({
        available: false,
        message: 'No position data available for this trip',
      });
    }

    return NextResponse.json({
      available: true,
      position: {
        latitude: latest.latitude,
        longitude: latest.longitude,
        accuracy: latest.accuracy,
        heading: latest.heading,
        speed: latest.speed,
        source: latest.source,
        timestamp: latest.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('GET /api/trips/[id]/position error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
