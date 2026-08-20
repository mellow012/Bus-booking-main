import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { isSegmentBookable } from '@/lib/schedule-utils';
import { getRouteDistanceAndDuration } from '@/lib/route-utils';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

interface StopInfo {
  id: string;
  name: string;
}

function getEstimatedDuration(origin: string, destination: string, dbDuration?: number, dbDistance?: number): number {
  if (dbDuration && dbDuration > 0) return dbDuration;
  const { distance } = getRouteDistanceAndDuration(origin, destination);
  const dist = (dbDistance && dbDistance > 0) ? dbDistance : distance;
  if (dist > 0) {
    return Math.round((dist / 80) * 60); // Assume average speed of 80 km/h
  }
  return 120; // fallback to 2 hours
}

export async function GET(request: NextRequest) {
  try {
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
      company: { status: 'active' },
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
        bookings: true,
        bookingSegments: true,
        reservations: {
          where: { expiresAt: { gt: new Date() } },
        },
      },
      orderBy,
      skip: pageOffset,
      take: limit,
    });

    const total = await prisma.schedule.count({ where });

    const parseSeatArray = (val: unknown): string[] => {
      if (Array.isArray(val)) return val.filter((s): s is string => typeof s === 'string');
      if (typeof val === 'string') {
        try {
          const p = JSON.parse(val);
          if (Array.isArray(p)) return p.filter((s): s is string => typeof s === 'string');
        } catch { return []; }
      }
      return [];
    };

    // Transform to enhanced format
    const enhanced = schedules.map((sch: any) => {
      const route = sch.route;
      const bus = sch.bus;
      const company = sch.company || bus?.company;
      const dep = new Date(sch.departureDateTime);
      const arr = new Date(sch.arrivalDateTime);

      // Calculate dynamic real-time seats remaining (including static, direct, segment & active holds)
      const staticBookedSeats = parseSeatArray(sch.bookedSeats);
      const activeBookings = (sch.bookings || []).filter((b: any) => b.bookingStatus !== 'cancelled');
      const activeSegments = (sch.bookingSegments || []).filter((s: any) => s.bookingStatus !== 'cancelled');
      const activeReservations = (sch.reservations || []).filter((r: any) => new Date(r.expiresAt) > new Date());

      const allOccupiedSeatsSet = new Set<string>([
        ...staticBookedSeats,
        ...activeBookings.flatMap((b: any) => parseSeatArray(b.seatNumbers)),
        ...activeSegments.flatMap((s: any) => parseSeatArray(s.seatNumbers)),
        ...activeReservations.flatMap((r: any) => parseSeatArray(r.seatNumbers)),
      ]);

      const totalSeats = bus?.capacity || 40;
      const availableSeats = Math.max(totalSeats - allOccupiedSeatsSet.size, 0);

      // Estimate distance and duration if missing or 0
      const dbDistance = route.distance || 0;
      const dbDuration = route.duration || 0;
      const { distance: calculatedDistance } = getRouteDistanceAndDuration(route.origin, route.destination);
      const distance = dbDistance || calculatedDistance;
      const duration = getEstimatedDuration(route.origin, route.destination, dbDuration, dbDistance);

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

      const isUnpartnered = company?.isPartner === false || company?.bookingEnabled === false;
      return {
        id: sch.id,
        companyId: sch.companyId,
        busId: sch.busId,
        routeId: sch.routeId,
        price: sch.price,
        availableSeats: isUnpartnered ? 56 : availableSeats,
        totalSeats: isUnpartnered ? 56 : totalSeats,
        status: sch.status,
        tripStatus: sch.tripStatus, // Return raw tripStatus for UI
        date: dep.toISOString().split('T')[0],
        departureTime: dep.toTimeString().slice(0, 5),
        arrivalTime: arr.toTimeString().slice(0, 5),
        duration,
        distance,
        companyName: company?.name || 'Unknown',
        companyLogo: company?.logo,
        companyRating: (company?.contactSettings as any)?.rating || 4.5,
        origin: route.origin,
        destination: route.destination,
        busNumber: isUnpartnered ? null : (bus?.licensePlate || null),
        busType: isUnpartnered ? null : (bus?.busType || null),
        amenities: isUnpartnered ? [] : ((bus?.amenities as string[]) || []),
        bookingEnabled: company?.bookingEnabled ?? true,
        isPartner: company?.isPartner ?? true,
      };
    }).filter((item: any) => item !== null);

    // Partnered operators first, unpartnered timetable-only after
    enhanced.sort((a: any, b: any) => {
      const aB = a.bookingEnabled !== false ? 0 : 1;
      const bB = b.bookingEnabled !== false ? 0 : 1;
      return aB - bB;
    });

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

