import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes – Vercel max for Pro plan

/**
 * Rolling schedule generator for unpartnered bus operators.
 *
 * Strategy:
 *  - Runs daily (see vercel.json).
 *  - Finds every company where isPartner=false (schedule-only operators).
 *  - For each of their buses, looks up existing routes and fills in any
 *    missing schedules up to DAYS_AHEAD days from today.
 *  - Uses createMany({ skipDuplicates: true }) so re-runs are fully idempotent.
 *  - Also soft-archives stale past schedules (older than ARCHIVE_AFTER_DAYS)
 *    by setting isArchived=true so they stop cluttering search results.
 */

const DAYS_AHEAD = 30;        // Keep a rolling 30-day (monthly) window
const ARCHIVE_AFTER_DAYS = 2; // Archive schedules more than 2 days in the past

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev: no secret configured → open

  const auth  = request.headers.get('authorization') || '';
  const xCron = request.headers.get('x-cron-secret') || '';
  const query = request.nextUrl.searchParams.get('secret') || '';

  return (
    auth === `Bearer ${secret}` ||
    auth === secret ||
    xCron === secret ||
    query === secret
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now   = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 1 – Archive stale past schedules for unpartnered companies
    // ──────────────────────────────────────────────────────────────────────────
    const archiveCutoff = new Date(today);
    archiveCutoff.setDate(today.getDate() - ARCHIVE_AFTER_DAYS);

    const { count: archivedCount } = await prisma.schedule.updateMany({
      where: {
        isArchived: false,
        departureDateTime: { lt: archiveCutoff },
        company: { isPartner: false },
      },
      data: { isArchived: true },
    });

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 2 – Fetch all unpartnered companies with their buses & routes
    // ──────────────────────────────────────────────────────────────────────────
    const companies = await prisma.company.findMany({
      where: { isPartner: false, status: { not: 'deleted' } },
      select: {
        id: true,
        name: true,
        buses: {
          where: { isActive: true },
          select: { id: true, capacity: true, busType: true },
        },
        routes: {
          where: { isActive: true },
          select: {
            id: true,
            origin: true,
            destination: true,
            duration: true,
            baseFare: true,
            name: true,
          },
        },
      },
    });

    if (companies.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unpartnered companies found.',
        archived: archivedCount,
        created: 0,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 3 – For each company/bus/route combo, fill missing days
    // ──────────────────────────────────────────────────────────────────────────
    let totalCreated = 0;
    const companyResults: { name: string; created: number }[] = [];

    for (const company of companies) {
      if (company.buses.length === 0 || company.routes.length === 0) continue;

      // Determine departure time per bus by reading the earliest existing
      // schedule for that bus (preserves the operator's original timetable).
      // Fall back to 07:00 if none found.
      const busTimeMap = new Map<string, { hours: number; minutes: number }>();
      for (const bus of company.buses) {
        const sample = await prisma.schedule.findFirst({
          where: { busId: bus.id, companyId: company.id },
          orderBy: { departureDateTime: 'asc' },
          select: { departureDateTime: true },
        });
        if (sample) {
          busTimeMap.set(bus.id, {
            hours:   sample.departureDateTime.getUTCHours(),
            minutes: sample.departureDateTime.getUTCMinutes(),
          });
        } else {
          busTimeMap.set(bus.id, { hours: 7, minutes: 0 }); // default
        }
      }

      // Find which (busId, routeId, date) combos already exist in the window
      const windowStart = new Date(today);
      const windowEnd   = new Date(today);
      windowEnd.setDate(today.getDate() + DAYS_AHEAD);

      const existing = await prisma.schedule.findMany({
        where: {
          companyId: company.id,
          departureDateTime: { gte: windowStart, lt: windowEnd },
          isArchived: false,
        },
        select: { busId: true, routeId: true, departureDateTime: true },
      });

      // Build a set of keys we already have: `busId|routeId|YYYY-MM-DD`
      const existingKeys = new Set<string>(
        existing.map((s) => {
          const d = s.departureDateTime;
          const dateStr = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
          return `${s.busId}|${s.routeId}|${dateStr}`;
        })
      );

      const toCreate: {
        companyId: string;
        busId: string;
        routeId: string;
        departureDateTime: Date;
        arrivalDateTime: Date;
        price: number;
        baseFare: number;
        availableSeats: number;
        status: string;
        tripStatus: string;
        departureLocation: string;
        arrivalLocation: string;
      }[] = [];

      // Sample departure and arrival locations per route to preserve real pick-up/drop-off points
      const routeLocationMap = new Map<string, { depLoc: string; arrLoc: string }>();
      for (const route of company.routes) {
        const sample = await prisma.schedule.findFirst({
          where: { routeId: route.id, companyId: company.id, departureLocation: { not: null } },
          select: { departureLocation: true, arrivalLocation: true },
        });
        if (sample?.departureLocation && sample?.arrivalLocation) {
          routeLocationMap.set(route.id, {
            depLoc: sample.departureLocation,
            arrLoc: sample.arrivalLocation,
          });
        } else {
          routeLocationMap.set(route.id, {
            depLoc: `${route.origin} Main Station`,
            arrLoc: `${route.destination} Main Terminal`,
          });
        }
      }

      // Pair each bus with each route (simple 1-bus-per-route heuristic)
      // If there are multiple buses, cycle them across routes
      for (let routeIdx = 0; routeIdx < company.routes.length; routeIdx++) {
        const route = company.routes[routeIdx];
        const bus   = company.buses[routeIdx % company.buses.length];
        const time  = busTimeMap.get(bus.id)!;
        const locs  = routeLocationMap.get(route.id)!;

        for (let d = 0; d < DAYS_AHEAD; d++) {
          const depDate = new Date(today);
          depDate.setDate(today.getDate() + d);
          depDate.setUTCHours(time.hours, time.minutes, 0, 0);

          const dateStr = `${depDate.getUTCFullYear()}-${depDate.getUTCMonth()}-${depDate.getUTCDate()}`;
          const key = `${bus.id}|${route.id}|${dateStr}`;

          if (existingKeys.has(key)) continue; // already exists, skip

          const arrDate = new Date(depDate);
          arrDate.setMinutes(arrDate.getMinutes() + route.duration);

          toCreate.push({
            companyId:         company.id,
            busId:             bus.id,
            routeId:           route.id,
            departureDateTime: depDate,
            arrivalDateTime:   arrDate,
            price:             route.baseFare,
            baseFare:          route.baseFare,
            availableSeats:    bus.capacity,
            status:            'active',
            tripStatus:        'scheduled',
            departureLocation: locs.depLoc,
            arrivalLocation:   locs.arrLoc,
          });
        }
      }

      if (toCreate.length > 0) {
        const { count } = await prisma.schedule.createMany({
          data: toCreate,
          skipDuplicates: true,
        });
        totalCreated += count;
        companyResults.push({ name: company.name, created: count });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${totalCreated} new schedules across ${companyResults.length} operators. Archived ${archivedCount} stale past schedules.`,
      archived:  archivedCount,
      created:   totalCreated,
      companies: companyResults,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[generate-unpartnered-schedules] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// Vercel cron invocations use GET; proxy to POST handler
export async function GET(request: NextRequest) {
  return POST(request);
}
