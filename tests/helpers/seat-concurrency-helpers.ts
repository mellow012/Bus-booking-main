// tests/helpers/seat-concurrency-helpers.ts
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { prisma } from '../../src/lib/prisma';
import { createSessionCookieValue, COOKIE_NAME } from '../../src/lib/session';

export interface TestUserSession {
  userId: string;
  email: string;
  cookieHeader: string;
  cookieName: string;
  cookieValue: string;
}

export function safeguardProductionCheck(baseURL: string) {
  const url = (baseURL || '').toLowerCase();
  const forbiddenDomains = ['vercel.app', 'busbooking', 'production', 'bus-booking-main-five'];
  for (const domain of forbiddenDomains) {
    if (url.includes(domain) && !url.includes('localhost') && !url.includes('127.0.0.1')) {
      throw new Error(`SAFEGUARD TRIGGERED: Refusing to run concurrency tests against production URL "${baseURL}"`);
    }
  }
}

export async function ensureTestUsers(count: number = 35): Promise<TestUserSession[]> {
  const userIds = Array.from({ length: count }, (_, i) => `concurrency-user-${i + 1}`);
  const emails = userIds.map(id => `${id}@test.local`);

  // Batch query all users at once (with retry for pooler cold connections)
  let existingUsers: any[] = [];
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      if (attempt > 1) {
        await prisma.$disconnect().catch(() => {});
      }
      await prisma.$connect().catch(() => {});
      existingUsers = await prisma.user.findMany({
        where: {
          OR: [
            { id: { in: userIds } },
            { uid: { in: userIds } },
            { email: { in: emails } }
          ]
        }
      });
      break;
    } catch (err) {
      await prisma.$disconnect().catch(() => {});
      if (attempt === 5) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const existingMap = new Map(existingUsers.map(u => [u.id, u]));
  const sessions: TestUserSession[] = [];

  for (let i = 1; i <= count; i++) {
    const userId = `concurrency-user-${i}`;
    const email = `concurrency-user-${i}@test.local`;
    let dbUser = existingMap.get(userId);

    let opSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              id: userId,
              uid: userId,
              email,
              firstName: `ConcurrentTest`,
              lastName: `User${i}`,
              role: 'customer',
              isActive: true,
              setupCompleted: true,
              emailVerified: true,
              sessionVersion: 1,
            }
          });
        } else {
          dbUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: { role: 'customer', isActive: true, setupCompleted: true, sessionVersion: 1 }
          });
        }
        opSuccess = true;
        break;
      } catch (err) {
        await prisma.$disconnect().catch(() => {});
        if (attempt === 3) throw err;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    const targetId = dbUser.id;
    const cookieValue = await createSessionCookieValue({
      userId: targetId,
      role: 'customer',
      session_version: dbUser.sessionVersion || 1,
    });

    sessions.push({
      userId: targetId,
      email,
      cookieName: COOKIE_NAME,
      cookieValue,
      cookieHeader: `${COOKIE_NAME}=${cookieValue}`,
    });
  }

  return sessions;
}

export async function createTestSchedule(capacity: number = 32) {
  const companyId = 'a0000000-0000-4000-8000-000000000001';
  const routeId = 'c0000000-0000-4000-8000-000000000001';
  const busId = `b0000000-0000-4000-8000-${capacity.toString(16).padStart(12, '0')}`;

  // Ensure company exists
  const company = await prisma.company.upsert({
    where: { id: companyId },
    update: {},
    create: {
      id: companyId,
      name: 'Concurrency Test Company',
      email: 'concurrency-company@test.local',
      status: 'active',
    }
  });

  // Ensure bus exists
  const bus = await prisma.bus.upsert({
    where: { id: busId },
    update: { capacity },
    create: {
      id: busId,
      companyId: company.id,
      licensePlate: `TEST-${capacity}-BUS`,
      busType: 'Standard',
      capacity,
      status: 'active',
    }
  });

  // Ensure route exists
  const route = await prisma.route.upsert({
    where: { id: routeId },
    update: {},
    create: {
      id: routeId,
      companyId: company.id,
      name: 'Lilongwe - Blantyre',
      origin: 'Lilongwe',
      destination: 'Blantyre',
      distance: 300,
      duration: 240,
      baseFare: 15000,
      status: 'active',
    }
  });

  // Create fresh schedule set 7 days in the future
  const departureDateTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const arrivalDateTime = new Date(departureDateTime.getTime() + 4 * 60 * 60 * 1000);
  const scheduleId = crypto.randomUUID();

  const schedule = await prisma.schedule.create({
    data: {
      id: scheduleId,
      companyId: company.id,
      busId: bus.id,
      routeId: route.id,
      departureDateTime,
      arrivalDateTime,
      departureLocation: 'Lilongwe Terminal',
      arrivalLocation: 'Blantyre Terminal',
      availableSeats: capacity,
      bookedSeats: [],
      price: 15000,
      status: 'active',
      tripStatus: 'scheduled',
      isActive: true,
    }
  });

  return schedule;
}

export async function cleanupTestSchedule(scheduleId: string) {
  try {
    await prisma.seatReservation.deleteMany({ where: { scheduleId } });
    const bookings = await prisma.booking.findMany({ where: { scheduleId }, select: { id: true } });
    const bookingIds = bookings.map(b => b.id);
    if (bookingIds.length > 0) {
      await prisma.bookingSegment.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
      await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } }).catch(() => {});
    }
    await prisma.schedule.delete({ where: { id: scheduleId } }).catch(() => {});
  } catch (err) {
    console.warn(`[cleanupTestSchedule] non-fatal cleanup error for ${scheduleId}:`, err);
  }
}

export async function queryScheduleReservations(scheduleId: string) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      reservations: {
        where: { status: 'reserved' },
        orderBy: { createdAt: 'asc' }
      }
    }
  });
  return schedule;
}
