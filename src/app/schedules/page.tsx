import { prisma } from "@/lib/prisma";
import SchedulesClient from "./SchedulesClient";
import { isSegmentBookable } from "@/lib/schedule-utils";
import { getRouteDistanceAndDuration } from "@/lib/route-utils";
import { formatTime24, formatDateISO } from "@/lib/timezone";

export const dynamic = 'force-dynamic';

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const from = (params.from as string)?.toLowerCase().trim() || '';
  const to = (params.to as string)?.toLowerCase().trim() || '';
  const searchDate = params.date as string || '';
  const tzOffset = typeof params.tzOffset === 'string' ? parseInt(params.tzOffset, 10) : NaN;
  const hasValidTzOffset = !Number.isNaN(tzOffset);

  const getLocalDayRange = (date: string, offset: number) => {
    const [year, month, day] = date.split('-').map(Number);
    const startUtc = new Date(Date.UTC(year, month - 1, day, 0) + offset * 60 * 1000);
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { startUtc, endUtc };
  };

  const getLocalTodayString = (offset: number) => {
    const localNow = new Date(Date.now() - offset * 60 * 1000);
    return localNow.toISOString().split('T')[0];
  };

  // 1. Fetch companies
  const companiesData = await prisma.company.findMany({
    where: { status: 'active' },
    select: { id: true, name: true },
  });

  // 2. Fetch initial schedules
  const startOfWeek = new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  endOfWeek.setHours(23, 59, 59, 999);

  const where: any = {
    status: 'active',
    availableSeats: { gt: 0 },
    company: { status: 'active' },
    route: { isActive: true },
  };

  if (from) where.route.origin = { contains: from, mode: 'insensitive' };
  if (to) where.route.destination = { contains: to, mode: 'insensitive' };

  if (searchDate) {
    const todayStr = hasValidTzOffset ? getLocalTodayString(tzOffset) : new Date().toISOString().split('T')[0];
    let startOfDay = new Date(`${searchDate}T00:00:00Z`);
    let endOfDay = new Date(`${searchDate}T23:59:59Z`);
    if (hasValidTzOffset) {
      const range = getLocalDayRange(searchDate, tzOffset);
      startOfDay = range.startUtc;
      endOfDay = range.endUtc;
    }
    where.departureDateTime = {
      gte: searchDate === todayStr ? new Date(Date.now() - 15 * 60 * 1000) : startOfDay,
      lte: endOfDay,
    };
  } else {
    // Default to next 7 days if no specific date
    where.departureDateTime = {
      gte: new Date(Date.now() - 15 * 60 * 1000), // from 15 mins ago
      lte: endOfWeek,
    };
  }

  const schedulesData = await prisma.schedule.findMany({
    where,
    include: {
      route: true,
      bus: { include: { company: true } },
      company: true,
      _count: { select: { reservations: true } },
    },
    orderBy: { departureDateTime: 'asc' },
    take: 150,
  });

  const enhancedSchedules = schedulesData
    .filter((sch) => sch.arrivalDateTime >= new Date())
    .map((sch) => {
      const route = sch.route;
      const bus = sch.bus;
      const company = sch.company;

      if (!route || !bus || !company) return null;

      const dep = new Date(sch.departureDateTime);
      const arr = new Date(sch.arrivalDateTime);
      const durationMs = arr.getTime() - dep.getTime();
      const durationMin = Math.round(durationMs / 60000);

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
        // Ignore error
      }

      const routeInfo = getRouteDistanceAndDuration(route.origin, route.destination);
      const distanceKm = routeInfo.distance;
      const actualAvailableSeats = Math.max(0, bus.capacity - (sch._count?.reservations || 0));

      return {
        id: sch.id,
        companyName: company.name || 'Unknown',
        busNumber: bus.licensePlate || 'N/A',
        busType: bus.busType || 'Standard',
        origin: route.origin,
        destination: route.destination,
        departureTime: formatTime24(sch.departureDateTime),
        arrivalTime: formatTime24(sch.arrivalDateTime),
        availableSeats: actualAvailableSeats,
        price: sch.price,
        duration: durationMin,
        distance: distanceKm,
        date: formatDateISO(sch.departureDateTime),
        companyLogo: company.logo || null,
        companyId: sch.companyId,
        routeId: sch.routeId,
        departureLocation: sch.departureLocation || company.address || `${route.origin} Main Terminal`,
        arrivalLocation: sch.arrivalLocation || `${route.destination} Main Terminal`,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const seen = new Set<string>();
  const deduplicatedSchedules: typeof enhancedSchedules = [];
  for (const item of enhancedSchedules as any[]) {
    const key = `${item.companyId}-${item.routeId}-${item.date}-${item.departureTime}-${item.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduplicatedSchedules.push(item);
  }

  return (
    <SchedulesClient 
      initialSchedules={deduplicatedSchedules} 
      initialCompanies={companiesData} 
    />
  );
}
