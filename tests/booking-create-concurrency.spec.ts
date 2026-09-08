import { test, expect, request as playwrightRequest } from '@playwright/test';
import crypto from 'crypto';
import { prisma } from '../src/lib/prisma';
import {
  cleanupTestSchedule,
  ensureTestUsers,
  safeguardProductionCheck,
  TestUserSession,
} from './helpers/seat-concurrency-helpers';

const MELLOW_TOURS_COMPANY_ID = '231f3927-809e-4420-aff9-c7648d6ad64e';
const REQUEST_TIMEOUT_MS = 180_000;

type RequestResult = {
  status: number | null;
  body: unknown;
  error?: string;
  userId: string;
  seat: string;
};

async function createMellowToursTestSchedule() {
  const [company, bus, route] = await Promise.all([
    prisma.company.findUnique({ where: { id: MELLOW_TOURS_COMPANY_ID } }),
    prisma.bus.findFirst({ where: { companyId: MELLOW_TOURS_COMPANY_ID, status: 'active' } }),
    prisma.route.findFirst({ where: { companyId: MELLOW_TOURS_COMPANY_ID, status: 'active' } }),
  ]);

  if (!company || !bus || !route) {
    throw new Error(`Missing Mellow Tours test data: company=${!!company}, bus=${!!bus}, route=${!!route}`);
  }
  if (bus.capacity < 5) {
    throw new Error(`Mellow Tours bus capacity ${bus.capacity} is below the required 5 seats`);
  }

  const departureDateTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return prisma.schedule.create({
    data: {
      id: crypto.randomUUID(),
      companyId: company.id,
      busId: bus.id,
      routeId: route.id,
      departureDateTime,
      arrivalDateTime: new Date(departureDateTime.getTime() + 4 * 60 * 60 * 1000),
      departureLocation: 'Lilongwe Terminal',
      arrivalLocation: 'Blantyre Terminal',
      availableSeats: 5,
      bookedSeats: [],
      price: 15000,
      status: 'active',
      tripStatus: 'scheduled',
      isActive: true,
    },
  });
}

async function postBooking(
  baseURL: string,
  user: TestUserSession,
  schedule: { id: string; routeId: string; companyId: string; departureDateTime: Date },
  seat: string,
): Promise<RequestResult> {
  const context = await playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: {
      cookie: user.cookieHeader,
      origin: baseURL,
      'content-type': 'application/json',
    },
  });

  try {
    const response = await context.post('/api/bookings/create', {
      data: {
        routeId: schedule.routeId,
        companyId: schedule.companyId,
        scheduleId: schedule.id,
        seatNumbers: [seat],
        passengerDetails: [{
          firstName: 'Concurrency',
          lastName: `User${user.userId}`,
          age: 30,
          gender: 'other',
          seatNumber: seat,
        }],
        segments: [{
          scheduleId: schedule.id,
          date: schedule.departureDateTime.toISOString(),
          seatNumbers: [seat],
        }],
      },
      timeout: REQUEST_TIMEOUT_MS,
    });

    return {
      status: response.status(),
      body: await response.json().catch(() => ({})),
      userId: user.userId,
      seat,
    };
  } catch (error) {
    return {
      status: null,
      body: null,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      userId: user.userId,
      seat,
    };
  } finally {
    await context.dispose();
  }
}

function failureBreakdown(results: RequestResult[]) {
  return results.filter(result => result.status !== 200).map(result => ({
    userId: result.userId,
    seat: result.seat,
    status: result.status,
    error: result.error,
    body: result.body,
  }));
}

async function readScheduleState(scheduleId: string) {
  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
  const bookings = await prisma.booking.findMany({
    where: { scheduleId },
    select: { id: true, seatNumbers: true },
  });
  const segments = await prisma.bookingSegment.findMany({
    where: { scheduleId },
    select: { id: true, bookingId: true, seatNumbers: true },
  });
  return { schedule, bookings, segments };
}

async function cleanupAndReport(scheduleId: string) {
  await cleanupTestSchedule(scheduleId);
  const [schedules, bookings, segments] = await Promise.all([
    prisma.schedule.count({ where: { id: scheduleId } }),
    prisma.booking.count({ where: { scheduleId } }),
    prisma.bookingSegment.count({ where: { scheduleId } }),
  ]);
  const residual = { schedules, bookings, segments };
  console.log('[Residual cleanup]', JSON.stringify(residual));
  expect(residual).toEqual({ schedules: 0, bookings: 0, segments: 0 });
  return residual;
}

test.describe('POST /api/bookings/create concurrency', () => {
  let testUsers: TestUserSession[] = [];

  test.beforeAll(async ({ baseURL }) => {
    safeguardProductionCheck(baseURL || 'http://localhost:3000');
    testUsers = await ensureTestUsers(40);
  });

  test.beforeEach(() => {
    test.setTimeout(600_000);
  });

  test('same-seat race: one booking wins', async ({ baseURL }) => {
    const targetBaseURL = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseURL);
    const schedule = await createMellowToursTestSchedule();

    try {
      const results = await Promise.all(
        testUsers.slice(0, 30).map(user => postBooking(targetBaseURL, user, schedule, '1')),
      );
      const state = await readScheduleState(schedule.id);
      const raw = {
        total: results.length,
        successCount: results.filter(result => result.status === 200).length,
        statusCounts: results.reduce<Record<string, number>>((counts, result) => {
          const key = String(result.status);
          counts[key] = (counts[key] || 0) + 1;
          return counts;
        }, {}),
        failures: failureBreakdown(results),
        availableSeats: state.schedule?.availableSeats,
        bookedSeats: state.schedule?.bookedSeats,
        bookingRows: state.bookings,
        bookingSegmentRows: state.segments,
      };
      console.log('[Raw same-seat race]', JSON.stringify(raw));

      expect(raw.successCount).toBe(1);
      expect(raw.statusCounts['409']).toBe(29);
      expect(raw.availableSeats).toBe(4);
      expect(state.bookings).toHaveLength(1);
      expect(state.segments).toHaveLength(1);
      expect(state.bookings[0].seatNumbers).toEqual(['1']);
    } finally {
      await cleanupAndReport(schedule.id);
    }
  });

  test('seat-count race: five seats fill exactly once', async ({ baseURL }) => {
    const targetBaseURL = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseURL);
    const schedule = await createMellowToursTestSchedule();

    try {
      const results = await Promise.all(
        testUsers.slice(0, 40).map((user, index) => postBooking(
          targetBaseURL,
          user,
          schedule,
          String((index % 5) + 1),
        )),
      );
      const state = await readScheduleState(schedule.id);
      const raw = {
        total: results.length,
        successCount: results.filter(result => result.status === 200).length,
        statusCounts: results.reduce<Record<string, number>>((counts, result) => {
          const key = String(result.status);
          counts[key] = (counts[key] || 0) + 1;
          return counts;
        }, {}),
        failures: failureBreakdown(results),
        availableSeats: state.schedule?.availableSeats,
        bookedSeats: state.schedule?.bookedSeats,
        bookingRows: state.bookings,
        bookingSegmentRows: state.segments,
      };
      console.log('[Raw seat-count race]', JSON.stringify(raw));

      const bookedSeats = Array.isArray(state.schedule?.bookedSeats)
        ? state.schedule.bookedSeats.filter((seat): seat is string => typeof seat === 'string')
        : [];
      expect(raw.successCount).toBe(5);
      expect(raw.availableSeats).toBe(0);
      expect(new Set(bookedSeats).size).toBe(5);
      expect(new Set(bookedSeats)).toEqual(new Set(['1', '2', '3', '4', '5']));
      expect(state.bookings).toHaveLength(5);
      expect(state.segments).toHaveLength(5);
      expect(failureBreakdown(results)).toHaveLength(35);
    } finally {
      await cleanupAndReport(schedule.id);
    }
  });

  test('happy path: one booking succeeds', async ({ baseURL }) => {
    const targetBaseURL = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseURL);
    const schedule = await createMellowToursTestSchedule();

    try {
      const result = await postBooking(targetBaseURL, testUsers[0], schedule, '1');
      const state = await readScheduleState(schedule.id);
      const raw = {
        result,
        availableSeats: state.schedule?.availableSeats,
        bookedSeats: state.schedule?.bookedSeats,
        bookingRows: state.bookings,
        bookingSegmentRows: state.segments,
      };
      console.log('[Raw happy path]', JSON.stringify(raw));

      expect(result.status).toBe(200);
      expect(state.schedule?.availableSeats).toBe(4);
      expect(state.bookings).toHaveLength(1);
      expect(state.segments).toHaveLength(1);
    } finally {
      await cleanupAndReport(schedule.id);
    }
  });
});



