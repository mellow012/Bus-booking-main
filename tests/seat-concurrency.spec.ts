// tests/seat-concurrency.spec.ts
import { test, expect, request as playwrightRequest } from '@playwright/test';
import { prisma } from '../src/lib/prisma';
import { createBooking } from '../src/lib/actions/booking.actions';
import {
  safeguardProductionCheck,
  ensureTestUsers,
  createTestSchedule,
  cleanupTestSchedule,
  queryScheduleReservations,
  TestUserSession,
} from './helpers/seat-concurrency-helpers';

test.describe('Seat Reservation Concurrency & Race Conditions', () => {
  let testUsers: TestUserSession[] = [];

  test.beforeAll(async ({ baseURL }) => {
    // 1. Production safeguard check
    safeguardProductionCheck(baseURL || 'http://localhost:3000');

    // 2. Pre-authenticate 35 test users via DB seeding & signed session cookies
    testUsers = await ensureTestUsers(35);
  });

  test('1. same seat conflict — exactly one winner', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    // Create fresh 32-seat schedule
    const schedule = await createTestSchedule(32);

    try {
      // 10 distinct users attempt to reserve the EXACT SAME seat ("1") simultaneously
      const contenders = testUsers.slice(0, 10);
      const targetSeat = '1';

      // Create isolated request contexts for each user
      const contexts = await Promise.all(
        contenders.map(user =>
          playwrightRequest.newContext({
            baseURL: targetBaseUrl,
            extraHTTPHeaders: {
              cookie: user.cookieHeader,
              'content-type': 'application/json',
            },
          })
        )
      );

      // Fire all 10 requests at the exact same moment via Promise.all
      const responses = await Promise.all(
        contexts.map(ctx =>
          ctx.post('/api/bookings/reserve-seats', {
            data: {
              scheduleId: schedule.id,
              seatNumbers: [targetSeat],
            },
          })
        )
      );

      // Close contexts
      await Promise.all(contexts.map(ctx => ctx.dispose()));

      const statuses = responses.map(r => r.status());
      const bodies = await Promise.all(responses.map(r => r.json().catch(() => ({}))));

      const successCount = statuses.filter(s => s === 201).length;
      const clientErrorCount = statuses.filter(s => s >= 400 && s < 500).length;
      const serverErrorCount = statuses.filter(s => s >= 500).length;

      console.log('[Test 1 Results]', {
        statuses,
        successCount,
        clientErrorCount,
        serverErrorCount,
      });

      // Assertions
      expect(serverErrorCount, 'Zero 500 Internal Server Errors').toBe(0);
      expect(successCount, 'Exactly 1 user wins the seat reservation').toBe(1);
      expect(clientErrorCount, 'The other 9 requests return clean 4xx errors').toBe(9);

      // Verify DB state for schedule shows exactly 1 reservation for seat "1"
      const dbState = await queryScheduleReservations(schedule.id);
      expect(dbState?.reservations.length).toBe(1);
      const reservedSeatNumbers = dbState?.reservations.flatMap(r =>
        Array.isArray(r.seatNumbers) ? r.seatNumbers : JSON.parse(String(r.seatNumbers))
      );
      expect(reservedSeatNumbers).toEqual([targetSeat]);
    } finally {
      await cleanupTestSchedule(schedule.id);
    }
  });

  test('2. full bus fill — 32 different seats, 32 concurrent users', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    // Create fresh 32-seat schedule
    const capacity = 32;
    const schedule = await createTestSchedule(capacity);

    try {
      const contenders = testUsers.slice(0, capacity);

      // Create isolated request contexts for each of the 32 distinct users
      const contexts = await Promise.all(
        contenders.map(user =>
          playwrightRequest.newContext({
            baseURL: targetBaseUrl,
            extraHTTPHeaders: {
              cookie: user.cookieHeader,
              'content-type': 'application/json',
            },
          })
        )
      );

      // Start wall-clock timer
      const startTime = Date.now();

      // Fire 32 requests concurrently, each requesting a DIFFERENT seat number ("1" .. "32")
      const responses = await Promise.all(
        contexts.map((ctx, idx) => {
          const seatNumber = String(idx + 1);
          return ctx.post('/api/bookings/reserve-seats', {
            data: {
              scheduleId: schedule.id,
              seatNumbers: [seatNumber],
            },
          });
        })
      );

      const endTime = Date.now();
      const wallClockDurationMs = endTime - startTime;
      const wallClockDurationSec = (wallClockDurationMs / 1000).toFixed(2);

      // Close contexts
      await Promise.all(contexts.map(ctx => ctx.dispose()));

      const statuses = responses.map(r => r.status());
      const bodies = await Promise.all(responses.map(r => r.json().catch(() => ({}))));

      const successCount = statuses.filter(s => s === 201).length;
      const failCount = statuses.filter(s => s !== 201).length;

      console.log('[Test 2 Results]', {
        wallClockDurationSec: `${wallClockDurationSec}s`,
        successCount,
        failCount,
      });

      if (wallClockDurationMs > 15000) {
        console.warn(
          `[PERFORMANCE WARNING] 32 concurrent seat reservations took ${wallClockDurationSec}s (exceeded 15s limit).`
        );
      }

      // Assertions
      expect(failCount, 'Zero failed requests').toBe(0);
      expect(successCount, 'All 32 requests succeed').toBe(32);

      // Verify DB state: query database to confirm 32/32 seats reserved with unique seat-to-user mapping
      const dbState = await queryScheduleReservations(schedule.id);
      expect(dbState?.reservations.length).toBe(32);

      const seatToUserMap: Record<string, string> = {};
      dbState?.reservations.forEach(r => {
        const seats: string[] = Array.isArray(r.seatNumbers)
          ? (r.seatNumbers as string[])
          : JSON.parse(String(r.seatNumbers));
        seats.forEach(s => {
          expect(seatToUserMap[s], `Seat ${s} should not be assigned to multiple users`).toBeUndefined();
          seatToUserMap[s] = r.userId;
        });
      });

      expect(Object.keys(seatToUserMap).length, '32 unique seats reserved').toBe(32);
    } finally {
      await cleanupTestSchedule(schedule.id);
    }
  });

  test('3. overselling — 35 requests against 32 seats', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    // Create fresh 32-seat schedule
    const capacity = 32;
    const totalRequesters = 35;
    const schedule = await createTestSchedule(capacity);

    try {
      const contenders = testUsers.slice(0, totalRequesters);

      // Create isolated request contexts for 35 distinct users
      const contexts = await Promise.all(
        contenders.map(user =>
          playwrightRequest.newContext({
            baseURL: targetBaseUrl,
            extraHTTPHeaders: {
              cookie: user.cookieHeader,
              'content-type': 'application/json',
            },
          })
        )
      );

      // Fire 35 requests concurrently, each requesting seat numbers "1" through "35"
      const responses = await Promise.all(
        contexts.map((ctx, idx) => {
          const seatNumber = String(idx + 1);
          return ctx.post('/api/bookings/reserve-seats', {
            data: {
              scheduleId: schedule.id,
              seatNumbers: [seatNumber],
            },
          });
        })
      );

      // Close contexts
      await Promise.all(contexts.map(ctx => ctx.dispose()));

      const statuses = responses.map(r => r.status());
      const bodies = await Promise.all(responses.map(r => r.json().catch(() => ({}))));

      const successCount = statuses.filter(s => s === 201).length;
      const clientErrorCount = statuses.filter(s => s >= 400 && s < 500).length;
      const serverErrorCount = statuses.filter(s => s >= 500).length;

      console.log('[Test 3 Results]', {
        successCount,
        clientErrorCount,
        serverErrorCount,
      });

      // Assertions
      expect(serverErrorCount, 'Zero 500 Internal Server Errors').toBe(0);
      expect(successCount, 'Exactly 32 requests succeed').toBe(32);
      expect(clientErrorCount, 'Exactly 3 requests fail with clean 4xx errors').toBe(3);

      // Verify final DB state has max 32 reserved seats
      const dbState = await queryScheduleReservations(schedule.id);
      expect(dbState?.reservations.length).toBeLessThanOrEqual(32);
    } finally {
      await cleanupTestSchedule(schedule.id);
    }
  });

  test('4. booking vs. cancellation race', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    // Create fresh 32-seat schedule
    const schedule = await createTestSchedule(32);

    try {
      const userA = testUsers[0];
      const userB = testUsers[1];
      const targetSeat = '1';

      // 1. User A reserves seat "1"
      const ctxA = await playwrightRequest.newContext({
        baseURL: targetBaseUrl,
        extraHTTPHeaders: {
          cookie: userA.cookieHeader,
          'content-type': 'application/json',
        },
      });

      const initialRes = await ctxA.post('/api/bookings/reserve-seats', {
        data: {
          scheduleId: schedule.id,
          seatNumbers: [targetSeat],
        },
      });

      expect(initialRes.status(), 'User A initial reservation succeeds').toBe(201);
      const initialBody = await initialRes.json();
      const reservationId = initialBody.reservationId;
      expect(reservationId, 'Reservation ID returned').toBeTruthy();

      // 2. Prepare race: User A releases hold while User B attempts to reserve seat "1"
      const ctxB = await playwrightRequest.newContext({
        baseURL: targetBaseUrl,
        extraHTTPHeaders: {
          cookie: userB.cookieHeader,
          'content-type': 'application/json',
        },
      });

      const [releaseRes, reserveRes] = await Promise.all([
        // User A releases hold
        ctxA.patch(`/api/bookings/reserve-seats/${reservationId}`),
        // User B attempts to reserve seat "1"
        ctxB.post('/api/bookings/reserve-seats', {
          data: {
            scheduleId: schedule.id,
            seatNumbers: [targetSeat],
          },
        }),
      ]);

      await ctxA.dispose();
      await ctxB.dispose();

      const releaseStatus = releaseRes.status();
      const reserveStatus = reserveRes.status();

      console.log('[Test 4 Results]', {
        releaseStatus,
        reserveStatus,
      });

      // Assertions: Neither request produces a 500 error
      expect(releaseStatus, 'Release request does not 500').toBeLessThan(500);
      expect(reserveStatus, 'Reserve request does not 500').toBeLessThan(500);

      // Verify final DB state of seat "1" is unambiguous
      const dbState = await queryScheduleReservations(schedule.id);
      const activeReservations = dbState?.reservations || [];

      // Check if seat "1" is currently reserved
      const seat1Reservations = activeReservations.filter(r => {
        const seats: string[] = Array.isArray(r.seatNumbers)
          ? (r.seatNumbers as string[])
          : JSON.parse(String(r.seatNumbers));
        return seats.includes(targetSeat);
      });

      expect(
        seat1Reservations.length,
        'Seat 1 is assigned to at most 1 active reservation (never duplicated)'
      ).toBeLessThanOrEqual(1);

      if (seat1Reservations.length === 1) {
        // If seat 1 is reserved, it must belong to User B (since User A released theirs)
        expect(seat1Reservations[0].userId).toBe(userB.userId);
      }
    } finally {
      await cleanupTestSchedule(schedule.id);
    }
  });

  test('5. booking confirmation vs. concurrent seat reservation race', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    // Create fresh 32-seat schedule
    const schedule = await createTestSchedule(32);

    try {
      const userA = testUsers[0];
      const userB = testUsers[1];
      const targetSeat = '1';

      const ctxB = await playwrightRequest.newContext({
        baseURL: targetBaseUrl,
        extraHTTPHeaders: {
          cookie: userB.cookieHeader,
          'content-type': 'application/json',
        },
      });

      // User A executes createBooking (confirming permanent booking) while User B attempts POST /api/bookings/reserve-seats concurrently
      const bookingPromise = createBooking({
        bookingReference: `TEST-REF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        userId: userA.userId,
        companyId: schedule.companyId,
        scheduleId: schedule.id,
        routeId: schedule.routeId,
        totalAmount: 15000,
        passengers: [{ name: 'User A', seatNumber: targetSeat }],
        segments: [{
          scheduleId: schedule.id,
          date: schedule.departureDateTime.toISOString(),
          seatNumbers: [targetSeat],
          fare: 15000,
          passengerCount: 1,
        }],
      });

      const reservePromise = ctxB.post('/api/bookings/reserve-seats', {
        data: {
          scheduleId: schedule.id,
          seatNumbers: [targetSeat],
        },
      });

      const [bookingResult, reserveRes] = await Promise.all([bookingPromise, reservePromise]);
      await ctxB.dispose();

      const reserveStatus = reserveRes.status();
      console.log('[Test 5 Results]', {
        bookingSuccess: !('error' in bookingResult),
        reserveStatus,
      });

      // Assertions: Neither operation causes a 500 server crash
      expect(reserveStatus, 'Reserve request does not 500').toBeLessThan(500);

      // Verify DB consistency: seat 1 is either permanently booked in Schedule.bookedSeats or reserved by User B, never double-assigned
      const updatedSchedule = await prisma.schedule.findUnique({ where: { id: schedule.id } });
      const bookedSeats: string[] = Array.isArray(updatedSchedule?.bookedSeats)
        ? (updatedSchedule?.bookedSeats as string[])
        : [];
      const dbReservations = await queryScheduleReservations(schedule.id);
      const isReservedByUserB = (dbReservations?.reservations || []).some(r => {
        const seats: string[] = Array.isArray(r.seatNumbers)
          ? (r.seatNumbers as string[])
          : JSON.parse(String(r.seatNumbers));
        return r.userId === userB.userId && seats.includes(targetSeat);
      });

      console.log('[Test 5 DB Verification]', { bookedSeats, isReservedByUserB });

      // Either seat "1" was permanently booked by User A OR reserved by User B, never both
      if (bookedSeats.includes(targetSeat)) {
        expect(reserveStatus, 'If User A confirmed booking first, User B reservation gets clean 400').toBe(400);
      }
    } finally {
      await cleanupTestSchedule(schedule.id);
    }
  });
});
