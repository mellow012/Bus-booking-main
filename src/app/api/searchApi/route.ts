import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SearchResult } from "@/types";

export async function POST(request: Request) {
  try {
    const { origin, destination, date, passengers = 1 } = await request.json();

    if (!origin || !destination) {
      return NextResponse.json({ error: "Missing origin or destination" }, { status: 400 });
    }

    // 1. Fuzzy search for routes matching origin/destination using similarity
    // We use raw query for pg_trgm similarity matching (threshold defaults to 0.3)
    const routes: any[] = await prisma.$queryRaw`
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

    const results: any[] = schedules.map((s) => ({
      schedule: {
        ...s,
        departureDateTime: s.departureDateTime,
        arrivalDateTime: s.arrivalDateTime,
      } as any,
      route: s.route as any,
      bus: s.bus as any,
      company: s.company as any,
    }));

    console.log("Search results found:", results.length);
    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Failed to search buses" }, { status: 500 });
  }
}
