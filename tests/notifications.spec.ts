import { test, expect } from '@playwright/test';
import { prisma } from '../src/lib/prisma';
import { sendDepartureReminders } from '../src/lib/notificationService';
import {
  safeguardProductionCheck,
  ensureTestUsers,
  createTestSchedule,
  TestUserSession,
} from './helpers/seat-concurrency-helpers';
import crypto from 'crypto';

test.describe('Notifications — Departure & Boarding Reminders Suite', () => {
  test.setTimeout(60_000);
  let testUsers: TestUserSession[] = [];

  test.beforeAll(async ({ baseURL }) => {
    safeguardProductionCheck(baseURL || 'http://localhost:3000');
    testUsers = await ensureTestUsers(1);
  });

  test('Both T-60 departure reminder and T-15 boarding reminder fire distinct notifications with Africa/Blantyre times and deduplication', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    const user = testUsers[0];
    const baseSched = await createTestSchedule(32);
    const companyId = baseSched.companyId;
    const busId = baseSched.busId;
    const routeId = baseSched.routeId;

    const schedT60Id = crypto.randomUUID();
    const schedT15Id = crypto.randomUUID();

    const now = new Date();
    // T-60 schedule: departing in 50 minutes (inside 65m window)
    const t60Dep = new Date(now.getTime() + 50 * 60 * 1000);
    const t60Arr = new Date(t60Dep.getTime() + 4 * 3600 * 1000);

    // T-15 schedule: departing in 10 minutes (inside 15m window)
    const t15Dep = new Date(now.getTime() + 10 * 60 * 1000);
    const t15Arr = new Date(t15Dep.getTime() + 4 * 3600 * 1000);

    const schedT60 = await prisma.schedule.create({
      data: {
        id: schedT60Id, companyId, busId, routeId,
        departureDateTime: t60Dep, arrivalDateTime: t60Arr,
        availableSeats: 30, price: 15000, status: 'active', tripStatus: 'scheduled',
        reminderSent: false, boardingReminderSent: false,
      },
    });

    const schedT15 = await prisma.schedule.create({
      data: {
        id: schedT15Id, companyId, busId, routeId,
        departureDateTime: t15Dep, arrivalDateTime: t15Arr,
        availableSeats: 30, price: 15000, status: 'active', tripStatus: 'scheduled',
        reminderSent: false, boardingReminderSent: false,
      },
    });

    const bookT60 = await prisma.booking.create({
      data: {
        bookingReference: `T60-${Date.now().toString().slice(-6)}`,
        userId: user.userId, companyId, scheduleId: schedT60Id, routeId,
        totalAmount: 15000, bookingStatus: 'confirmed', paymentStatus: 'paid',
        contactPhone: '+265999000000', contactEmail: user.email, seatNumbers: ['S1'],
        passengerDetails: [{ name: 'Test User', seatNumber: 'S1' }],
      },
    });

    const bookT15 = await prisma.booking.create({
      data: {
        bookingReference: `T15-${Date.now().toString().slice(-6)}`,
        userId: user.userId, companyId, scheduleId: schedT15Id, routeId,
        totalAmount: 15000, bookingStatus: 'confirmed', paymentStatus: 'paid',
        contactPhone: '+265999000000', contactEmail: user.email, seatNumbers: ['S2'],
        passengerDetails: [{ name: 'Test User', seatNumber: 'S2' }],
      },
    });

    try {
      // 1. Trigger Departure Reminders Cron
      const cronResult = await sendDepartureReminders();
      expect(cronResult.processedSchedules, 'Processes at least 2 schedules').toBeGreaterThanOrEqual(2);
      expect(cronResult.sentNotifications, 'Sends at least 2 notifications').toBeGreaterThanOrEqual(2);

      // 2. Fetch Notifications from Database
      const userNotifications = await prisma.notification.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: 'desc' },
      });

      const t60Notif = userNotifications.find(n => n.title.includes('Upcoming Departure Reminder'));
      const t15Notif = userNotifications.find(n => n.title.includes('Bus Departing Shortly'));

      // Assertions for T-60
      expect(t60Notif, 'T-60 notification created').toBeDefined();
      expect(t60Notif?.actionUrl, 'Action URL points to /bookings').toBe('/bookings');
      expect(t60Notif?.priority, 'Priority is high').toBe('high');

      // Assertions for T-15
      expect(t15Notif, 'T-15 notification created').toBeDefined();
      expect(t15Notif?.actionUrl, 'Action URL points to /bookings').toBe('/bookings');
      expect(t15Notif?.priority, 'Priority is high').toBe('high');

      // 3. Verify Deduplication Flags Set on Schedules
      const dbT60Sched = await prisma.schedule.findUnique({ where: { id: schedT60Id } });
      const dbT15Sched = await prisma.schedule.findUnique({ where: { id: schedT15Id } });

      expect(dbT60Sched?.reminderSent, 'reminderSent flag updated to true for T-60').toBe(true);
      expect(dbT15Sched?.boardingReminderSent, 'boardingReminderSent flag updated to true for T-15').toBe(true);

      // 4. Verify Second Cron Trigger does NOT resend duplicate notifications
      const secondCronResult = await sendDepartureReminders();
      const userNotificationsSecond = await prisma.notification.findMany({
        where: { userId: user.userId },
      });
      expect(userNotificationsSecond.length, 'No duplicate notifications generated on 2nd run').toBe(userNotifications.length);

    } finally {
      await prisma.notification.deleteMany({ where: { userId: user.userId } }).catch(() => {});
      await prisma.booking.deleteMany({ where: { id: { in: [bookT60.id, bookT15.id] } } }).catch(() => {});
      await prisma.schedule.deleteMany({ where: { id: { in: [schedT60Id, schedT15Id] } } }).catch(() => {});
    }
  });
});
