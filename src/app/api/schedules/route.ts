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
import { checkAndRollSchedules } from '@/lib/schedule-generator';

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
  departureLocation?: string;
}

type SortBy = 'time' | 'price_asc' | 'price_desc' | 'seats';

export async function GET(request: NextRequest) {
  try {
    // Ensure future schedules are active and running all the time
    await checkAndRollSchedules();

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
      company: { status: 'active' }, 
      // Filter by route cities in DB
      route: {
        isActive: true,
      }
    };

    if (from) {
      where.route.origin = { contains: from, mode: 'insensitive' };
    }
    if (to) {
      where.route.destination = { contains: to, mode: 'insensitive' };
    }

    if (startDate || endDate) {
      where.departureDateTime = {};
      if (startDate) {
        const start = new Date(startDate);
        const gracePeriod = new Date(Date.now() - 15 * 60 * 1000);
        where.departureDateTime.gte = start < gracePeriod ? gracePeriod : start;
      }
      if (endDate) where.departureDateTime.lte = new Date(endDate);
    } else if (!date) {
      // Only fetch schedules departing from 15 minutes ago onwards.
      // This prevents departed/completed schedules from filling up the 'take: 30' query limit
      // and causing all results to be filtered out in-memory.
      const gracePeriod = new Date(Date.now() - 15 * 60 * 1000);
      where.departureDateTime = { gte: gracePeriod };
    }

    if (date) {
      const todayStr = new Date().toISOString().split('T')[0];
      const startOfDay = new Date(`${date}T00:00:00Z`);
      const endOfDay = new Date(`${date}T23:59:59Z`);
      where.departureDateTime = {
        gte: date === todayStr ? new Date(Date.now() - 15 * 60 * 1000) : startOfDay,
        lte: endOfDay,
      };
    }

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
          : { availableSeats: 'desc' }, 
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

        if (!route || !bus || !company) return null;


        const dep = new Date(sch.departureDateTime);
        const arr = new Date(sch.arrivalDateTime);
        const durationMs = arr.getTime() - dep.getTime();
        const durationMin = Math.round(durationMs / 60000);

        // Smart Segment Filtering: If we have an from city, check if it's still bookable
        let originStopId: string | undefined;
        if (from && Array.isArray(route.stops)) {
          const stops = route.stops as any[];
          const match = stops.find(s => s?.name?.toLowerCase().includes(from));
          if (match) originStopId = match.id;
        }

        try {
          const bookable = isSegmentBookable(sch, originStopId);
          if (!bookable) return null;
        } catch (err) {
          console.error("Error checking bookable status for schedule", sch.id, err);
          // Default to bookable if check fails to avoid hiding results due to logic errors
        }

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
          departureLocation: sch.departureLocation || company.address || `${route.origin} Main Terminal`,
          arrivalLocation: sch.arrivalLocation || `${route.destination} Main Terminal`,
        };
      })
      .filter(item => item !== null) as any[] as EnhancedSchedule[];

    // Deduplicate identical schedules (same company, same route, same date, same time, same price)
    const seen = new Set<string>();
    const deduplicated: EnhancedSchedule[] = [];
    for (const item of enhanced) {
      const key = `${item.companyId}-${item.routeId}-${item.date}-${item.departureTime}-${item.price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduplicated.push(item);
    }

    return NextResponse.json({
      success: true,
      data: deduplicated,
      pagination: {
        page,
        limit,
        total: deduplicated.length,
        pages: Math.ceil(deduplicated.length / limit),
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

