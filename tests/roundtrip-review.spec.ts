// tests/roundtrip-review.spec.ts
import { test, expect, request as playwrightRequest } from '@playwright/test';
import { prisma } from '../src/lib/prisma';
import {
  safeguardProductionCheck,
  ensureTestUsers,
  createTestSchedule,
  TestUserSession,
} from './helpers/seat-concurrency-helpers';

/**
 * Calculates journey state based on the logic in useJourneyTracker.ts and page.tsx
 */
function computeJourneyState(
  dep: Date,
  arr: Date,
  tripStatus: string,
  legReviewRating: number | null,
  now: Date = new Date()
): string {
  if (tripStatus === 'completed') return 'completed';
  if (now < dep) return 'upcoming';
  if (tripStatus === 'arrived') {
    if (legReviewRating) return 'completed';
    return 'arrived';
  }
  if (now < arr) return 'in_transit';
  if (now.getTime() > arr.getTime() + 5 * 3600 * 1000) return 'completed';
  return 'delayed';
}

test.describe('Round-Trip Review & Journey State Verification Suite', () => {
  test.setTimeout(90_000);
  let testUsers: TestUserSession[] = [];

  test.beforeAll(async ({ baseURL }) => {
    safeguardProductionCheck(baseURL || 'http://localhost:3000');
    testUsers = await ensureTestUsers(2);
  });

  test('Round-trip outbound review submission does NOT corrupt return leg journey state', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    const user = testUsers[0];

    // Use createTestSchedule to ensure test company, bus, and route exist
    const baseSched = await createTestSchedule(40);
    const companyId = baseSched.companyId;
    const busId = baseSched.busId;
    const routeId = baseSched.routeId;

    const now = new Date();
    const pastDeparture = new Date(now.getTime() - 4 * 3600 * 1000); // 4h ago
    const pastArrival = new Date(now.getTime() - 2 * 3600 * 1000);   // 2h ago
    const futureDeparture = new Date(now.getTime() + 24 * 3600 * 1000); // +24h
    const futureArrival = new Date(now.getTime() + 28 * 3600 * 1000);   // +28h

    // 1. Create Outbound Schedule (Completed)
    const outboundSched = await prisma.schedule.create({
      data: {
        companyId,
        busId,
        routeId,
        departureDateTime: pastDeparture,
        arrivalDateTime: pastArrival,
        availableSeats: 40,
        price: 15000,
        status: 'active',
        tripStatus: 'completed',
      },
    });

    // 2. Create Return Schedule (Upcoming/Scheduled)
    const returnSched = await prisma.schedule.create({
      data: {
        companyId,
        busId,
        routeId,
        departureDateTime: futureDeparture,
        arrivalDateTime: futureArrival,
        availableSeats: 40,
        price: 15000,
        status: 'active',
        tripStatus: 'scheduled',
      },
    });

    // 3. Create Parent Round-Trip Booking with 2 BookingSegments
    const ref = `RT-REV-TEST-${Date.now().toString().slice(-6)}`;
    const booking = await prisma.booking.create({
      data: {
        bookingReference: ref,
        userId: user.userId,
        scheduleId: outboundSched.id,
        companyId,
        totalAmount: 30000,
        bookingStatus: 'confirmed',
        paymentStatus: 'paid',
        seatNumbers: ['S1'],
        segments: {
          create: [
            {
              companyId,
              scheduleId: outboundSched.id,
              segmentIndex: 0,
              date: pastDeparture,
              seatNumbers: ['S1'],
              passengerCount: 1,
              price: 15000,
            },
            {
              companyId,
              scheduleId: returnSched.id,
              segmentIndex: 1,
              date: futureDeparture,
              seatNumbers: ['S1'],
              passengerCount: 1,
              price: 15000,
            },
          ],
        },
      },
      include: {
        segments: {
          include: { schedule: true },
        },
        schedule: true,
      },
    });

    try {
      const api = await playwrightRequest.newContext({
        baseURL: targetBaseUrl,
        extraHTTPHeaders: {
          cookie: user.cookieHeader,
          'content-type': 'application/json',
        },
      });

      // 4. Submit Outbound Review via API endpoint
      const outboundReviewRes = await api.post(`/api/bookings/${booking.id}/review`, {
        data: {
          rating: 5,
          reviewText: 'Excellent outbound leg!',
          leg: 'outbound',
        },
      });
      expect(outboundReviewRes.status(), 'Outbound review submission succeeds').toBe(200);

      // 5. Fetch updated booking from DB
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
        include: {
          segments: {
            include: { schedule: true },
          },
          schedule: true,
        },
      });

      expect(updatedBooking).not.toBeNull();
      const metadata = updatedBooking!.metadata as any;

      // Verify metadata structure
      expect(metadata?.outboundReview, 'metadata.outboundReview is populated').toBeDefined();
      expect(metadata?.outboundReview?.rating, 'outbound rating is 5').toBe(5);
      expect(metadata?.returnReview, 'metadata.returnReview is initially undefined').toBeUndefined();

      // 6. Compute Return Leg Journey State (simulating UI rendering in page.tsx)
      const outboundCompleted =
        updatedBooking!.schedule.tripStatus === 'completed' ||
        (updatedBooking!.schedule.tripStatus !== 'in_transit' && new Date() >= new Date(updatedBooking!.schedule.arrivalDateTime));

      const returnSegment = updatedBooking!.segments.find((s) => s.segmentIndex === 1);
      const activeSegment = outboundCompleted && returnSegment ? returnSegment : null;

      expect(activeSegment, 'Active segment for UI is the Return Leg').not.toBeNull();
      expect(activeSegment?.scheduleId, 'Active segment schedule is return schedule').toBe(returnSched.id);

      const activeLegReviewRating = activeSegment
        ? (metadata?.returnReview?.rating ?? null)
        : (metadata?.outboundReview?.rating ?? updatedBooking!.reviewRating ?? null);

      expect(activeLegReviewRating, 'Active leg review rating for return leg is null (not outbound 5)').toBeNull();

      const returnLegState = computeJourneyState(
        activeSegment!.schedule.departureDateTime,
        activeSegment!.schedule.arrivalDateTime,
        activeSegment!.schedule.tripStatus,
        activeLegReviewRating
      );

      // ASSERTION 1: Return leg journey state MUST be 'upcoming', NOT 'completed'
      expect(returnLegState, 'Return leg journey state is upcoming after outbound review').toBe('upcoming');

      // 7. Simulate Return Trip Arrival (tripStatus: 'arrived')
      await prisma.schedule.update({
        where: { id: returnSched.id },
        data: {
          departureDateTime: new Date(now.getTime() - 2 * 3600 * 1000),
          arrivalDateTime: new Date(now.getTime() - 10 * 60 * 1000),
          tripStatus: 'arrived',
        },
      });

      const arrivalBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
        include: {
          segments: { include: { schedule: true } },
          schedule: true,
        },
      });

      const arrivedSegment = arrivalBooking!.segments.find((s) => s.segmentIndex === 1)!;
      const arrivedMeta = arrivalBooking!.metadata as any;
      const arrivedLegRating = arrivedMeta?.returnReview?.rating ?? null;

      const arrivedState = computeJourneyState(
        arrivedSegment.schedule.departureDateTime,
        arrivedSegment.schedule.arrivalDateTime,
        arrivedSegment.schedule.tripStatus,
        arrivedLegRating
      );

      // ASSERTION 2: Upon return arrival, journey state MUST be 'arrived' (prompting for return review)
      expect(arrivedState, 'Return leg journey state at arrival is arrived (prompting for return review)').toBe('arrived');

      // 8. Submit Return Review via API endpoint
      const returnReviewRes = await api.post(`/api/bookings/${booking.id}/review`, {
        data: {
          rating: 4,
          reviewText: 'Smooth return trip!',
          leg: 'return',
        },
      });
      expect(returnReviewRes.status(), 'Return review submission succeeds').toBe(200);

      // 9. Verify final DB state and final journey state
      const finalBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
        include: {
          segments: { include: { schedule: true } },
          schedule: true,
        },
      });

      const finalMeta = finalBooking!.metadata as any;
      expect(finalMeta?.returnReview, 'metadata.returnReview is populated').toBeDefined();
      expect(finalMeta?.returnReview?.rating, 'return rating is 4').toBe(4);

      const finalSegment = finalBooking!.segments.find((s) => s.segmentIndex === 1)!;
      const finalLegRating = finalMeta?.returnReview?.rating ?? null;

      const finalState = computeJourneyState(
        finalSegment.schedule.departureDateTime,
        finalSegment.schedule.arrivalDateTime,
        finalSegment.schedule.tripStatus,
        finalLegRating
      );

      // ASSERTION 3: After return review, return leg journey state transitions to 'completed'
      expect(finalState, 'Return leg journey state is completed after return review').toBe('completed');

    } finally {
      // Clean up test records
      await prisma.bookingSegment.deleteMany({ where: { bookingId: booking.id } }).catch(() => {});
      await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
      await prisma.schedule.delete({ where: { id: outboundSched.id } }).catch(() => {});
      await prisma.schedule.delete({ where: { id: returnSched.id } }).catch(() => {});
    }
  });

  test('Round-trip chronological validation & server-authoritative discount tamper resistance', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    const baseSched = await createTestSchedule(40);
    const companyId = baseSched.companyId;
    const busId = baseSched.busId;
    const routeId = baseSched.routeId;

    // Set 10% return trip discount on test company
    await prisma.company.update({
      where: { id: companyId },
      data: { returnTripDiscountPercent: 10 },
    });

    const now = new Date();
    const outboundDep = new Date(now.getTime() + 24 * 3600 * 1000);
    const outboundArr = new Date(outboundDep.getTime() + 4 * 3600 * 1000);

    // Invalid return: departure BEFORE outbound arrival
    const invalidReturnDep = new Date(outboundDep.getTime() + 2 * 3600 * 1000);
    const invalidReturnArr = new Date(invalidReturnDep.getTime() + 4 * 3600 * 1000);

    // Valid return: departure 24h AFTER outbound arrival
    const validReturnDep = new Date(outboundArr.getTime() + 24 * 3600 * 1000);
    const validReturnArr = new Date(validReturnDep.getTime() + 4 * 3600 * 1000);

    const outboundSched = await prisma.schedule.create({
      data: { companyId, busId, routeId, departureDateTime: outboundDep, arrivalDateTime: outboundArr, availableSeats: 40, price: 20000, status: 'active' },
    });

    const invalidReturnSched = await prisma.schedule.create({
      data: { companyId, busId, routeId, departureDateTime: invalidReturnDep, arrivalDateTime: invalidReturnArr, availableSeats: 40, price: 20000, status: 'active' },
    });

    const validReturnSched = await prisma.schedule.create({
      data: { companyId, busId, routeId, departureDateTime: validReturnDep, arrivalDateTime: validReturnArr, availableSeats: 40, price: 20000, status: 'active' },
    });

    try {
      const user = testUsers[0];
      const api = await playwrightRequest.newContext({
        baseURL: targetBaseUrl,
        extraHTTPHeaders: { cookie: user.cookieHeader, 'content-type': 'application/json' },
      });

      // 1. Test Chronological Failure: return departure before outbound arrival
      const invalidRes = await api.post('/api/bookings/create', {
        data: {
          routeId,
          companyId,
          returnDate: invalidReturnDep.toISOString(),
          passengerDetails: [{ firstName: 'John', lastName: 'Doe', seatNumber: 'S1' }],
          segments: [
            { scheduleId: outboundSched.id, seatNumbers: ['S1'] },
            { scheduleId: invalidReturnSched.id, seatNumbers: ['S1'] },
          ],
        },
      });

      const invalidBody = await invalidRes.json().catch(() => ({}));
      expect(invalidBody.error, 'Chronological error returned').toBe('Return departure must be after outbound bus arrives');

      // 2. Test Valid Round Trip: Gross = 40,000 MWK, 10% Discount = 4,000 MWK, Net Total = 36,000 MWK
      const validRes = await api.post('/api/bookings/create', {
        data: {
          routeId,
          companyId,
          returnDate: validReturnDep.toISOString(),
          passengerDetails: [{ firstName: 'John', lastName: 'Doe', seatNumber: 'S1' }],
          segments: [
            { scheduleId: outboundSched.id, seatNumbers: ['S1'] },
            { scheduleId: validReturnSched.id, seatNumbers: ['S1'] },
          ],
        },
      });

      expect(validRes.status(), 'Booking creation succeeds').toBe(200);
      const validBody = await validRes.json();
      expect(validBody.totalAmount, 'Net charged total is 36,000 MWK').toBe(36000);
      expect(validBody.discountAmount, 'Discount amount is 4,000 MWK').toBe(4000);

      // Clean up booking created
      if (validBody.bookingId) {
        await prisma.bookingSegment.deleteMany({ where: { bookingId: validBody.bookingId } }).catch(() => {});
        await prisma.booking.delete({ where: { id: validBody.bookingId } }).catch(() => {});
      }
    } finally {
      await prisma.schedule.deleteMany({ where: { id: { in: [outboundSched.id, invalidReturnSched.id, validReturnSched.id] } } }).catch(() => {});
    }
  });
});
