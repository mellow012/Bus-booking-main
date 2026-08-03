import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function migrateBookingSegments() {
  console.log('Starting BookingSegment migration...');

  // Find all bookings without any segments
  const bookingsWithoutSegments = await prisma.booking.findMany({
    where: {
      segments: {
        none: {},
      },
    },
    include: {
      schedule: true,
    },
  });

  console.log(`Found ${bookingsWithoutSegments.length} bookings without segments.`);

  let createdCount = 0;

  for (const booking of bookingsWithoutSegments) {
    const seatArray = Array.isArray(booking.seatNumbers)
      ? (booking.seatNumbers as string[])
      : typeof booking.seatNumbers === 'string'
      ? JSON.parse(booking.seatNumbers)
      : [];

    const passengerCount = seatArray.length > 0 ? seatArray.length : 1;

    await prisma.bookingSegment.create({
      data: {
        bookingId: booking.id,
        companyId: booking.companyId,
        scheduleId: booking.scheduleId,
        segmentIndex: 0,
        date: booking.bookingDate,
        seatNumbers: seatArray,
        passengerCount,
        price: booking.totalAmount,
        currency: booking.currency || 'MWK',
        originStopId: booking.originStopId || '__origin__',
        destinationStopId: booking.destinationStopId || '__destination__',
        metadata: {
          migrated: true,
          migratedAt: new Date().toISOString(),
        },
      },
    });

    createdCount++;
  }

  console.log(`Successfully migrated ${createdCount} bookings!`);

  const remainingUnmigrated = await prisma.booking.count({
    where: {
      segments: {
        none: {},
      },
    },
  });

  console.log(`Remaining bookings without segments: ${remainingUnmigrated}`);
}

migrateBookingSegments()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
