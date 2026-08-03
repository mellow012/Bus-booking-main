import { test, expect, request as playwrightRequest } from '@playwright/test';
import { prisma } from '../src/lib/prisma';
import {
  safeguardProductionCheck,
  ensureTestUsers,
  createTestSchedule,
  TestUserSession,
} from './helpers/seat-concurrency-helpers';
import crypto from 'crypto';

test.describe('Security & IDOR Prevention Suite', () => {
  test.setTimeout(60_000);
  let testUsers: TestUserSession[] = [];

  test.beforeAll(async ({ baseURL }) => {
    safeguardProductionCheck(baseURL || 'http://localhost:3000');
    testUsers = await ensureTestUsers(2);
  });

  test('User 2 cannot access, cancel, or delete User 1 booking (IDOR Protection)', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    const user1 = testUsers[0];
    const user2 = testUsers[1];

    const schedule = await createTestSchedule(32);
    const companyId = schedule.companyId;
    const busId = schedule.busId;
    const routeId = schedule.routeId;

    // Create booking for User 1
    const booking1 = await prisma.booking.create({
      data: {
        bookingReference: `IDOR-${Date.now().toString().slice(-6)}`,
        userId: user1.userId,
        companyId,
        scheduleId: schedule.id,
        routeId,
        totalAmount: 15000,
        bookingStatus: 'confirmed',
        paymentStatus: 'paid',
        contactPhone: '+265999000000',
        contactEmail: user1.email,
        seatNumbers: ['S1'],
        passengerDetails: [{ firstName: 'User', lastName: 'One', seatNumber: 'S1' }],
      },
    });

    try {
      const apiUser2 = await playwrightRequest.newContext({
        baseURL: targetBaseUrl,
        extraHTTPHeaders: {
          cookie: user2.cookieHeader,
          'content-type': 'application/json',
        },
      });

      // 1. User 2 attempts GET User 1's booking details
      const getRes = await apiUser2.get(`/api/bookings/${booking1.id}`);
      expect(getRes.status(), 'GET another user booking returns HTTP 403 Forbidden').toBe(403);
      const getBody = await getRes.json();
      expect(getBody.error, 'Returns Unauthorized error').toBe('Unauthorized');

      // 2. User 2 attempts POST cancellation on User 1's booking
      const cancelRes = await apiUser2.post(`/api/bookings/${booking1.id}/cancel`);
      expect(cancelRes.status(), 'POST cancel another user booking returns HTTP 403 Forbidden').toBe(403);
      const cancelBody = await cancelRes.json();
      expect(cancelBody.error, 'Returns Unauthorized error').toBe('Unauthorized');

      // 3. User 2 attempts DELETE on User 1's booking
      const deleteRes = await apiUser2.delete(`/api/bookings/${booking1.id}`);
      expect(deleteRes.status(), 'DELETE another user booking returns HTTP 403 Forbidden').toBe(403);
      const deleteBody = await deleteRes.json();
      expect(deleteBody.error, 'Returns Unauthorized error').toBe('Unauthorized');

      // Verify DB booking remained completely intact
      const dbBooking = await prisma.booking.findUnique({ where: { id: booking1.id } });
      expect(dbBooking?.bookingStatus, 'Booking remains confirmed in DB').toBe('confirmed');

    } finally {
      await prisma.booking.delete({ where: { id: booking1.id } }).catch(() => {});
      await prisma.schedule.delete({ where: { id: schedule.id } }).catch(() => {});
    }
  });
});
