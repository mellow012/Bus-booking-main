import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { cancelBooking } from '../src/lib/actions/booking.actions';
import prisma from '../src/lib/prisma';
import crypto from 'crypto';

async function runVerification() {
  console.log('--- Starting Section 4 Payments & Refund Cutoff Proof Verifications ---');

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
  const scheduleId = crypto.randomUUID();

  // Create schedule departing in 1 hour (inside 2-hour cutoff window!)
  const now = new Date();
  const depTime = new Date(now.getTime() + 1 * 3600 * 1000); // 1h in future (< 2h)
  const arrTime = new Date(depTime.getTime() + 4 * 3600 * 1000);

  const route = await prisma.route.create({
    data: {
      id: routeId, companyId, name: 'Refund Test Route', origin: 'Lilongwe', destination: 'Blantyre',
      distance: 300, duration: 240, baseFare: 15000, status: 'active', isActive: true,
    },
  });

  const schedule = await prisma.schedule.create({
    data: {
      id: scheduleId, companyId, busId, routeId,
      departureDateTime: depTime, arrivalDateTime: arrTime,
      availableSeats: 30, price: 15000, status: 'active',
    },
  });

  const booking = await prisma.booking.create({
    data: {
      bookingReference: `RF-${Date.now().toString().slice(-6)}`,
      userId: 'concurrency-user-1',
      companyId,
      scheduleId,
      routeId,
      totalAmount: 15000,
      bookingStatus: 'confirmed',
      paymentStatus: 'paid',
      contactPhone: '+265999000000',
      contactEmail: 'user1@test.local',
      seatNumbers: ['S1'],
      passengerDetails: [{ name: 'John Doe', seatNumber: 'S1' }],
    },
  });

  try {
    // 1. Test Server Action cancelBooking inside 2-hour cutoff window
    console.log('\n[Test 1] Invoking cancelBooking() for departure departing in 1 hour (< 2h cutoff)...');
    const actionResult = await cancelBooking(booking.id);

    console.log('[Test 1 Output]', actionResult);
    if (!actionResult.success && actionResult.error?.includes('within 2 hours of scheduled departure time')) {
      console.log('✅ cancelBooking Server Action successfully BLOCKED cancellation inside 2-hour window.');
    } else {
      console.error('❌ cancelBooking Server Action allowed illegal cancellation!');
    }

  } finally {
    // Cleanup test data
    await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
    await prisma.schedule.delete({ where: { id: scheduleId } }).catch(() => {});
    await prisma.route.delete({ where: { id: routeId } }).catch(() => {});
    console.log('\n--- Section 4 Verifications Completed ---');
  }
}

runVerification().catch(console.error);
