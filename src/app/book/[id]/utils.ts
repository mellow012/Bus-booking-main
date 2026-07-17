import { Route } from "@/types";

export interface NormalisedStop {
  id: string;
  name: string;
  distanceFromOrigin: number;
  order: number;
}

export function buildNormalisedStops(route: Route): NormalisedStop[] {
  const stops: NormalisedStop[] = [];
  stops.push({ id: "__origin__", name: route.origin, distanceFromOrigin: 0, order: -1 });

  const intermediate = (route.stops ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  intermediate.forEach((s, i) => {
    stops.push({
      id: s.id,
      name: s.name,
      distanceFromOrigin: s.distanceFromOrigin > 0
        ? s.distanceFromOrigin
        : Math.round(((i + 1) / (intermediate.length + 1)) * (route.distance || 100)),
      order: i,
    });
  });

  stops.push({
    id: "__destination__", name: route.destination,
    distanceFromOrigin: route.distance || 100, order: intermediate.length,
  });
  return stops;
}

// ✅ New — stop-index based, matches server logic exactly
export function calcSegmentPrice(
  originDist: number, destDist: number,
  route: Route, schedulePrice: number, isFullTrip: boolean,
  stops: NormalisedStop[], originId: string, destId: string,
  segmentPrices?: Record<string, number>
): number {
  if (isFullTrip) return schedulePrice;

  const key = `${originId}:${destId}`;
  const price = segmentPrices?.[key];
  if (typeof price === 'number' && price > 0) return price;

  const oi = stops.findIndex(s => s.id === originId);
  const di = stops.findIndex(s => s.id === destId);
  if (oi !== -1 && di !== -1 && di > oi && stops.length > 1) {
    const raw = ((di - oi) / (stops.length - 1)) * schedulePrice;
    return Math.max(50, Math.round(raw / 50) * 50);
  }

  const segKm = Math.max(0, destDist - originDist);
  const totalKm = route.distance || 0;
  if (totalKm > 0 && segKm > 0)
    return Math.max(50, Math.round(((segKm / totalKm) * schedulePrice) / 50) * 50);

  return schedulePrice;
}

export const formatTime = (timestamp: any) => {
  if (!timestamp) return "N/A";
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch { return "N/A"; }
};

export const formatDate = (timestamp: any) => {
  if (!timestamp) return "N/A";
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  } catch { return "N/A"; }
};

export const formatDuration = (minutes: number) => {
  if (!minutes || minutes < 0) return "N/A";
  const h = Math.floor(minutes / 60); const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
