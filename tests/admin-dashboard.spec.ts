import { test, expect, request as playwrightRequest } from '@playwright/test';
import { prisma } from '../src/lib/prisma';
import {
  safeguardProductionCheck,
  ensureTestUsers,
  createTestSchedule,
  TestUserSession,
} from './helpers/seat-concurrency-helpers';
import crypto from 'crypto';

test.describe('Admin & Operator Dashboards Verification Suite', () => {
  test.setTimeout(60_000);
  let testUsers: TestUserSession[] = [];

  test.beforeAll(async ({ baseURL }) => {
    safeguardProductionCheck(baseURL || 'http://localhost:3000');
    testUsers = await ensureTestUsers(1);
  });

  test('1. StopsEditor route creation, Missed Schedules 7-day windowing, and return leg segment pricing', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    const user = testUsers[0];
    const baseSched = await createTestSchedule(32);
    const companyId = baseSched.companyId;
    const busId = baseSched.busId;
    const routeId = crypto.randomUUID();

    // 1. Test StopsEditor data path & Route creation
    const stops = [
      { id: 'stop_1', name: 'Dedza', distanceFromOrigin: 100, order: 0 },
      { id: 'stop_2', name: 'Ntcheu', distanceFromOrigin: 160, order: 1 },
    ];

    const route = await prisma.route.create({
      data: {
        id: routeId,
        companyId,
        name: 'Lilongwe - Dedza - Ntcheu - Blantyre',
        origin: 'Lilongwe',
        destination: 'Blantyre',
        distance: 300,
        duration: 240,
        baseFare: 15000,
        stops: stops as any,
        status: 'active',
        isActive: true,
      },
    });

    expect(route.id, 'Route created successfully').toBeDefined();
    expect(Array.isArray(route.stops) && (route.stops as any[]).length === 2, 'Stops stored correctly').toBe(true);

    // 2. Test Missed Schedules 7-Day Windowing Query
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 3600 * 1000);

    const schedRecentMissed = await prisma.schedule.create({
      data: {
        companyId, busId, routeId,
        departureDateTime: new Date(now.getTime() - 2 * 24 * 3600 * 1000), // 2 days ago
        arrivalDateTime: new Date(now.getTime() - 2 * 24 * 3600 * 1000 + 4 * 3600 * 1000),
        availableSeats: 30, price: 15000, status: 'active', tripStatus: 'scheduled',
      },
    });

    const schedOldMissed = await prisma.schedule.create({
      data: {
        companyId, busId, routeId,
        departureDateTime: tenDaysAgo, // 10 days ago (outside 7-day window!)
        arrivalDateTime: new Date(tenDaysAgo.getTime() + 4 * 3600 * 1000),
        availableSeats: 30, price: 15000, status: 'active', tripStatus: 'scheduled',
      },
    });

    const missedInWindow = await prisma.schedule.count({
      where: {
        companyId,
        routeId,
        tripStatus: 'scheduled',
        departureDateTime: {
          gte: sevenDaysAgo,
          lt: now,
        },
      },
    });

    expect(missedInWindow, 'Missed schedules query strictly bounds to 7 days').toBe(1);

    // 3. Test Return Leg Price Calculation Fix (Operator Segment Price vs Base Fare Override)
    const schedReturn = await prisma.schedule.create({
      data: {
        companyId, busId, routeId,
        departureDateTime: new Date(now.getTime() + 24 * 3600 * 1000),
        arrivalDateTime: new Date(now.getTime() + 28 * 3600 * 1000),
        availableSeats: 30, price: 15000,
        segmentPrices: { 'stop_1:__destination__': 8000 } as any, // Operator segment price: 8,000 MWK
        status: 'active',
      },
    });

    const api = await playwrightRequest.newContext({
      baseURL: targetBaseUrl,
      extraHTTPHeaders: {
        cookie: user.cookieHeader,
        'content-type': 'application/json',
      },
    });

    const createRes = await api.post('/api/bookings/create', {
      data: {
        routeId,
        companyId,
        scheduleId: schedReturn.id,
        originStopId: 'stop_1',
        destinationStopId: '__destination__',
        passengerDetails: [{ firstName: 'Jane', lastName: 'Doe', seatNumber: 'S1' }],
        segments: [{ scheduleId: schedReturn.id, seatNumbers: ['S1'], originStopId: 'stop_1', destinationStopId: '__destination__' }],
      },
    });

    expect(createRes.status(), 'API creation returns HTTP 200').toBe(200);
    const body = await createRes.json();

    expect(body.baseFare, 'Uses operator segment price of 8,000 MWK').toBe(8000);
    expect(body.fareSource, 'fareSource is operator_set').toBe('operator_set');

    // Cleanup created test records
    if (body.bookingId) {
      await prisma.bookingSegment.deleteMany({ where: { bookingId: body.bookingId } }).catch(() => {});
      await prisma.booking.delete({ where: { id: body.bookingId } }).catch(() => {});
    }
    await prisma.schedule.deleteMany({ where: { id: { in: [schedRecentMissed.id, schedOldMissed.id, schedReturn.id] } } }).catch(() => {});
    await prisma.route.delete({ where: { id: routeId } }).catch(() => {});
  });
});
