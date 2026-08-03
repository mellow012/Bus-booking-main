import { test, expect, request as playwrightRequest } from '@playwright/test';
import { prisma } from '../src/lib/prisma';
import { cancelBooking } from '../src/lib/actions/booking.actions';
import {
  safeguardProductionCheck,
  ensureTestUsers,
  createTestSchedule,
  TestUserSession,
} from './helpers/seat-concurrency-helpers';
import crypto from 'crypto';

test.describe('Refund & Cancellation 2-Hour Cutoff Enforcement Suite', () => {
  test.setTimeout(60_000);
  let testUsers: TestUserSession[] = [];

  test.beforeAll(async ({ baseURL }) => {
    safeguardProductionCheck(baseURL || 'http://localhost:3000');
    testUsers = await ensureTestUsers(1);
  });

  test('1. Direct API cancellation within 2 hours of departure is rejected with policy details', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    const user = testUsers[0];
    const baseSched = await createTestSchedule(32);
    const companyId = baseSched.companyId;
    const busId = baseSched.busId;
    const routeId = baseSched.routeId;

    const now = new Date();
    // Departure in 1 hour (inside 2-hour cutoff window!)
    const depTime = new Date(now.getTime() + 1 * 3600 * 1000);
    const arrTime = new Date(depTime.getTime() + 4 * 3600 * 1000);

    const schedule = await prisma.schedule.create({
      data: {
        companyId, busId, routeId,
        departureDateTime: depTime,
        arrivalDateTime: arrTime,
        availableSeats: 32,
        price: 15000,
        status: 'active',
      },
    });

    const booking = await prisma.booking.create({
      data: {
        bookingReference: `RF-API-${Date.now().toString().slice(-6)}`,
        userId: user.userId,
        companyId,
        scheduleId: schedule.id,
        routeId,
        totalAmount: 15000,
        bookingStatus: 'confirmed',
        paymentStatus: 'paid',
        contactPhone: '+265999000000',
        contactEmail: user.email,
        seatNumbers: ['S1'],
        passengerDetails: [{ firstName: 'John', lastName: 'Doe', seatNumber: 'S1' }],
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

      // Attempt Direct API Cancellation
      const res = await api.post(`/api/bookings/${booking.id}/cancel`);
      expect(res.status(), 'API returns HTTP 400 Bad Request').toBe(400);

      const body = await res.json();
      expect(body.error, 'Error indicates Refund Cutoff Exceeded').toBe('Refund Cutoff Exceeded');
      expect(body.message, 'Explains 2-hour policy').toContain('within 2 hours of scheduled departure time');
      expect(body.policyCutoffHours, 'policyCutoffHours is 2').toBe(2);

      // Verify DB booking status remained confirmed (not cancelled)
      const dbBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
      expect(dbBooking?.bookingStatus, 'Booking remains confirmed in DB').toBe('confirmed');

    } finally {
      await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
      await prisma.schedule.delete({ where: { id: schedule.id } }).catch(() => {});
    }
  });

  test('2. Server Action cancelBooking() within 2 hours of departure is rejected', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    const user = testUsers[0];
    const baseSched = await createTestSchedule(32);
    const companyId = baseSched.companyId;
    const busId = baseSched.busId;
    const routeId = baseSched.routeId;

    const now = new Date();
    // Departure in 45 minutes (< 2 hours!)
    const depTime = new Date(now.getTime() + 45 * 60 * 1000);
    const arrTime = new Date(depTime.getTime() + 4 * 3600 * 1000);

    const schedule = await prisma.schedule.create({
      data: {
        companyId, busId, routeId,
        departureDateTime: depTime,
        arrivalDateTime: arrTime,
        availableSeats: 32,
        price: 15000,
        status: 'active',
      },
    });

    const booking = await prisma.booking.create({
      data: {
        bookingReference: `RF-ACT-${Date.now().toString().slice(-6)}`,
        userId: user.userId,
        companyId,
        scheduleId: schedule.id,
        routeId,
        totalAmount: 15000,
        bookingStatus: 'confirmed',
        paymentStatus: 'paid',
        contactPhone: '+265999000000',
        contactEmail: user.email,
        seatNumbers: ['S2'],
        passengerDetails: [{ firstName: 'Jane', lastName: 'Doe', seatNumber: 'S2' }],
      },
    });

    try {
      const actionResult = await cancelBooking(booking.id);
      expect(actionResult.success, 'Server action cancellation fails').toBe(false);
      expect(actionResult.error, 'Returns 2-hour policy message').toContain('within 2 hours of scheduled departure time');

      // Verify DB booking status remained confirmed
      const dbBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
      expect(dbBooking?.bookingStatus, 'Booking remains confirmed in DB').toBe('confirmed');

    } finally {
      await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
      await prisma.schedule.delete({ where: { id: schedule.id } }).catch(() => {});
    }
  });
});
