/**
 * GET /api/schedules
 * Get schedules with optional filtering by:
 * - from (origin city)
 * - to (destination city)
 * - date (YYYY-MM-DD)
 * - page (pagination)
 * - limit (results per page, default 30, max 100)
 * - sortBy (time, price_asc, price_desc, seats)
 *
 * Returns enhanced schedule list with company, bus, route data joined
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { isSegmentBookable } from '@/lib/schedule-utils';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

interface EnhancedSchedule {
  id: string;
  companyId: string;
  busId: string;
  routeId: string;
  price: number;
  availableSeats: number;
  status: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  duration: number;
  companyName: string;
  companyLogo?: string;
  origin: string;
  destination: string;
  distance: number;
  busNumber: string;
  busType: string;
  amenities: string[];
  totalSeats: number;
}

type SortBy = 'time' | 'price_asc' | 'price_desc' | 'seats';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Extract query parameters
    const from = searchParams.get('from')?.toLowerCase().trim() || '';
    const to = searchParams.get('to')?.toLowerCase().trim() || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT)),
      MAX_LIMIT
    );
    const sortBy = (searchParams.get('sortBy') || 'time') as SortBy;
    const date = searchParams.get('date') || '';
    const pageOffset = (page - 1) * limit;

    // Build where clause
    const where: any = {
      status: 'active',
      availableSeats: { gt: 0 },
      // By default, only show schedules that haven't arrived yet
      // but if specific dates are provided, we follow those
      company: { status: 'active' }, 
    };

    if (startDate || endDate) {
      where.departureDateTime = {};
      if (startDate) where.departureDateTime.gte = new Date(startDate);
      if (endDate) where.departureDateTime.lte = new Date(endDate);
    } else if (!date) {
      // Default: only show upcoming
      // Smart logic in map() will handle per-stop visibility
      where.arrivalDateTime = { gt: new Date() };
    }

    // Optional: filter by specific date if provided (YYYY-MM-DD)
    if (date) {
      const startOfDay = new Date(`${date}T00:00:00Z`);
      const endOfDay = new Date(`${date}T23:59:59Z`);
      where.departureDateTime = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    // Fetch schedules with joins (Prisma handles the SQL efficiently)
    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        route: true,
        bus: { include: { company: true } },
        company: true,
      },
      orderBy:
        sortBy === 'time' || (sortBy as string) === 'departureDateTime'
          ? { departureDateTime: 'asc' }
          : sortBy === 'price_asc'
          ? { price: 'asc' }
          : sortBy === 'price_desc'
          ? { price: 'desc' }
          : { availableSeats: 'desc' }, // seats
      skip: pageOffset,
      take: limit,
    });

    // Get total count for pagination
    const total = await prisma.schedule.count({ where });

    // Transform to enhanced format matching frontend expectations
    const enhanced = schedules
      .map((sch) => {
        const route = sch.route;
        const bus = sch.bus;
        const company = sch.company;

        // Filter by city names if specified
        if (from && !route.origin.toLowerCase().includes(from)) return null;
        if (to && !route.destination.toLowerCase().includes(to)) return null;

        const dep = new Date(sch.departureDateTime);
        const arr = new Date(sch.arrivalDateTime);
        const durationMs = arr.getTime() - dep.getTime();
        const durationMin = Math.round(durationMs / 60000);

        // Smart Segment Filtering: If we have an from city, check if it's still bookable
        let originStopId: string | undefined;
        if (from && route.stops) {
          const stops = route.stops as any[];
          const match = stops.find(s => s.name.toLowerCase().includes(from));
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
          status: sch.status,
          date: dep.toISOString().split('T')[0],
          departureDateTime: sch.departureDateTime,
          arrivalDateTime: sch.arrivalDateTime,
          departureTime: dep.toTimeString().slice(0, 5),
          arrivalTime: arr.toTimeString().slice(0, 5),
          duration: durationMin,
          distance: route.distance || 0,
          companyName: company?.name || 'Unknown',
          companyLogo: company?.logo,
          origin: route.origin,
          destination: route.destination,
          busNumber: bus?.licensePlate || 'N/A',
          busType: bus?.busType || 'Standard',
          amenities: (bus?.amenities as string[]) || [],
          totalSeats: bus?.capacity || 40,
        };
      })
      .filter(item => item !== null) as any[] as EnhancedSchedule[];

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
    console.error('[schedules] Error:', error);
    await logger.logError('api', 'Failed to fetch schedules', error, {
      action: 'fetch_error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch schedules',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

