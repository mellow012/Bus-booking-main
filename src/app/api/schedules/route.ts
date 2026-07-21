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
 * Returns enhanced schedule list with company, bus, route data joined.
 * 
 * Performance strategy:
 * - Server-side in-memory cache (30s fresh, 60s stale-while-revalidate)
 * - Schedule rolling runs asynchronously at most once every 5 minutes
 * - Cache keys are normalized (e.g. city names lowercased) for max hit rates
 * - Response headers include Cache-Control for browser/CDN caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { isSegmentBookable } from '@/lib/schedule-utils';
import { checkAndRollSchedules } from '@/lib/schedule-generator';
import { serverCache, createScheduleCacheKey } from '@/lib/cache';
import { getRouteDistanceAndDuration } from '@/lib/route-utils';

export const dynamic = 'force-dynamic';



const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// Fresh for 30 seconds, serve stale for another 60 seconds while revalidating
const CACHE_FRESH_MS = 30_000;
const CACHE_STALE_MS = 60_000;

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

function getLocalDayRange(date: string, tzOffsetMinutes: number) {
  const [year, month, day] = date.split('-').map(Number);
  const startUtc = new Date(Date.UTC(year, month - 1, day, 0) + tzOffsetMinutes * 60 * 1000);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { startUtc, endUtc };
}

function getLocalDateString(now: Date, tzOffsetMinutes: number) {
  const localTime = new Date(now.getTime() - tzOffsetMinutes * 60 * 1000);
  return localTime.toISOString().split('T')[0];
}

/** Core DB query — separated so it can be called for cache misses and background revalidation */
async function querySchedules(params: {
  from: string;
  to: string;
  date: string;
  startDate: string;
  endDate: string;
  sortBy: SortBy;
  companyId?: string;
  tzOffset?: number;
  page: number;
  limit: number;
}) {
  const { from, to, date, startDate, endDate, sortBy, companyId, page, limit } = params;
  const pageOffset = (page - 1) * limit;

  // Round grace period to nearest 5 mins to improve cache alignment
  const nowTimestamp = Date.now();
  const roundedNow = Math.floor(nowTimestamp / (5 * 60 * 1000)) * (5 * 60 * 1000);
  const gracePeriod = new Date(roundedNow - 15 * 60 * 1000);

  // Build where clause
  const routeFilter: any = { isActive: true };
  if (from) {
    routeFilter.origin = { contains: from, mode: 'insensitive' };
  }
  if (to) {
    routeFilter.destination = { contains: to, mode: 'insensitive' };
  }

  const where: any = {
    status: 'active',
    availableSeats: { gt: 0 },
    company: { status: 'active' },
    route: routeFilter,
  };

  if (companyId) {
    where.companyId = companyId;
  }

  const now = new Date();
  const recentDepartureCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  if (startDate || endDate) {
    const depTimeFilter: any = {};
    if (startDate) {
      const start = new Date(startDate);
      depTimeFilter.gte = start < gracePeriod ? gracePeriod : start;
    }
    if (endDate) depTimeFilter.lte = new Date(endDate);
    where.departureDateTime = depTimeFilter;
  } else if (!date) {
    where.departureDateTime = { gte: recentDepartureCutoff };
    where.arrivalDateTime = { gt: now };
  }

  if (date) {
    const todayStr = typeof params.tzOffset === 'number' && !Number.isNaN(params.tzOffset)
      ? getLocalDateString(new Date(), params.tzOffset)
      : new Date().toISOString().split('T')[0];

    let startOfDay = new Date(`${date}T00:00:00Z`);
    let endOfDay = new Date(`${date}T23:59:59Z`);

    if (typeof params.tzOffset === 'number' && !Number.isNaN(params.tzOffset)) {
      const range = getLocalDayRange(date, params.tzOffset);
      startOfDay = range.startUtc;
      endOfDay = range.endUtc;
    }

    where.departureDateTime = {
      gte: date === todayStr ? new Date(Date.now() - 15 * 60 * 1000) : startOfDay,
      lte: endOfDay,
    };
  }

  let orderByQuery: any;
  if (sortBy === 'time' || (sortBy as string) === 'departureDateTime') {
    orderByQuery = { departureDateTime: 'asc' };
  } else if (sortBy === 'price_asc') {
    orderByQuery = { price: 'asc' };
  } else if (sortBy === 'price_desc') {
    orderByQuery = { price: 'desc' };
  } else {
    orderByQuery = { availableSeats: 'desc' };
  }

  const [schedules, total] = await Promise.all([
    prisma.schedule.findMany({
      where,
      include: {
        route: true,
        bus: { include: { company: true } },
        company: true,
        bookings: true,
      },
      orderBy: orderByQuery,
      skip: pageOffset,
      take: limit,
    }),
    prisma.schedule.count({ where }),
  ]);

  interface StopInfo {
    id: string;
    name: string;
  }

  // Transform to enhanced format
  const enhanced = schedules
    .map((sch: any) => {
      const route = sch.route;
      const bus = sch.bus;
      const company = sch.company;

      if (!route || !bus || !company) return null;

      const dep = new Date(sch.departureDateTime);
      const arr = new Date(sch.arrivalDateTime);
      
      // Calculate dynamic real-time seats remaining
      const activeBookings = (sch.bookings || []).filter((b: any) => b.bookingStatus !== 'cancelled');
      let bookedSeatsCount = 0;
      activeBookings.forEach((b: any) => {
        const seats = Array.isArray(b.seatNumbers) ? b.seatNumbers : [];
        const passengerCount = Array.isArray(b.passengerDetails) ? b.passengerDetails.length : 1;
        bookedSeatsCount += seats.length > 0 ? seats.length : passengerCount;
      });
      const totalSeats = bus?.capacity || 40;
      const availableSeats = Math.max(totalSeats - bookedSeatsCount, 0);

      // Estimate distance and duration if missing or 0
      const dbDistance = route.distance || 0;
      const dbDuration = route.duration || 0;
      const routeInfo = getRouteDistanceAndDuration(route.origin, route.destination);
      const distance = dbDistance || routeInfo.distance;
      const duration = dbDuration || routeInfo.durationMinutes;

      // Smart Segment Filtering
      let originStopId: string | undefined;
      if (from && Array.isArray(route.stops)) {
        const stops = route.stops as unknown as StopInfo[];
        const match = stops.find(s => s?.name?.toLowerCase().includes(from));
        if (match) originStopId = match.id;
      }

      try {
        const bookable = isSegmentBookable(sch, originStopId);
        if (!bookable) return null;
      } catch (err: any) {
        logger.logError('api', `Error checking bookable status for schedule ${sch.id}`, err);
      }

      return {
        id: sch.id,
        companyId: sch.companyId,
        busId: sch.busId,
        routeId: sch.routeId,
        price: sch.price,
        availableSeats,
        status: sch.status,
        date: dep.toISOString().split('T')[0],
        departureDateTime: sch.departureDateTime,
        arrivalDateTime: sch.arrivalDateTime,
        departureTime: dep.toTimeString().slice(0, 5),
        arrivalTime: arr.toTimeString().slice(0, 5),
        duration,
        distance,
        companyName: company?.name || 'Unknown',
        companyLogo: company?.logo,
        origin: route.origin,
        destination: route.destination,
        busNumber: bus?.licensePlate || 'N/A',
        busType: bus?.busType || 'Standard',
        amenities: (bus?.amenities as string[]) || [],
        totalSeats,
        departureLocation: sch.departureLocation || company.address || `${route.origin} Main Terminal`,
        arrivalLocation: sch.arrivalLocation || `${route.destination} Main Terminal`,
      };
    })
    .filter((item: any) => item !== null) as EnhancedSchedule[];

  // Deduplicate identical schedules
  const seen = new Set<string>();
  const deduplicated: EnhancedSchedule[] = [];
  for (const item of enhanced) {
    const key = `${item.companyId}-${item.routeId}-${item.date}-${item.departureTime}-${item.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduplicated.push(item);
  }

  return {
    data: deduplicated,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / (limit || 1)),
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    // Fire-and-forget: ensure future schedules exist (runs at most once per 5 min)
    checkAndRollSchedules().catch((err: any) => {
      logger.logError('api', '[schedule-generator] Async roll error', err);
    });

    const searchParams = request.nextUrl.searchParams;

    const tzOffsetRaw = searchParams.get('tzOffset');
    const tzOffset = tzOffsetRaw ? parseInt(tzOffsetRaw, 10) : NaN;

    const params = {
      from: searchParams.get('from')?.toLowerCase().trim() || '',
      to: searchParams.get('to')?.toLowerCase().trim() || '',
      date: searchParams.get('date') || '',
      startDate: searchParams.get('startDate') || '',
      endDate: searchParams.get('endDate') || '',
      sortBy: (searchParams.get('sortBy') || 'time') as SortBy,
      companyId: searchParams.get('companyId') || undefined,
      tzOffset: Number.isNaN(tzOffset) ? undefined : tzOffset,
      page: Math.max(1, parseInt(searchParams.get('page') || '1')),
      limit: Math.min(parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT)), MAX_LIMIT),
    };

    const cacheKey = createScheduleCacheKey(params);

    // 1. Try cache first
    const cached = serverCache.get<{ data: EnhancedSchedule[]; pagination: any }>(cacheKey);

    if (cached && !cached.isStale) {
      // Cache HIT (fresh) — return immediately, zero DB cost
      return NextResponse.json(
        { success: true, ...cached.data },
        {
          headers: {
            'X-Cache': 'HIT',
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          },
        }
      );
    }

    if (cached && cached.isStale) {
      // Cache HIT (stale) — return stale data immediately, revalidate in background
      if (!serverCache.isRevalidating(cacheKey)) {
        serverCache.markRevalidating(cacheKey);
        // Background revalidation — doesn't block the response
        querySchedules(params)
          .then((freshResult) => {
            serverCache.set(cacheKey, freshResult, CACHE_FRESH_MS, CACHE_STALE_MS);
          })
          .catch((err: any) => {
            logger.logError('api', '[schedules] Background revalidation failed', err);
          })
          .finally(() => {
            serverCache.clearRevalidating(cacheKey);
          });
      }

      return NextResponse.json(
        { success: true, ...cached.data },
        {
          headers: {
            'X-Cache': 'STALE',
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          },
        }
      );
    }

    // 2. Cache MISS — query the database
    const result = await querySchedules(params);
    serverCache.set(cacheKey, result, CACHE_FRESH_MS, CACHE_STALE_MS);

    return NextResponse.json(
      { success: true, ...result },
      {
        headers: {
          'X-Cache': 'MISS',
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error: any) {
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
