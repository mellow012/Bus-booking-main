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

/** Core DB query — separated so it can be called for cache misses and background revalidation */
async function querySchedules(params: {
  from: string;
  to: string;
  date: string;
  startDate: string;
  endDate: string;
  sortBy: SortBy;
  page: number;
  limit: number;
}) {
  const { from, to, date, startDate, endDate, sortBy, page, limit } = params;
  const pageOffset = (page - 1) * limit;

  // Round grace period to nearest 5 mins to improve cache alignment
  const nowTimestamp = Date.now();
  const roundedNow = Math.floor(nowTimestamp / (5 * 60 * 1000)) * (5 * 60 * 1000);
  const gracePeriod = new Date(roundedNow - 15 * 60 * 1000);

  // Build where clause
  const where: any = {
    status: 'active',
    availableSeats: { gt: 0 },
    company: { status: 'active' },
    route: { isActive: true },
  };

  const now = new Date();
  const recentDepartureCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

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
      where.departureDateTime.gte = start < gracePeriod ? gracePeriod : start;
    }
    if (endDate) where.departureDateTime.lte = new Date(endDate);
  } else if (!date) {
    where.departureDateTime = { gte: recentDepartureCutoff };
    where.arrivalDateTime = { gt: now };
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

  const orderByQuery =
    sortBy === 'time' || (sortBy as string) === 'departureDateTime'
      ? { departureDateTime: 'asc' }
      : sortBy === 'price_asc'
      ? { price: 'asc' }
      : sortBy === 'price_desc'
      ? { price: 'desc' }
      : { availableSeats: 'desc' };

  const [schedules, total] = await Promise.all([
    prisma.schedule.findMany({
      where,
      include: {
        route: true,
        bus: { include: { company: true } },
        company: true,
      },
      orderBy: orderByQuery as any,
      skip: pageOffset,
      take: limit,
    }),
    prisma.schedule.count({ where }),
  ]);

  // Transform to enhanced format
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

      // Smart Segment Filtering
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
    checkAndRollSchedules().catch((err) => {
      console.error('[schedule-generator] Async roll error:', err);
    });

    const searchParams = request.nextUrl.searchParams;

    const params = {
      from: searchParams.get('from')?.toLowerCase().trim() || '',
      to: searchParams.get('to')?.toLowerCase().trim() || '',
      date: searchParams.get('date') || '',
      startDate: searchParams.get('startDate') || '',
      endDate: searchParams.get('endDate') || '',
      sortBy: (searchParams.get('sortBy') || 'time') as SortBy,
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
          .catch((err) => {
            console.error('[schedules] Background revalidation failed:', err);
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

    // Store in cache
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
