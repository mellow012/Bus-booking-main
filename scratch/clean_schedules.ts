import { prisma } from '../src/lib/prisma';

async function main() {
  console.log("Cleaning up schedules...");

  const result = await prisma.schedule.deleteMany({
    where: {
      bookings: {
        none: {}
      },
      bookingSegments: {
        none: {}
      }
    }
  });

  console.log(`Successfully deleted ${result.count} schedules that had no bookings or segments.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
