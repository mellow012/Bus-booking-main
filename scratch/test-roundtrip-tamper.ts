import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { createBookingFull } from '../src/lib/actions/booking.actions';
import prisma from '../src/lib/prisma';
import crypto from 'crypto';

async function runVerification() {
  console.log('--- Starting Section 2 Proof Verifications ---');

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

  await prisma.company.upsert({
    where: { id: companyId },
    update: { status: 'active', returnTripDiscountPercent: 10 },
    create: { id: companyId, name: 'Roundtrip Test Co', email: 'rt@test.local', status: 'active', returnTripDiscountPercent: 10 },
  });

  await prisma.bus.upsert({
    where: { id: busId },
    update: { capacity: 32, status: 'active' },
    create: { id: busId, companyId, licensePlate: 'RT-BUS-01', busType: 'Standard', capacity: 32, status: 'active' },
  });

  const route = await prisma.route.create({
    data: {
      id: routeId,
      companyId,
      name: 'Lilongwe - Dedza - Blantyre',
      origin: 'Lilongwe',
      destination: 'Blantyre',
      distance: 300,
      duration: 240,
      baseFare: 20000,
      stops: [{ id: 'stop_dedza', name: 'Dedza', order: 0 }] as any,
      status: 'active',
      isActive: true,
    },
  });

  const now = new Date();
  const outboundDep = new Date(now.getTime() + 24 * 3600 * 1000);
  const outboundArr = new Date(outboundDep.getTime() + 4 * 3600 * 1000);

  // Invalid return: departure BEFORE outbound arrival
  const invalidReturnDep = new Date(outboundDep.getTime() + 2 * 3600 * 1000);
  const invalidReturnArr = new Date(invalidReturnDep.getTime() + 4 * 3600 * 1000);

  // Valid return: departure 24h AFTER outbound arrival
  const validReturnDep = new Date(outboundArr.getTime() + 24 * 3600 * 1000);
  const validReturnArr = new Date(validReturnDep.getTime() + 4 * 3600 * 1000);

  const outboundSched = await prisma.schedule.create({
    data: { companyId, busId, routeId, departureDateTime: outboundDep, arrivalDateTime: outboundArr, availableSeats: 32, price: 20000, status: 'active' },
  });

  const invalidReturnSched = await prisma.schedule.create({
    data: { companyId, busId, routeId, departureDateTime: invalidReturnDep, arrivalDateTime: invalidReturnArr, availableSeats: 32, price: 20000, status: 'active' },
  });

  const validReturnSched = await prisma.schedule.create({
    data: { companyId, busId, routeId, departureDateTime: validReturnDep, arrivalDateTime: validReturnArr, availableSeats: 32, price: 20000, status: 'active' },
  });

  try {
    // TEST A: Chronological Validation Failure
    console.log('\n[Test A] Attempting booking with return departure BEFORE outbound arrival...');
    const invalidChronRes = await createBookingFull({
      routeId,
      companyId,
      returnDate: invalidReturnDep.toISOString(),
      passengerDetails: [{ firstName: 'John', lastName: 'Doe', seatNumber: 'S1' }],
      segments: [
        { scheduleId: outboundSched.id, seatNumbers: ['S1'] },
        { scheduleId: invalidReturnSched.id, seatNumbers: ['S1'] },
      ],
    });

    console.log('[Test A Output]', invalidChronRes);
    if (invalidChronRes.error === 'Return departure must be after outbound bus arrives') {
      console.log('✅ Chronological validation blocked invalid return time successfully.');
    } else {
      console.error('❌ Chronological validation failed to block invalid return time!');
    }

    // TEST B: Server-Authoritative Return Discount & Tamper Resistance
    console.log('\n[Test B] Attempting round-trip booking with valid schedules (gross fare = 40,000, 10% discount expected = 4,000, net = 36,000)...');
    const validBookingRes = await createBookingFull({
      routeId,
      companyId,
      returnDate: validReturnDep.toISOString(),
      passengerDetails: [{ firstName: 'John', lastName: 'Doe', seatNumber: 'S1' }],
      segments: [
        { scheduleId: outboundSched.id, seatNumbers: ['S1'] },
        { scheduleId: validReturnSched.id, seatNumbers: ['S1'] },
      ],
    } as any);

    console.log('[Test B Output]', validBookingRes);
    if (validBookingRes.totalAmount === 36000 && validBookingRes.discountAmount === 4000) {
      console.log('✅ Server-authoritative 10% return discount verified (Charged total: 36,000 MWK, Discount: 4,000 MWK).');
    } else {
      console.error('❌ Discount calculation mismatch!');
    }

    // Clean up created booking
    if (validBookingRes.bookingId) {
      await prisma.bookingSegment.deleteMany({ where: { bookingId: validBookingRes.bookingId } });
      await prisma.booking.delete({ where: { id: validBookingRes.bookingId } });
    }

  } finally {
    // Cleanup test data
    await prisma.schedule.deleteMany({ where: { id: { in: [outboundSched.id, invalidReturnSched.id, validReturnSched.id] } } });
    await prisma.route.delete({ where: { id: routeId } });
    console.log('\n--- Section 2 Proof Verifications Completed ---');
  }
}

runVerification().catch(console.error);
