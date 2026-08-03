import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import crypto from 'crypto';
import { createSessionCookieValue, COOKIE_NAME } from '../src/lib/session';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testRefundCutoffBypass() {
  console.log('=== SECTION 4 PROOF: DIRECT API REFUND CUTOFF BYPASS TEST ===\n');

  // 1. Create a customer user
  const userId = crypto.randomUUID();
  const user = await prisma.user.create({
    data: {
      id: userId,
      uid: userId,
      email: `refund-cutoff-tester-${Date.now()}@test.local`,
      firstName: 'Refund',
      lastName: 'Tester',
      role: 'customer',
    },
  });

  // 2. Fetch active company, bus, route
  const company = await prisma.company.findFirst({ where: { status: 'active' } });
  const bus = await prisma.bus.findFirst({ where: { status: 'active' } });
  const route = await prisma.route.findFirst({ where: { status: 'active' } });

  if (!company || !bus || !route) {
    throw new Error('Database missing active company/bus/route');
  }

  // 3. Create schedule departing in 60 minutes (WITHIN 2-HOUR CUTOFF)
  const scheduleId = crypto.randomUUID();
  const departureDateTime = new Date(Date.now() + 60 * 60 * 1000); // 60 mins from now
  const arrivalDateTime = new Date(departureDateTime.getTime() + 4 * 60 * 60 * 1000);

  const schedule = await prisma.schedule.create({
    data: {
      id: scheduleId,
      companyId: company.id,
      busId: bus.id,
      routeId: route.id,
      departureDateTime,
      arrivalDateTime,
      departureLocation: route.origin,
      arrivalLocation: route.destination,
      availableSeats: 30,
      bookedSeats: ['5'],
      price: 15000,
      status: 'active',
      tripStatus: 'scheduled',
    },
  });

  // 4. Create confirmed/paid booking for this user
  const bookingId = crypto.randomUUID();
  const booking = await prisma.booking.create({
    data: {
      id: bookingId,
      bookingReference: `CUTOFF-${Date.now().toString().slice(-6)}`,
      userId: user.id,
      scheduleId: schedule.id,
      routeId: route.id,
      companyId: company.id,
      seatNumbers: ['5'],
      totalAmount: 15000,
      bookingStatus: 'confirmed',
      paymentStatus: 'paid',
      passengerDetails: [{ name: 'Cutoff Tester', seatNumber: '5' }],
    },
  });

  console.log(`[Setup] Schedule ID: ${schedule.id}`);
  console.log(`[Setup] Departure Time: ${departureDateTime.toISOString()} (~60 mins away)`);
  console.log(`[Setup] Booking ID: ${booking.id} (${booking.bookingReference})`);

  // 5. Generate signed session cookie for user
  const cookieValue = await createSessionCookieValue({
    userId: user.id,
    role: 'customer',
    session_version: user.sessionVersion,
  });

  // 6. Direct API POST request to /api/bookings/[id]/cancel
  console.log(`\n[Action] Sending direct POST /api/bookings/${booking.id}/cancel...`);
  const response = await fetch(`http://localhost:3000/api/bookings/${booking.id}/cancel`, {
    method: 'POST',
    headers: {
      'Cookie': `${COOKIE_NAME}=${cookieValue}`,
      'Content-Type': 'application/json',
    },
  });

  const status = response.status;
  const body = await response.json();

  console.log('\n[API Response Output]');
  console.log(`HTTP Status Code: ${status}`);
  console.log('Response Body:', JSON.stringify(body, null, 2));

  // 7. Verification assertion
  if (status === 400 && body.error === 'Refund Cutoff Exceeded') {
    console.log('\n✅ PROOF CONFIRMED: Direct API cancellation within 2-hour window correctly rejected with 400 Bad Request!');
  } else {
    console.error('\n❌ PROOF FAILED: Direct API cancellation was NOT rejected as expected!');
  }

  // 8. Cleanup
  console.log('\n[Cleanup] Removing test records...');
  await prisma.bookingSegment.deleteMany({ where: { bookingId: booking.id } }).catch(() => {});
  await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
  await prisma.schedule.delete({ where: { id: schedule.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  console.log('[Cleanup] Done.');
}

testRefundCutoffBypass().catch(console.error);
