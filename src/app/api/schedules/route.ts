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
    const date = searchParams.get('date') || ''; // YYYY-MM-DD
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT)),
      MAX_LIMIT
    );
    const sortBy = (searchParams.get('sortBy') || 'time') as SortBy;
    const pageOffset = (page - 1) * limit;

    // Build where clause
    const where: any = {
      status: 'active',
      availableSeats: { gt: 0 },
      // Only show future schedules
      departureDateTime: { gt: new Date() },
      company: { status: 'active' }, // Only show schedules from active companies
    };

    // Optional: filter by date if provided
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
        sortBy === 'time'
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

        return {
          id: sch.id,
          companyId: sch.companyId,
          busId: sch.busId,
          routeId: sch.routeId,
          price: sch.price,
          availableSeats: sch.availableSeats,
          status: sch.status,
          date: dep.toISOString().split('T')[0],
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

