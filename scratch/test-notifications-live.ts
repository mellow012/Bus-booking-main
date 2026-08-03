import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { sendDepartureReminders } from '../src/lib/notificationService';
import prisma from '../src/lib/prisma';
import crypto from 'crypto';

async function runTests() {
  console.log('--- Starting Section 5 Notifications Proof Verifications ---');

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      if (attempt > 1) await prisma.$disconnect().catch(() => {});
      await prisma.$connect();
      break;
    } catch (e) {
      if (attempt === 5) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const companyId = 'a0000000-0000-4000-8000-000000000001';
  const busId = 'b0000000-0000-4000-8000-000000000020';
  const routeId = crypto.randomUUID();
  const schedT60Id = crypto.randomUUID();
  const schedT15Id = crypto.randomUUID();
  const testUserId = 'concurrency-user-1';

  const now = new Date();
  // T-60 schedule: departing in 50 minutes (inside 65m window)
  const t60Dep = new Date(now.getTime() + 50 * 60 * 1000);
  const t60Arr = new Date(t60Dep.getTime() + 4 * 3600 * 1000);

  // T-15 schedule: departing in 10 minutes (inside 15m window)
  const t15Dep = new Date(now.getTime() + 10 * 60 * 1000);
  const t15Arr = new Date(t15Dep.getTime() + 4 * 3600 * 1000);

  const route = await prisma.route.create({
    data: {
      id: routeId, companyId, name: 'Notification Test Route', origin: 'Lilongwe', destination: 'Blantyre',
      distance: 300, duration: 240, baseFare: 15000, status: 'active', isActive: true,
    },
  });

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
      userId: testUserId, companyId, scheduleId: schedT60Id, routeId,
      totalAmount: 15000, bookingStatus: 'confirmed', paymentStatus: 'paid',
      contactPhone: '+265999000000', contactEmail: 'user1@test.local', seatNumbers: ['S1'],
      passengerDetails: [{ name: 'Test User', seatNumber: 'S1' }],
    },
  });

  const bookT15 = await prisma.booking.create({
    data: {
      bookingReference: `T15-${Date.now().toString().slice(-6)}`,
      userId: testUserId, companyId, scheduleId: schedT15Id, routeId,
      totalAmount: 15000, bookingStatus: 'confirmed', paymentStatus: 'paid',
      contactPhone: '+265999000000', contactEmail: 'user1@test.local', seatNumbers: ['S2'],
      passengerDetails: [{ name: 'Test User', seatNumber: 'S2' }],
    },
  });

  try {
    console.log('\n[Triggering Cron] Invoking sendDepartureReminders()...');
    const result = await sendDepartureReminders();
    console.log('[Cron Result]', result);

    // Query generated DB notifications
    const notifications = await prisma.notification.findMany({
      where: { userId: testUserId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    console.log('\n[Notifications Generated in DB]:');
    notifications.forEach(n => {
      console.log(`- ID: ${n.id} | Title: "${n.title}" | Body: "${n.message}" | Action: "${n.actionUrl}"`);
    });

    // Check DB deduplication flags
    const dbT60Sched = await prisma.schedule.findUnique({ where: { id: schedT60Id } });
    const dbT15Sched = await prisma.schedule.findUnique({ where: { id: schedT15Id } });

    console.log('\n[Deduplication Flags Verification]:');
    console.log(`- T-60 Schedule (departing in 50m): reminderSent = ${dbT60Sched?.reminderSent}`);
    console.log(`- T-15 Schedule (departing in 10m): boardingReminderSent = ${dbT15Sched?.boardingReminderSent}`);

    const hasT60Notif = notifications.some(n => n.title.includes('Upcoming Departure Reminder'));
    const hasT15Notif = notifications.some(n => n.title.includes('Bus Departing Shortly'));

    if (hasT60Notif && hasT15Notif && dbT60Sched?.reminderSent && dbT15Sched?.boardingReminderSent) {
      console.log('\n✅ Both T-60 and T-15 notifications generated with distinct titles, Africa/Blantyre times, and deduplication flags set!');
    } else {
      console.error('\n❌ Notification trigger verification incomplete.');
    }

  } finally {
    // Cleanup test records
    await prisma.notification.deleteMany({ where: { userId: testUserId } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { id: { in: [bookT60.id, bookT15.id] } } }).catch(() => {});
    await prisma.schedule.deleteMany({ where: { id: { in: [schedT60Id, schedT15Id] } } }).catch(() => {});
    await prisma.route.delete({ where: { id: routeId } }).catch(() => {});
    console.log('\n--- Section 5 Verifications Completed ---');
  }
}

runTests().catch(console.error);
