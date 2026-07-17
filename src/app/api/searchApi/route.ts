import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Route, Schedule, Bus, Company } from "@prisma/client";
import { checkAndRollSchedules } from "@/lib/schedule-generator";
import { logger } from "@/lib/logger";

interface SearchResultPayload {
  schedule: Schedule;
  route: Route;
  bus: Bus;
  company: Company;
}

export async function POST(request: Request) {
  try {
    // Ensure future schedules are active and running all the time (asynchronously)
    checkAndRollSchedules().catch((err: any) => {
      logger.logError('api', '[schedule-generator] Async roll error', err);
    });

    const { origin, destination, date, passengers = 1 } = await request.json();

    if (!origin || !destination) {
      return NextResponse.json({ error: "Missing origin or destination" }, { status: 400 });
    }

    // 1. Fuzzy search for routes matching origin/destination using similarity
    // We use raw query for pg_trgm similarity matching (threshold defaults to 0.3)
    const routes = await prisma.$queryRaw<Route[]>`
      SELECT * FROM "Route"
      WHERE 
        ("origin" % ${origin} OR "origin" ILIKE ${`%${origin}%`})
        AND 
        ("destination" % ${destination} OR "destination" ILIKE ${`%${destination}%`})
        AND "isActive" = true
      ORDER BY (similarity("origin", ${origin}) + similarity("destination", ${destination})) DESC
      LIMIT 10
    `;

    if (routes.length === 0) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    const routeIds = routes.map((r) => r.id);

    // 2. Fetch active schedules for these routes
    const schedules = await prisma.schedule.findMany({
      where: {
        routeId: { in: routeIds },
        departureDateTime: {
          gte: date ? new Date(date) : new Date(),
        },
        availableSeats: {
          gte: parseInt(passengers.toString()) || 1,
        },
        status: "active",
      },
      include: {
        route: true,
        bus: true,
        company: true,
      },
      orderBy: [{ departureDateTime: "asc" }],
    });

    const results: SearchResultPayload[] = schedules.map((s) => ({
      schedule: s,
      route: s.route,
      bus: s.bus,
      company: s.company,
    }));

    return NextResponse.json({ results }, { status: 200 });
  } catch (error: any) {
    await logger.logError('api', 'Search API error', error);
    return NextResponse.json({ error: "Failed to search buses" }, { status: 500 });
  }
}
