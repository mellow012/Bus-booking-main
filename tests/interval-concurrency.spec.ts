// tests/interval-concurrency.spec.ts
import { test, expect, request as playwrightRequest } from '@playwright/test';
import { prisma } from '../src/lib/prisma';
import {
  safeguardProductionCheck,
  ensureTestUsers,
  cleanupTestSchedule,
  TestUserSession,
} from './helpers/seat-concurrency-helpers';
import crypto from 'crypto';

test.describe('Interval-Aware Seat Reservation Concurrency (SERIALIZABLE)', () => {
  let testUsers: TestUserSession[] = [];

  test.beforeAll(async ({ baseURL }) => {
    safeguardProductionCheck(baseURL || 'http://localhost:3000');
    testUsers = await ensureTestUsers(20);
  });

  async function createIntervalTestSchedule() {
    const companyId = 'a0000000-0000-4000-8000-000000000001';
    const routeId = crypto.randomUUID();
    const busId = 'b0000000-0000-4000-8000-000000000020';

    await prisma.company.upsert({
      where: { id: companyId },
      update: { status: 'active' },
      create: { id: companyId, name: 'Concurrency Test Company', email: 'concurrency-company@test.local', status: 'active' },
    });

    await prisma.bus.upsert({
      where: { id: busId },
      update: { capacity: 32, status: 'active' },
      create: { id: busId, companyId, licensePlate: 'TEST-32-BUS', busType: 'Standard', capacity: 32, status: 'active' },
    });

    // Route with intermediate stop "Dedza"
    const route = await prisma.route.create({
      data: {
        id: routeId,
        companyId,
        name: 'Lilongwe - Dedza - Blantyre',
        origin: 'Lilongwe',
        destination: 'Blantyre',
        distance: 300,
        duration: 240,
        baseFare: 15000,
        stops: [
          {
            id: 'stop_dedza_123',
            name: 'Dedza',
            distanceFromOrigin: 100,
            order: 0,
          },
        ] as any,
        status: 'active',
        isActive: true,
      },
    });

    const departureDateTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const arrivalDateTime = new Date(departureDateTime.getTime() + 4 * 60 * 60 * 1000);
    const scheduleId = crypto.randomUUID();

    const schedule = await prisma.schedule.create({
      data: {
        id: scheduleId,
        companyId,
        busId,
        routeId: route.id,
        departureDateTime,
        arrivalDateTime,
        departureLocation: 'Lilongwe Terminal',
        arrivalLocation: 'Blantyre Terminal',
        availableSeats: 32,
        bookedSeats: [],
        price: 15000,
        status: 'active',
        tripStatus: 'scheduled',
        isActive: true,
      },
    });

    return { schedule, route };
  }

  test('a. non-overlapping ranges succeed in parallel on the same seat', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    const { schedule, route } = await createIntervalTestSchedule();

    try {
      const user1 = testUsers[0];
      const user2 = testUsers[1];
      const targetSeat = '5';

      const ctx1 = await playwrightRequest.newContext({
        baseURL: targetBaseUrl,
        extraHTTPHeaders: { cookie: user1.cookieHeader, 'content-type': 'application/json' },
      });

      const ctx2 = await playwrightRequest.newContext({
        baseURL: targetBaseUrl,
        extraHTTPHeaders: { cookie: user2.cookieHeader, 'content-type': 'application/json' },
      });

      const startTime = Date.now();

      // User 1 books Seat 5 for Lilongwe -> Dedza [__origin__, stop_dedza_123)
      // User 2 books Seat 5 for Dedza -> Blantyre [stop_dedza_123, __destination__)
      const [res1, res2] = await Promise.all([
        ctx1.post('/api/bookings/reserve-seats', {
          data: {
            scheduleId: schedule.id,
            seatNumbers: [targetSeat],
            originStopId: '__origin__',
            destinationStopId: 'stop_dedza_123',
          },
        }),
        ctx2.post('/api/bookings/reserve-seats', {
          data: {
            scheduleId: schedule.id,
            seatNumbers: [targetSeat],
            originStopId: 'stop_dedza_123',
            destinationStopId: '__destination__',
          },
        }),
      ]);

      const totalMs = Date.now() - startTime;

      await ctx1.dispose();
      await ctx2.dispose();

      console.log('[Test A Results]', {
        status1: res1.status(),
        status2: res2.status(),
        totalMs: `${totalMs}ms`,
      });

      expect(res1.status(), 'User 1 reservation succeeds (201)').toBe(201);
      expect(res2.status(), 'User 2 reservation succeeds (201)').toBe(201);

      // Verify DB holds 2 active reservations for seat 5 on different stop segments
      const dbReservations = await prisma.seatReservation.findMany({
        where: { scheduleId: schedule.id, status: 'reserved' },
      });

      expect(dbReservations.length, 'Both non-overlapping reservations exist in DB').toBe(2);
    } finally {
      await cleanupTestSchedule(schedule.id);
      await prisma.route.delete({ where: { id: route.id } }).catch(() => {});
    }
  });

  test('b. overlapping ranges are cleanly rejected', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    const { schedule, route } = await createIntervalTestSchedule();

    try {
      const user1 = testUsers[2];
      const user2 = testUsers[3];
      const targetSeat = '7';

      const ctx1 = await playwrightRequest.newContext({
        baseURL: targetBaseUrl,
        extraHTTPHeaders: { cookie: user1.cookieHeader, 'content-type': 'application/json' },
      });

      const ctx2 = await playwrightRequest.newContext({
        baseURL: targetBaseUrl,
        extraHTTPHeaders: { cookie: user2.cookieHeader, 'content-type': 'application/json' },
      });

      // User 1 books Seat 7 for Full Trip: Lilongwe -> Blantyre [__origin__, __destination__)
      // User 2 books Seat 7 for Leg 2: Dedza -> Blantyre [stop_dedza_123, __destination__) -> Overlaps!
      const [res1, res2] = await Promise.all([
        ctx1.post('/api/bookings/reserve-seats', {
          data: {
            scheduleId: schedule.id,
            seatNumbers: [targetSeat],
            originStopId: '__origin__',
            destinationStopId: '__destination__',
          },
        }),
        ctx2.post('/api/bookings/reserve-seats', {
          data: {
            scheduleId: schedule.id,
            seatNumbers: [targetSeat],
            originStopId: 'stop_dedza_123',
            destinationStopId: '__destination__',
          },
        }),
      ]);

      await ctx1.dispose();
      await ctx2.dispose();

      const statuses = [res1.status(), res2.status()];
      const successCount = statuses.filter((s) => s === 201).length;
      const clientErrorCount = statuses.filter((s) => s >= 400 && s < 500).length;
      const serverErrorCount = statuses.filter((s) => s >= 500).length;

      console.log('[Test B Results]', {
        statuses,
        successCount,
        clientErrorCount,
        serverErrorCount,
      });

      expect(serverErrorCount, 'Zero 500 Internal Server Errors').toBe(0);
      expect(successCount, 'Exactly 1 reservation succeeds').toBe(1);
      expect(clientErrorCount, 'The overlapping reservation returns a 4xx client error').toBe(1);
    } finally {
      await cleanupTestSchedule(schedule.id);
      await prisma.route.delete({ where: { id: route.id } }).catch(() => {});
    }
  });

  test('c. serialization retry transparently recovers under high concurrency', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    const { schedule, route } = await createIntervalTestSchedule();

    try {
      // 10 concurrent requests requesting various seats and intervals
      const contenders = testUsers.slice(4, 14);
      const contexts = await Promise.all(
        contenders.map((user) =>
          playwrightRequest.newContext({
            baseURL: targetBaseUrl,
            extraHTTPHeaders: { cookie: user.cookieHeader, 'content-type': 'application/json' },
          })
        )
      );

      const startTime = Date.now();

      const responses = await Promise.all(
        contexts.map((ctx, idx) =>
          ctx.post('/api/bookings/reserve-seats', {
            data: {
              scheduleId: schedule.id,
              seatNumbers: [String(idx + 10)], // Seats 10 to 19 (all distinct seats!)
              originStopId: idx % 2 === 0 ? '__origin__' : 'stop_dedza_123',
              destinationStopId: idx % 2 === 0 ? 'stop_dedza_123' : '__destination__',
            },
          })
        )
      );

      const totalMs = Date.now() - startTime;

      await Promise.all(contexts.map((ctx) => ctx.dispose()));

      const statuses = responses.map((r) => r.status());
      const successCount = statuses.filter((s) => s === 201).length;
      const serverErrorCount = statuses.filter((s) => s >= 500).length;

      console.log('[Test C Results]', {
        statuses,
        successCount,
        serverErrorCount,
        totalMs: `${totalMs}ms`,
      });

      expect(serverErrorCount, 'Zero 500 Internal Server Errors').toBe(0);
      expect(successCount, 'All 10 distinct seat requests succeed concurrently under SERIALIZABLE retry logic').toBe(10);
    } finally {
      await cleanupTestSchedule(schedule.id);
      await prisma.route.delete({ where: { id: route.id } }).catch(() => {});
    }
  });
});
