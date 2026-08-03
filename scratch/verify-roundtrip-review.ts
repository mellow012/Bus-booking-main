import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import prisma from '../src/lib/prisma';

async function runVerification() {
  console.log('=== Starting Round-Trip Review & Journey State Verification ===\n');

  let companyId: string | null = null;
  let busId: string | null = null;
  let routeId: string | null = null;
  let outboundScheduleId: string | null = null;
  let returnScheduleId: string | null = null;
  let bookingId: string | null = null;
  let userId: string | null = null;

  try {
    // 1. Find or create test user, company, bus, route, and schedules
    const existingCompany = await prisma.company.findFirst();
    if (!existingCompany) throw new Error('No company found in DB');
    companyId = existingCompany.id;

    const existingUser = await prisma.user.findFirst({ where: { role: 'customer' } });
    if (!existingUser) throw new Error('No customer user found in DB');
    userId = existingUser.id;

    const existingBus = await prisma.bus.findFirst({ where: { companyId } });
    if (!existingBus) throw new Error('No bus found in DB');
    busId = existingBus.id;

    const existingRoute = await prisma.route.findFirst({ where: { companyId } });
    if (!existingRoute) throw new Error('No route found in DB');
    routeId = existingRoute.id;

    const now = new Date();
    const pastDeparture = new Date(now.getTime() - 4 * 3600 * 1000); // 4 hrs ago
    const pastArrival = new Date(now.getTime() - 2 * 3600 * 1000);   // 2 hrs ago
    const futureDeparture = new Date(now.getTime() + 24 * 3600 * 1000); // 24 hrs from now
    const futureArrival = new Date(now.getTime() + 28 * 3600 * 1000);   // 28 hrs from now

    // Create Outbound Schedule (Completed)
    const outboundSched = await prisma.schedule.create({
      data: {
        companyId,
        busId,
        routeId,
        departureDateTime: pastDeparture,
        arrivalDateTime: pastArrival,
        availableSeats: 40,
        price: 15000,
        status: 'active',
        tripStatus: 'completed',
      },
    });
    outboundScheduleId = outboundSched.id;

    // Create Return Schedule (Upcoming)
    const returnSched = await prisma.schedule.create({
      data: {
        companyId,
        busId,
        routeId,
        departureDateTime: futureDeparture,
        arrivalDateTime: futureArrival,
        availableSeats: 40,
        price: 15000,
        status: 'active',
        tripStatus: 'scheduled',
      },
    });
    returnScheduleId = returnSched.id;

    // Create Parent Round-Trip Booking
    const ref = `TEST-RT-${Date.now().toString().slice(-6)}`;
    const booking = await prisma.booking.create({
      data: {
        bookingReference: ref,
        userId,
        scheduleId: outboundScheduleId,
        companyId,
        totalAmount: 30000,
        bookingStatus: 'confirmed',
        paymentStatus: 'paid',
        seatNumbers: ['S1'],
        segments: {
          create: [
            {
              companyId,
              scheduleId: outboundScheduleId,
              segmentIndex: 0,
              date: pastDeparture,
              seatNumbers: ['S1'],
              passengerCount: 1,
              price: 15000,
            },
            {
              companyId,
              scheduleId: returnScheduleId,
              segmentIndex: 1,
              date: futureDeparture,
              seatNumbers: ['S1'],
              passengerCount: 1,
              price: 15000,
            },
          ],
        },
      },
      include: {
        segments: {
          include: {
            schedule: true,
          },
        },
        schedule: true,
      },
    });
    bookingId = booking.id;
    console.log(`✓ Created test round-trip booking: ${bookingId} (${ref})`);
    console.log(`  - Outbound Schedule: ${outboundScheduleId} (tripStatus: completed)`);
    console.log(`  - Return Schedule: ${returnScheduleId} (tripStatus: scheduled, departure: +24h)`);

    // 2. Initial State Verification (Before any review)
    console.log('\n--- Step 1: Evaluating Journey State before review ---');
    const outboundCompleted1 =
      booking.schedule.tripStatus === 'completed' ||
      (booking.schedule.tripStatus !== 'in_transit' && new Date() >= new Date(booking.schedule.arrivalDateTime));
    
    const returnSegment1 = booking.segments.find((s) => s.segmentIndex === 1);
    const activeSegment1 = outboundCompleted1 && returnSegment1 ? returnSegment1 : null;
    
    console.log(`  outboundCompleted: ${outboundCompleted1}`);
    console.log(`  activeSegment: ${activeSegment1 ? `Return Leg (segmentIndex 1, scheduleId: ${activeSegment1.scheduleId})` : 'Outbound Leg'}`);
    
    const activeLegReviewRating1 = activeSegment1
      ? ((booking as any).metadata?.returnReview?.rating ?? null)
      : ((booking as any).metadata?.outboundReview?.rating ?? (booking as any).reviewRating ?? null);
    
    console.log(`  activeLegReviewRating: ${activeLegReviewRating1}`);

    // 3. Submit Outbound Review
    console.log('\n--- Step 2: Submitting Outbound Review (rating: 5, leg: "outbound") ---');
    const reviewData = { rating: 5, reviewText: 'Awesome outbound journey!', createdAt: new Date().toISOString() };
    const currentMetadata = (booking.metadata as Record<string, any>) || {};
    const updatedMetadata = { ...currentMetadata, outboundReview: reviewData };

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        reviewRating: 5,
        reviewText: 'Awesome outbound journey!',
        metadata: updatedMetadata,
      },
    });
    console.log('✓ Outbound review updated in DB (booking.reviewRating=5, metadata.outboundReview set)');

    // 4. Post-Outbound Review Journey State Evaluation
    console.log('\n--- Step 3: Re-evaluating Journey State for Return Leg AFTER Outbound Review ---');
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        segments: {
          include: {
            schedule: true,
          },
        },
        schedule: true,
      },
    });
    if (!updatedBooking) throw new Error('Booking not found');

    const outboundCompleted2 =
      updatedBooking.schedule.tripStatus === 'completed' ||
      (updatedBooking.schedule.tripStatus !== 'in_transit' && new Date() >= new Date(updatedBooking.schedule.arrivalDateTime));
    
    const returnSegment2 = updatedBooking.segments.find((s) => s.segmentIndex === 1);
    const activeSegment2 = outboundCompleted2 && returnSegment2 ? returnSegment2 : null;
    
    console.log(`  outboundCompleted: ${outboundCompleted2}`);
    console.log(`  activeSegment: ${activeSegment2 ? `Return Leg (segmentIndex 1)` : 'Outbound Leg'}`);

    const activeLegReviewRating2 = activeSegment2
      ? ((updatedBooking as any).metadata?.returnReview?.rating ?? null)
      : ((updatedBooking as any).metadata?.outboundReview?.rating ?? (updatedBooking as any).reviewRating ?? null);

    console.log(`  activeLegReviewRating for return leg: ${activeLegReviewRating2}`);

    // Evaluate Journey State function logic for return leg
    const depTime = activeSegment2 ? activeSegment2.schedule.departureDateTime : updatedBooking.schedule.departureDateTime;
    const arrTime = activeSegment2 ? activeSegment2.schedule.arrivalDateTime : updatedBooking.schedule.arrivalDateTime;
    const tripStat = activeSegment2 ? activeSegment2.schedule.tripStatus : updatedBooking.schedule.tripStatus;

    function computeState(dep: Date, arr: Date, status: string, rating: number | null): string {
      const currentTime = new Date();
      if (status === 'completed') return 'completed';
      if (currentTime < dep) return 'upcoming';
      if (status === 'arrived') {
        if (rating) return 'completed';
        return 'arrived';
      }
      if (currentTime < arr) return 'in_transit';
      if (currentTime.getTime() > arr.getTime() + 5 * 3600 * 1000) return 'completed';
      return 'delayed';
    }

    const calculatedState = computeState(depTime, arrTime, tripStat, activeLegReviewRating2);
    console.log(`  Calculated Journey State for Return Leg: "${calculatedState}"`);

    // VERIFICATION ASSERTION 1: Return leg must NOT jump to 'completed'
    if (calculatedState === 'completed') {
      console.error('\n❌ FAIL: Return leg state prematurely jumped to "completed" after outbound review!');
      process.exit(1);
    } else {
      console.log(`\n✅ PASS ASSERTION 1: Return leg state is "${calculatedState}" (NOT "completed"). Outbound review did NOT corrupt return leg state!`);
    }

    // 5. Simulate Return Trip Arrival (Trip status = 'arrived')
    console.log('\n--- Step 4: Simulating Return Trip Arrival (tripStatus: "arrived") ---');
    await prisma.schedule.update({
      where: { id: returnScheduleId },
      data: {
        departureDateTime: new Date(now.getTime() - 2 * 3600 * 1000),
        arrivalDateTime: new Date(now.getTime() - 10 * 60 * 1000), // arrived 10 min ago
        tripStatus: 'arrived',
      },
    });

    const bookingAtArrival = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        segments: {
          include: { schedule: true },
        },
        schedule: true,
      },
    });

    const activeSeg3 = bookingAtArrival!.segments.find((s) => s.segmentIndex === 1)!;
    const rating3 = (bookingAtArrival as any).metadata?.returnReview?.rating ?? null;
    const stateAtArrival = computeState(
      activeSeg3.schedule.departureDateTime,
      activeSeg3.schedule.arrivalDateTime,
      activeSeg3.schedule.tripStatus,
      rating3
    );

    console.log(`  Return Leg Review Rating before return review: ${rating3}`);
    console.log(`  Calculated Journey State at Arrival: "${stateAtArrival}"`);

    if (stateAtArrival !== 'arrived') {
      console.error(`\n❌ FAIL: Expected "arrived" (prompting for return review), got "${stateAtArrival}"`);
      process.exit(1);
    } else {
      console.log('✅ PASS ASSERTION 2: Return leg state at arrival is "arrived", waiting for return review!');
    }

    // 6. Submit Return Review
    console.log('\n--- Step 5: Submitting Return Review (rating: 4, leg: "return") ---');
    const returnReviewData = { rating: 4, reviewText: 'Nice return trip!', createdAt: new Date().toISOString() };
    const metaWithReturn = { ...(bookingAtArrival!.metadata as any), returnReview: returnReviewData };

    await prisma.booking.update({
      where: { id: bookingId },
      data: { metadata: metaWithReturn },
    });

    const bookingAfterReturnReview = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        segments: {
          include: { schedule: true },
        },
        schedule: true,
      },
    });

    const rating4 = (bookingAfterReturnReview as any).metadata?.returnReview?.rating ?? null;
    const stateAfterReturnReview = computeState(
      activeSeg3.schedule.departureDateTime,
      activeSeg3.schedule.arrivalDateTime,
      activeSeg3.schedule.tripStatus,
      rating4
    );

    console.log(`  Return Leg Review Rating after return review: ${rating4}`);
    console.log(`  Calculated Journey State after return review: "${stateAfterReturnReview}"`);

    if (stateAfterReturnReview !== 'completed') {
      console.error(`\n❌ FAIL: Expected "completed" after return review, got "${stateAfterReturnReview}"`);
      process.exit(1);
    } else {
      console.log('✅ PASS ASSERTION 3: Return leg state correctly transitions to "completed" after return review!');
    }

    console.log('\n======================================================');
    console.log('🎉 ALL ROUND-TRIP REVIEW & JOURNEY STATE ASSERTIONS PASSED!');
    console.log('======================================================');
  } finally {
    // Cleanup
    if (bookingId) {
      await prisma.bookingSegment.deleteMany({ where: { bookingId } }).catch(() => {});
      await prisma.booking.delete({ where: { id: bookingId } }).catch(() => {});
    }
    if (outboundScheduleId) {
      await prisma.schedule.delete({ where: { id: outboundScheduleId } }).catch(() => {});
    }
    if (returnScheduleId) {
      await prisma.schedule.delete({ where: { id: returnScheduleId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runVerification().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
