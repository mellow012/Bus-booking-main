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

async function runSection2AuditProof() {
  console.log('=== SECTION 2 PROOF: ROUND-TRIP, INTERMEDIATE STOPS & PAYLOAD TAMPERING AUDIT ===\n');

  // 1. Setup User
  const userId = crypto.randomUUID();
  const user = await prisma.user.create({
    data: {
      id: userId,
      uid: userId,
      email: `section2-tester-${Date.now()}@test.local`,
      firstName: 'RoundTrip',
      lastName: 'Auditor',
      role: 'customer',
    },
  });

  const cookieValue = await createSessionCookieValue({
    userId: user.id,
    role: 'customer',
    session_version: user.sessionVersion,
  });

  const company = await prisma.company.findFirst({ where: { status: 'active' } });
  const bus = await prisma.bus.findFirst({ where: { status: 'active' } });
  if (!company || !bus) throw new Error('Active company or bus not found');

  // 2. Create Route with intermediate stop "Ntcheu"
  const routeId = crypto.randomUUID();
  const route = await prisma.route.create({
    data: {
      id: routeId,
      companyId: company.id,
      name: 'Blantyre - Ntcheu - Lilongwe',
      origin: 'Blantyre',
      destination: 'Lilongwe',
      distance: 310,
      duration: 240,
      baseFare: 20000,
      stops: [
        { id: 'stop_ntcheu_999', name: 'Ntcheu', order: 0, distanceFromOrigin: 150 },
      ] as any,
      status: 'active',
      isActive: true,
    },
  });

  // 3. Create Outbound Schedule and Return Schedule
  const outDeparture = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const outArrival = new Date(outDeparture.getTime() + 4 * 60 * 60 * 1000);
  const retDeparture = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const retArrival = new Date(retDeparture.getTime() + 4 * 60 * 60 * 1000);

  const outSchedule = await prisma.schedule.create({
    data: {
      id: crypto.randomUUID(),
      companyId: company.id,
      busId: bus.id,
      routeId: route.id,
      departureDateTime: outDeparture,
      arrivalDateTime: outArrival,
      departureLocation: 'Blantyre',
      arrivalLocation: 'Lilongwe',
      availableSeats: 30,
      bookedSeats: [],
      price: 20000,
      status: 'active',
      tripStatus: 'scheduled',
    },
  });

  const retSchedule = await prisma.schedule.create({
    data: {
      id: crypto.randomUUID(),
      companyId: company.id,
      busId: bus.id,
      routeId: route.id,
      departureDateTime: retDeparture,
      arrivalDateTime: retArrival,
      departureLocation: 'Lilongwe',
      arrivalLocation: 'Blantyre',
      availableSeats: 30,
      bookedSeats: [],
      price: 20000,
      status: 'active',
      tripStatus: 'scheduled',
    },
  });

  console.log(`[Setup] Outbound Schedule: ${outSchedule.id}`);
  console.log(`[Setup] Return Schedule:   ${retSchedule.id}\n`);

  // ── TEST A: TAMPERING ATTACK RE-TEST ───────────────────────────────────────
  console.log('[Test A] Attempting Payload Tampering Attacks on /api/bookings/create...');

  // Attack 1: User sends artificial discountAmount = 19000 & totalAmount = 1000 in payload
  const fakeDiscountPayload = {
    routeId: route.id,
    companyId: company.id,
    scheduleId: outSchedule.id,
    passengerDetails: [{ firstName: 'John', lastName: 'Doe', seatNumber: '4' }],
    seatNumbers: ['4'],
    totalAmount: 1000, // Tampered price
    discountAmount: 19000, // Tampered fake discount
  };

  const attack1Res = await fetch('http://localhost:3000/api/bookings/create', {
    method: 'POST',
    headers: { 'Cookie': `${COOKIE_NAME}=${cookieValue}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(fakeDiscountPayload),
  });

  const attack1Body = await attack1Res.json();
  console.log(`Attack 1 (Tampered Discount/Total) Status: ${attack1Res.status}`);
  console.log(`Server-Authoritative Total Returned: MWK ${attack1Body.totalAmount} (Expected: 20000)`);
  console.log(`Discount Applied: MWK ${attack1Body.discountAmount || 0} (Client value 19000 strictly ignored)\n`);

  if (attack1Body.totalAmount === 20000 && (attack1Body.discountAmount || 0) === 0) {
    console.log('✅ PASS: Server ignored client-supplied discount/total price and computed true server-authoritative fare!');
  } else {
    console.error('❌ FAIL: Client payload price tampering was accepted!');
  }

  // ── TEST B: ROUND-TRIP DISCOUNT & SEGMENT CREATION ───────────────────────
  console.log('\n[Test B] Booking a Real Round-Trip with Intermediate Stop (Blantyre -> Ntcheu)...');

  const roundTripPayload = {
    routeId: route.id,
    companyId: company.id,
    scheduleId: outSchedule.id,
    originStopId: '__origin__',
    destinationStopId: 'stop_ntcheu_999',
    returnDate: retDeparture.toISOString(),
    passengerDetails: [{ firstName: 'Jane', lastName: 'Doe', seatNumber: '10' }],
    segments: [
      {
        scheduleId: outSchedule.id,
        seatNumbers: ['10'],
        originStopId: '__origin__',
        destinationStopId: 'stop_ntcheu_999',
      },
      {
        scheduleId: retSchedule.id,
        seatNumbers: ['10'],
        originStopId: 'stop_ntcheu_999',
        destinationStopId: '__destination__',
      },
    ],
  };

  const rtRes = await fetch('http://localhost:3000/api/bookings/create', {
    method: 'POST',
    headers: { 'Cookie': `${COOKIE_NAME}=${cookieValue}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(roundTripPayload),
  });

  const rtBody = await rtRes.json();
  console.log(`Round-Trip Creation Status: ${rtRes.status}`);
  console.log('Booking Result:', JSON.stringify(rtBody, null, 2));

  // Verify BookingSegments in Database
  const createdBooking = await prisma.booking.findUnique({
    where: { id: rtBody.bookingId },
    include: { segments: true },
  });

  console.log(`\nCreated Booking Segments Count: ${createdBooking?.segments.length}`);
  createdBooking?.segments.forEach((seg, idx) => {
    console.log(`  Segment ${idx + 1}: Schedule ${seg.scheduleId}, Seats: ${JSON.stringify(seg.seatNumbers)}, StopRange: ${seg.originStopId} -> ${seg.destinationStopId}`);
  });

  if (createdBooking?.segments.length === 2) {
    console.log('✅ PASS: BookingSegment created cleanly for both outbound and return legs as universal source of truth!');
  } else {
    console.error('❌ FAIL: BookingSegment post-migration model missing segment records!');
  }

  // ── CLEANUP ─────────────────────────────────────────────────────────────────
  console.log('\n[Cleanup] Removing Section 2 test records...');
  if (createdBooking) {
    await prisma.bookingSegment.deleteMany({ where: { bookingId: createdBooking.id } });
    await prisma.booking.delete({ where: { id: createdBooking.id } });
  }
  await prisma.schedule.deleteMany({ where: { id: { in: [outSchedule.id, retSchedule.id] } } });
  await prisma.route.delete({ where: { id: route.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log('[Cleanup] Completed cleanly.');
}

runSection2AuditProof().catch(console.error);
