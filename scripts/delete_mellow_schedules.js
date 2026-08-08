const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Finding company Mellow Tours...');
  const company = await prisma.company.findFirst({
    where: {
      name: {
        contains: 'Mellow',
        mode: 'insensitive',
      },
    },
  });

  if (!company) {
    console.error('Could not find company matching "Mellow".');
    return;
  }

  console.log(`Found company: ${company.name} (ID: ${company.id})`);

  console.log('Fetching schedules...');
  const schedules = await prisma.schedule.findMany({
    where: {
      companyId: company.id,
    },
    orderBy: {
      createdAt: 'desc', // use 'departureDateTime' if you prefer latest departure
    },
  });

  if (schedules.length === 0) {
    console.log('No schedules found.');
    return;
  }

  console.log(`Found ${schedules.length} schedules.`);
  const latestSchedule = schedules[0];
  const schedulesToDelete = schedules.slice(1).map((s) => s.id);

  if (schedulesToDelete.length === 0) {
    console.log('Only 1 schedule exists. Nothing to delete.');
    return;
  }

  console.log(`Keeping latest schedule: ${latestSchedule.id} (Created: ${latestSchedule.createdAt})`);
  console.log(`Preparing to delete ${schedulesToDelete.length} schedules...`);

  // Because Prisma does not have cascading deletes set up for Schedule relations
  // we must manually delete related records first to avoid foreign key constraint errors.

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete SeatReservations
      const resCount = await tx.seatReservation.deleteMany({
        where: { scheduleId: { in: schedulesToDelete } },
      });
      console.log(`Deleted ${resCount.count} SeatReservations.`);

      // 2. Delete TripPositionSamples
      const posCount = await tx.tripPositionSample.deleteMany({
        where: { scheduleId: { in: schedulesToDelete } },
      });
      console.log(`Deleted ${posCount.count} TripPositionSamples.`);

      // 3. Delete BookingSegments
      const segCount = await tx.bookingSegment.deleteMany({
        where: { scheduleId: { in: schedulesToDelete } },
      });
      console.log(`Deleted ${segCount.count} BookingSegments.`);

      // 4. Delete Bookings
      // Note: This deletes all bookings tied to these schedules. 
      // Bookings might have their own payments, so those must be deleted first.
      const bookingIds = await tx.booking.findMany({
        where: { scheduleId: { in: schedulesToDelete } },
        select: { id: true },
      });
      const bIds = bookingIds.map(b => b.id);
      
      const paymentCount = await tx.payment.deleteMany({
        where: { bookingId: { in: bIds } },
      });
      console.log(`Deleted ${paymentCount.count} Payments.`);

      const bCount = await tx.booking.deleteMany({
        where: { id: { in: bIds } },
      });
      console.log(`Deleted ${bCount.count} Bookings.`);

      // 5. Finally delete the schedules
      const schedCount = await tx.schedule.deleteMany({
        where: { id: { in: schedulesToDelete } },
      });
      console.log(`Deleted ${schedCount.count} Schedules.`);

      return schedCount;
    });

    console.log('Cleanup completed successfully.');
  } catch (error) {
    console.error('Error during deletion:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
