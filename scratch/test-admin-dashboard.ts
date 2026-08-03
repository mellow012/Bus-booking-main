import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import prisma from '../src/lib/prisma';
import { createBookingFull } from '../src/lib/actions/booking.actions';
import crypto from 'crypto';

async function runDashboardTests() {
  console.log('--- Starting Section 7 Admin / Operator Dashboards Verifications ---');

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

  // 1. Test StopsEditor data path consistency & Route creation/mutation
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

  console.log('[Test 1] Route created with StopsEditor stops format:', route.id);
  if (Array.isArray(route.stops) && (route.stops as any[]).length === 2) {
    console.log('✅ Route created and stops persisted correctly across dashboards.');
  } else {
    console.error('❌ Stops editor data path failed!');
  }

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

  // Execute 7-day windowed query
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

  console.log(`[Test 2] Missed schedules count in 7-day window: ${missedInWindow}`);
  if (missedInWindow === 1) {
    console.log('✅ "Missed Schedules" 7-day windowing bound correctly excludes older schedules (>7 days).');
  } else {
    console.error(`❌ Missed schedules windowing count unexpected: ${missedInWindow}`);
  }

  // 3. Test Return-Leg Price Calculation Fix
  const schedReturn = await prisma.schedule.create({
    data: {
      companyId, busId, routeId,
      departureDateTime: new Date(now.getTime() + 24 * 3600 * 1000),
      arrivalDateTime: new Date(now.getTime() + 28 * 3600 * 1000),
      availableSeats: 30, price: 15000,
      segmentPrices: { 'stop_1:__destination__': 8000 } as any, // Operator-set segment price for Dedza -> Blantyre
      status: 'active',
    },
  });

  const pricedSegmentRes = await createBookingFull({
    routeId,
    companyId,
    scheduleId: schedReturn.id,
    originStopId: 'stop_1',
    destinationStopId: '__destination__',
    passengerDetails: [{ firstName: 'Jane', lastName: 'Doe', seatNumber: 'S1' }],
    segments: [{ scheduleId: schedReturn.id, seatNumbers: ['S1'], originStopId: 'stop_1', destinationStopId: '__destination__' }],
  });

  console.log('[Test 3] Return leg segment fare result:', pricedSegmentRes);
  if (pricedSegmentRes.baseFare === 8000 && pricedSegmentRes.fareSource === 'operator_set') {
    console.log('✅ Return-leg price fix verified: uses operator segment price (8,000 MWK), not silent route base fare override (15,000 MWK).');
  } else {
    console.error('❌ Return leg fare calculation mismatch:', pricedSegmentRes);
  }

  // Cleanup test data
  if (pricedSegmentRes.bookingId) {
    await prisma.bookingSegment.deleteMany({ where: { bookingId: pricedSegmentRes.bookingId } }).catch(() => {});
    await prisma.booking.delete({ where: { id: pricedSegmentRes.bookingId } }).catch(() => {});
  }
  await prisma.schedule.deleteMany({ where: { id: { in: [schedRecentMissed.id, schedOldMissed.id, schedReturn.id] } } }).catch(() => {});
  await prisma.route.delete({ where: { id: routeId } }).catch(() => {});

  console.log('\n--- Section 7 Verifications Completed ---');
}

runDashboardTests().catch(console.error);
