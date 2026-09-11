import { Prisma, type Prisma as PrismaTypes } from '@prisma/client';
import { calculateSegmentFare } from '@/lib/segment-fare';

export type SegmentBookingTransaction = PrismaTypes.TransactionClient;

export interface SegmentBookingInput {
  scheduleId: string;
  seatNumbers: string[];
  date?: Date | string;
  originStopId?: string;
  destinationStopId?: string;
}

export interface SegmentBookingPaymentInput {
  paymentId: string;
  amount: number;
  currency?: string;
  customerEmail?: string;
  customerPhone?: string;
  paymentType?: string;
  provider?: string;
  status?: string;
  txRef?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface SegmentBookingCoreInput {
  booking: Omit<
    Prisma.BookingUncheckedCreateInput,
    'id' | 'totalAmount' | 'seatNumbers' | 'scheduleId' | 'routeId'
  > & {
    scheduleId?: string | null;
    routeId: string;
  };
  segments: SegmentBookingInput[];
  passengerCount: number;
  fareMode: 'segment' | 'full_trip';
  totalAmount?: number;
  payment?: SegmentBookingPaymentInput;
  reservationIds?: string[];
}

interface OrderedStop {
  id: string;
  order: number;
  price?: number;
}

interface OccupiedInterval {
  seat: string;
  originIndex: number;
  destinationIndex: number;
}

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'alighted'];

function parseSeatArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((seat): seat is string => typeof seat === 'string' && seat.length > 0);
  }
  return [];
}

function orderedStops(route: {
  origin: string;
  destination: string;
  distance: number;
  baseFare: number;
  stops: Prisma.JsonValue | null;
}): OrderedStop[] {
  const rawStops: unknown[] = Array.isArray(route.stops) ? route.stops as unknown[] : [];
  const intermediateStops = rawStops
    .filter((stop): stop is Record<string, unknown> =>
      Boolean(stop) && typeof stop === 'object' && !Array.isArray(stop))
    .filter((stop): stop is Record<string, unknown> & { id: string } =>
      typeof stop.id === 'string' && stop.id.length > 0)
    .sort((left, right) => (typeof left.order === 'number' ? left.order : 0) -
      (typeof right.order === 'number' ? right.order : 0));

  return [
    { id: '__origin__', order: -1, price: 0 },
    ...intermediateStops.map((stop, index) => ({
      id: stop.id,
      order: index,
      price: typeof stop.price === 'number' ? stop.price : undefined,
    })),
    { id: '__destination__', order: intermediateStops.length, price: route.baseFare },
  ];
}

export function intervalFor(
  segment: SegmentBookingInput,
  route: Parameters<typeof orderedStops>[0],
): { originIndex: number; destinationIndex: number } {
  const stops = orderedStops(route);
  const originId = segment.originStopId ?? '__origin__';
  const destinationId = segment.destinationStopId ?? '__destination__';
  const originIndex = stops.findIndex((stop) => stop.id === originId);
  const destinationIndex = stops.findIndex((stop) => stop.id === destinationId);

  if (originIndex < 0 || destinationIndex < 0 || destinationIndex <= originIndex) {
    throw new Error(`Invalid segment stop range: ${originId} -> ${destinationId}`);
  }

  return { originIndex, destinationIndex };
}

export function intervalsOverlap(
  left: Pick<OccupiedInterval, 'originIndex' | 'destinationIndex'>,
  right: Pick<OccupiedInterval, 'originIndex' | 'destinationIndex'>,
): boolean {
  return left.originIndex < right.destinationIndex && right.originIndex < left.destinationIndex;
}

function hasSeatConflict(left: OccupiedInterval, right: OccupiedInterval): boolean {
  return left.seat === right.seat && intervalsOverlap(left, right);
}

export function summarizeOccupancy(intervals: OccupiedInterval[]): {
  seatsWithOccupancy: string[];
  peakOccupancy: number;
} {
  const events = new Map<number, number>();
  const seats = new Set<string>();
  for (const interval of intervals) {
    seats.add(interval.seat);
    events.set(interval.originIndex, (events.get(interval.originIndex) ?? 0) + 1);
    events.set(interval.destinationIndex, (events.get(interval.destinationIndex) ?? 0) - 1);
  }

  let current = 0;
  let peakOccupancy = 0;
  for (const index of [...events.keys()].sort((a, b) => a - b)) {
    current += events.get(index) ?? 0;
    peakOccupancy = Math.max(peakOccupancy, current);
  }

  return { seatsWithOccupancy: [...seats].sort(), peakOccupancy };
}

async function loadScheduleIntervals(
  tx: SegmentBookingTransaction,
  scheduleId: string,
  now: Date,
  excludedReservationIds: string[] = [],
): Promise<{ schedule: { id: string; availableSeats: number; bus: { capacity: number }; route: Parameters<typeof orderedStops>[0] }; intervals: OccupiedInterval[] }> {
  const schedule = await tx.schedule.findUnique({
    where: { id: scheduleId },
    include: { bus: true, route: true },
  });
  if (!schedule) throw new Error(`Schedule not found: ${scheduleId}`);

  const bookingSegments = await tx.bookingSegment.findMany({
    where: {
      scheduleId,
      booking: { bookingStatus: { in: ACTIVE_BOOKING_STATUSES } },
    },
    select: {
      seatNumbers: true,
      originStopId: true,
      destinationStopId: true,
      alightedAtStopId: true,
    },
  });

  const reservationRows = await tx.seatReservation.findMany({
    where: {
      scheduleId,
      status: 'reserved',
      expiresAt: { gt: now },
      ...(excludedReservationIds.length > 0 ? { id: { notIn: excludedReservationIds } } : {}),
    },
    select: { seatNumbers: true, originStopId: true, destinationStopId: true },
  });

  const intervals = [
    ...bookingSegments.map((segment) => ({ source: segment, })),
    ...reservationRows.map((reservation) => ({
      source: { ...reservation, alightedAtStopId: null },
    })),
  ].flatMap(({ source }) => {
    const range = intervalFor({
      scheduleId,
      seatNumbers: [],
      originStopId: source.originStopId ?? undefined,
      destinationStopId: source.alightedAtStopId ?? source.destinationStopId ?? undefined,
    }, schedule.route);
    return parseSeatArray(source.seatNumbers).map((seat) => ({ seat, ...range }));
  });

  return { schedule, intervals };
}

export async function createSegmentBookingCore(
  tx: SegmentBookingTransaction,
  input: SegmentBookingCoreInput,
) {
  if (!Number.isInteger(input.passengerCount) || input.passengerCount <= 0) {
    throw new Error('passengerCount must be a positive integer');
  }
  if (input.segments.length === 0) throw new Error('At least one booking segment is required');
  if (input.segments.some((segment) => segment.seatNumbers.length !== input.passengerCount)) {
    throw new Error('Each booking segment must include one seat per passenger');
  }

  const scheduleIds = [...new Set(input.segments.map((segment) => segment.scheduleId))];
  const lockKeys = [...new Set(
    input.segments.flatMap((segment) =>
      segment.seatNumbers.map((seat) => `${segment.scheduleId}:${seat}`)),
  )].sort();
  for (const lockKey of lockKeys) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  }
  await tx.$queryRaw`
    SELECT id
    FROM "Schedule"
    WHERE id IN (${Prisma.join(scheduleIds)})
    FOR UPDATE
  `;

  const schedules = await tx.schedule.findMany({
    where: { id: { in: scheduleIds } },
    include: { bus: true, route: true, company: true },
  });
  const scheduleMap = new Map(schedules.map((schedule) => [schedule.id, schedule]));
  if (scheduleMap.size !== scheduleIds.length) throw new Error('One or more schedules were not found');

  const requestedIntervals: Array<OccupiedInterval & { scheduleId: string }> = [];
  for (const segment of input.segments) {
    const schedule = scheduleMap.get(segment.scheduleId);
    if (!schedule) throw new Error(`Schedule not found: ${segment.scheduleId}`);
    const range = intervalFor(
      input.fareMode === 'full_trip'
        ? { ...segment, originStopId: undefined, destinationStopId: undefined }
        : segment,
      schedule.route,
    );
    const seats = parseSeatArray(segment.seatNumbers);
    if (new Set(seats).size !== seats.length) throw new Error('Seat numbers must be unique within each segment');
    for (const seat of seats) requestedIntervals.push({ scheduleId: segment.scheduleId, seat, ...range });
  }

  const now = new Date();
  const existingBySchedule = new Map<string, OccupiedInterval[]>();
  for (const scheduleId of scheduleIds) {
    const loaded = await loadScheduleIntervals(tx, scheduleId, now, input.reservationIds ?? []);
    existingBySchedule.set(scheduleId, loaded.intervals);
  }

  for (const requested of requestedIntervals) {
    const existing = existingBySchedule.get(requested.scheduleId) ?? [];
    if (existing.some((interval) => hasSeatConflict(requested, interval))) {
      throw new Error(`Seat ${requested.seat} is already occupied on an overlapping segment`);
    }
  }
  for (let index = 0; index < requestedIntervals.length; index += 1) {
    for (let next = index + 1; next < requestedIntervals.length; next += 1) {
      if (requestedIntervals[index].scheduleId === requestedIntervals[next].scheduleId &&
        hasSeatConflict(requestedIntervals[index], requestedIntervals[next])) {
        throw new Error(`Seat ${requestedIntervals[index].seat} is duplicated on overlapping segments`);
      }
    }
  }

  const pricedSegments = input.segments.map((segment, segmentIndex) => {
    const schedule = scheduleMap.get(segment.scheduleId)!;
    const fare = calculateSegmentFare(
      schedule,
      schedule.route,
      input.fareMode === 'full_trip' ? undefined : segment.originStopId,
      input.fareMode === 'full_trip' ? undefined : segment.destinationStopId,
    );
    return { ...segment, schedule, segmentIndex, fare };
  });
  const calculatedTotalAmount = pricedSegments.reduce((total, segment) =>
    total + segment.fare.fare * input.passengerCount, 0);
  const totalAmount = input.totalAmount ?? calculatedTotalAmount;

  const booking = await tx.booking.create({
    data: {
      ...input.booking,
      totalAmount,
      routeId: input.booking.routeId,
      scheduleId: input.booking.scheduleId ?? pricedSegments[0].scheduleId,
      seatNumbers: [...new Set(requestedIntervals.map((interval) => interval.seat))],
    },
  });

  for (const segment of pricedSegments) {
    await tx.bookingSegment.create({
      data: {
        bookingId: booking.id,
        companyId: segment.schedule.companyId,
        scheduleId: segment.scheduleId,
        segmentIndex: segment.segmentIndex,
        date: segment.date ? new Date(segment.date) : new Date(segment.schedule.departureDateTime),
        seatNumbers: segment.seatNumbers,
        passengerCount: input.passengerCount,
        price: segment.fare.fare,
        currency: 'MWK',
        originStopId: segment.originStopId ?? null,
        destinationStopId: segment.destinationStopId ?? null,
        metadata: { fareSource: segment.fare.fareSource },
      },
    });
  }

  if (input.reservationIds?.length) {
    await tx.seatReservation.updateMany({
      where: {
        id: { in: input.reservationIds },
        status: 'reserved',
      },
      data: { status: 'released' },
    });
  }

  for (const scheduleId of scheduleIds) {
    await recomputeScheduleOccupancy(tx, scheduleId, now);
  }

  if (input.payment) {
    await tx.payment.create({
      data: {
        ...input.payment,
        bookingId: booking.id,
        currency: input.payment.currency ?? 'MWK',
        status: input.payment.status ?? 'pending',
        provider: input.payment.provider ?? 'manual',
      },
    });
  }

  return { booking, totalAmount, pricedSegments };
}

export async function recomputeScheduleOccupancy(
  tx: SegmentBookingTransaction,
  scheduleId: string,
  now = new Date(),
) {
  const { schedule, intervals } = await loadScheduleIntervals(tx, scheduleId, now);
  const { seatsWithOccupancy, peakOccupancy } = summarizeOccupancy(intervals);
  const availableSeats = Math.max(0, schedule.bus.capacity - peakOccupancy);

  return tx.schedule.update({
    where: { id: scheduleId },
    data: {
      bookedSeats: seatsWithOccupancy,
      availableSeats,
    },
  });
}
