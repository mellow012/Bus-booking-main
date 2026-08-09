import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import BookBusClient from "./BookBusClient";

interface RouteStop { id: string; name: string; price?: number; order?: number; distanceFromOrigin?: number; }

function getSegmentPrice(
  schedule: any,
  route: any,
  originStopId?: string,
  destinationStopId?: string
): number {
  const fullFare = schedule.price || 0;
  if (!originStopId || !destinationStopId) return fullFare;
  if (originStopId === "__origin__" && destinationStopId === "__destination__") return fullFare;

  // 1. Check segment override
  const segmentPrices = (schedule.segmentPrices as Record<string, number>) || {};
  const segmentKey = `${originStopId}:${destinationStopId}`;
  if (typeof segmentPrices[segmentKey] === 'number' && segmentPrices[segmentKey] > 0) {
    return segmentPrices[segmentKey];
  }

  // 2. Build stops list
  const stops: RouteStop[] = [];
  stops.push({ id: '__origin__', name: route.origin, distanceFromOrigin: 0, price: 0 });
  const intermediate = Array.isArray(route.stops) ? route.stops.slice().sort((a: any, b: any) => (a.order || 0) - (b.order || 0)) : [];
  intermediate.forEach((s: any, idx: number) => {
    stops.push({
      id: s.id,
      name: s.name,
      distanceFromOrigin: s.distanceFromOrigin || Math.round(((idx + 1) / (intermediate.length + 1)) * (route.distance || 100)),
      price: typeof s.price === 'number' ? s.price : undefined,
    });
  });
  stops.push({ id: '__destination__', name: route.destination, distanceFromOrigin: route.distance || 100, price: route.baseFare || 0 });

  const originStop = stops.find(s => s.id === originStopId);
  const destStop = stops.find(s => s.id === destinationStopId);

  // 3. Stop-level price diff
  if (
    originStop && destStop &&
    typeof originStop.price === 'number' &&
    typeof destStop.price === 'number' &&
    destStop.price > originStop.price
  ) {
    return destStop.price - originStop.price;
  }

  // 4. Proportional fallback
  const oi = stops.findIndex(s => s.id === originStopId);
  const di = stops.findIndex(s => s.id === destinationStopId);
  if (oi !== -1 && di !== -1 && di > oi && stops.length > 1) {
    const raw = ((di - oi) / (stops.length - 1)) * fullFare;
    return Math.max(50, Math.round(raw / 50) * 50);
  }

  return fullFare;
}

export async function generateMetadata(props: { 
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const scheduleId = params.id;

  const originStopId = typeof searchParams.originStopId === 'string' ? searchParams.originStopId : undefined;
  const destinationStopId = typeof searchParams.destinationStopId === 'string' ? searchParams.destinationStopId : undefined;

  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        company: true,
        route: true,
        bus: true,
      }
    });

    if (!schedule || !schedule.company || !schedule.route) {
      return {
        title: 'Schedule Not Found | TibhukeBus',
        description: 'The requested bus schedule could not be found.'
      };
    }

    const sch: any = schedule;
    const staticBookedSeats: string[] = Array.isArray(sch.bookedSeats) ? sch.bookedSeats : [];
    
    // Fetch active segments and reservations
    const [bookings, bookingSegments, reservations] = await Promise.all([
      prisma.booking.findMany({
        where: { scheduleId: schedule.id, bookingStatus: { not: 'cancelled' } },
        select: { seatNumbers: true }
      }),
      prisma.bookingSegment.findMany({
        where: { scheduleId: schedule.id, booking: { bookingStatus: { not: 'cancelled' } } },
        select: { seatNumbers: true }
      }),
      prisma.seatReservation.findMany({
        where: { scheduleId: schedule.id, expiresAt: { gt: new Date() } },
        select: { seatNumbers: true }
      })
    ]);

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

    const allOccupiedSeatsSet = new Set<string>([
      ...staticBookedSeats,
      ...bookings.flatMap(b => parseSeatArray(b.seatNumbers)),
      ...bookingSegments.flatMap(s => parseSeatArray(s.seatNumbers)),
      ...reservations.flatMap(r => parseSeatArray(r.seatNumbers)),
    ]);

    const totalSeats = schedule.bus?.capacity || 40;
    const liveAvailableSeats = Math.max(totalSeats - allOccupiedSeatsSet.size, 0);

    // Build route stops helper to find names
    const stopsList = (() => {
      const list: { id: string; name: string }[] = [];
      list.push({ id: '__origin__', name: schedule.route.origin });
      const intermediate = Array.isArray(schedule.route.stops) ? schedule.route.stops.slice().sort((a: any, b: any) => (a.order || 0) - (b.order || 0)) : [];
      intermediate.forEach((s: any) => list.push({ id: s.id, name: s.name }));
      list.push({ id: '__destination__', name: schedule.route.destination });
      return list;
    })();

    const displayOrigin = originStopId ? (stopsList.find(s => s.id === originStopId)?.name || schedule.route.origin) : schedule.route.origin;
    const displayDestination = destinationStopId ? (stopsList.find(s => s.id === destinationStopId)?.name || schedule.route.destination) : schedule.route.destination;

    const resolvedFare = getSegmentPrice(schedule, schedule.route, originStopId, destinationStopId);

    const title = `${displayOrigin} to ${displayDestination} | ${schedule.company.name}`;
    const description = `Book your trip from ${displayOrigin} to ${displayDestination} on ${new Date(schedule.departureDateTime).toLocaleDateString()} with ${schedule.company.name}. ${liveAvailableSeats} seats available.`;

    // Assuming the app is deployed at process.env.NEXT_PUBLIC_APP_URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tibhukebus.com';
    const ogImageUrl = `${appUrl}/api/og?route=${encodeURIComponent(`${displayOrigin} to ${displayDestination}`)}&date=${encodeURIComponent(new Date(schedule.departureDateTime).toISOString())}&fare=${resolvedFare}&company=${encodeURIComponent(schedule.company.name)}&busType=${encodeURIComponent(schedule.bus?.busType || 'Bus')}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images: [{
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImageUrl],
      },
    };
  } catch (err) {
    console.error('[generateMetadata] CAUGHT ERROR:', err);
    return {
      title: 'Book Schedule | TibhukeBus',
    };
  }
}

export default function BookBusPage() {
  return <BookBusClient />;
}
