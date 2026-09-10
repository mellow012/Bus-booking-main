interface RouteStop {
  id: string;
  name: string;
  price?: number;
}

function buildStopList(routeData: any): RouteStop[] {
  const stops: RouteStop[] = [];
  const baseFare = routeData?.baseFare ?? routeData?.price ?? routeData?.fare ?? 0;
  if (routeData?.origin) stops.push({ id: '__origin__', name: routeData.origin, price: 0 });
  if (Array.isArray(routeData?.stops)) {
    for (const stop of routeData.stops) {
      if (stop?.id && stop?.name) {
        stops.push({
          id: stop.id,
          name: stop.name,
          price: typeof stop.price === 'number' ? stop.price : undefined,
        });
      }
    }
  }
  if (routeData?.destination) {
    stops.push({ id: '__destination__', name: routeData.destination, price: baseFare });
  }
  return stops;
}

function proportionalFare(
  fullPrice: number,
  stopList: RouteStop[],
  originId: string,
  destinationId: string,
): number | null {
  const originIndex = stopList.findIndex((stop) => stop.id === originId);
  const destinationIndex = stopList.findIndex((stop) => stop.id === destinationId);
  if (originIndex === -1 || destinationIndex === -1 || destinationIndex <= originIndex) return null;
  const totalIntervals = stopList.length - 1;
  const segmentIntervals = destinationIndex - originIndex;
  if (totalIntervals <= 0) return null;
  const raw = (segmentIntervals / totalIntervals) * fullPrice;
  return Math.max(50, Math.round(raw / 50) * 50);
}

export function calculateSegmentFare(
  scheduleData: any,
  routeData: any,
  originStopId?: string,
  destinationStopId?: string,
): {
  fare: number;
  fareSource: 'full_trip' | 'operator_set' | 'route_stop_pricing' | 'proportional_fallback';
} {
  const fullFare = scheduleData.baseFare ?? scheduleData.price ?? scheduleData.fare;
  let baseFare = fullFare;
  let fareSource: 'full_trip' | 'operator_set' | 'route_stop_pricing' | 'proportional_fallback' = 'full_trip';

  const isSegment = Boolean(
    originStopId &&
    destinationStopId &&
    (originStopId !== '__origin__' || destinationStopId !== '__destination__'),
  );

  if (isSegment && originStopId && destinationStopId) {
    const segmentKey = `${originStopId}:${destinationStopId}`;
    const segmentPrices: Record<string, number> = scheduleData.segmentPrices ?? {};
    const operatorPrice = segmentPrices[segmentKey];

    if (typeof operatorPrice === 'number' && operatorPrice > 0) {
      baseFare = operatorPrice;
      fareSource = 'operator_set';
    } else {
      const stopList = buildStopList(routeData ?? scheduleData);
      const originStop = stopList.find((stop) => stop.id === originStopId);
      const destinationStop = stopList.find((stop) => stop.id === destinationStopId);

      if (
        originStop &&
        destinationStop &&
        typeof originStop.price === 'number' &&
        typeof destinationStop.price === 'number' &&
        destinationStop.price > originStop.price
      ) {
        baseFare = destinationStop.price - originStop.price;
        fareSource = 'route_stop_pricing';
      } else {
        const calculated = proportionalFare(fullFare, stopList, originStopId, destinationStopId);
        if (calculated !== null) {
          baseFare = calculated;
          fareSource = 'proportional_fallback';
        }
      }
    }
  }

  return { fare: baseFare, fareSource };
}
