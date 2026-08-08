import { prisma } from '../src/lib/prisma';

async function checkSchedules() {
  const allSchedules = await prisma.schedule.findMany({
    include: {
      bookings: true,
      bookingSegments: true,
      groupRequests: true,
      reservations: true,
      activities: true,
      positionSamples: true,
    }
  });

  let withBookings = 0;
  let withoutBookings = 0;
  let withActiveBookings = 0;
  let withOnlyCancelledBookings = 0;

  for (const s of allSchedules) {
    if (s.bookings.length > 0) {
      withBookings++;
      const active = s.bookings.some(b => b.bookingStatus !== 'cancelled' && b.bookingStatus !== 'expired');
      if (active) {
        withActiveBookings++;
      } else {
        withOnlyCancelledBookings++;
      }
    } else {
      withoutBookings++;
    }
  }

  console.log(`Total Schedules: ${allSchedules.length}`);
  console.log(`Schedules without bookings: ${withoutBookings}`);
  console.log(`Schedules with bookings: ${withBookings}`);
  console.log(`  - With active bookings: ${withActiveBookings}`);
  console.log(`  - With ONLY cancelled/expired bookings: ${withOnlyCancelledBookings}`);
}

checkSchedules()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
