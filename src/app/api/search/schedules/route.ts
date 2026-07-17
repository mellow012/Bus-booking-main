import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { isSegmentBookable } from '@/lib/schedule-utils';
import { checkAndRollSchedules } from '@/lib/schedule-generator';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

interface StopInfo {
  id: string;
  name: string;
}

export async function GET(request: NextRequest) {
  try {
    // Ensure future schedules are active and running all the time (asynchronously)
    checkAndRollSchedules().catch((err: any) => {
      logger.logError('api', '[schedule-generator] Async roll error', err);
    });

    const searchParams = request.nextUrl.searchParams;

    // Required parameters
    const origin = searchParams.get('origin')?.toLowerCase().trim() || '';
    const destination = searchParams.get('destination')?.toLowerCase().trim() || '';
    
    // Optional parameters
    const date = searchParams.get('date') || ''; // YYYY-MM-DD
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT)),
      MAX_LIMIT
    );
    const sortBy = searchParams.get('sortBy') || 'time'; // time, price_asc, price_desc, seats
    const pageOffset = (page - 1) * limit;

    const now = new Date();
    const recentDepartureCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Build where clause
    const where: any = {
      status: 'active',
      availableSeats: { gt: 0 },
      company: { status: 'active' }, // Only show schedules from active companies
      departureDateTime: { gte: recentDepartureCutoff },
      arrivalDateTime: { gt: now },
    };

    if (origin || destination) {
      const andFilters: any[] = [];
      if (origin) andFilters.push({ origin: { contains: origin, mode: 'insensitive' } });
      if (destination) andFilters.push({ destination: { contains: destination, mode: 'insensitive' } });
      where.route = { AND: andFilters };
    }

    // Optional: filter by date
    if (date) {
      const startOfDay = new Date(`${date}T00:00:00Z`);
      const endOfDay = new Date(`${date}T23:59:59Z`);
      where.departureDateTime = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    // Determine sort order
    let orderBy: any = { departureDateTime: 'asc' };
    if (sortBy === 'price_asc') orderBy = { price: 'asc' };
    else if (sortBy === 'price_desc') orderBy = { price: 'desc' };
    else if (sortBy === 'seats') orderBy = { availableSeats: 'desc' };

    // Execute search
    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        route: true,
        bus: { include: { company: true } },
        company: true,
      },
      orderBy,
      skip: pageOffset,
      take: limit,
    });

    const total = await prisma.schedule.count({ where });

    // Transform to enhanced format
    const enhanced = schedules.map((sch: any) => {
      const route = sch.route;
      const bus = sch.bus;
      const company = sch.company || bus?.company;
      const dep = new Date(sch.departureDateTime);
      const arr = new Date(sch.arrivalDateTime);

      // Smart Segment Filtering: If we have an origin city, check if it's still bookable
      // This allows booking a bus that has already started but hasn't reached the user's stop yet.
      let originStopId: string | undefined;
      if (origin && route.stops) {
        const stops = route.stops as unknown as StopInfo[];
        const match = stops.find(s => s.name.toLowerCase().includes(origin));
        if (match) originStopId = match.id;
      }

      const bookable = isSegmentBookable(sch, originStopId);
      if (!bookable) return null;

      return {
        id: sch.id,
        companyId: sch.companyId,
        busId: sch.busId,
        routeId: sch.routeId,
        price: sch.price,
        availableSeats: sch.availableSeats,
        totalSeats: bus?.capacity || 40,
        status: sch.status,
        tripStatus: sch.tripStatus, // Return raw tripStatus for UI
        date: dep.toISOString().split('T')[0],
        departureTime: dep.toTimeString().slice(0, 5),
        arrivalTime: arr.toTimeString().slice(0, 5),
        duration: Math.round((arr.getTime() - dep.getTime()) / 60000),
        distance: route.distance || 0,
        companyName: company?.name || 'Unknown',
        companyLogo: company?.logo,
        origin: route.origin,
        destination: route.destination,
        busNumber: bus?.licensePlate || 'N/A',
        busType: bus?.busType || 'Standard',
        amenities: (bus?.amenities as string[]) || [],
      };
    }).filter((item: any) => item !== null);

    return NextResponse.json({
      success: true,
      data: enhanced,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    await logger.logError('api', 'Search failed', error, {
      action: 'search_error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Search failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

