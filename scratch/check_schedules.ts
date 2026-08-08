import { prisma } from '../src/lib/prisma';

async function main() {
  const totalSchedules = await prisma.schedule.count();
  const futureSchedules = await prisma.schedule.count({
    where: {
      departureDateTime: {
        gte: new Date()
      }
    }
  });

  console.log(`Total schedules: ${totalSchedules}`);
  console.log(`Future schedules: ${futureSchedules}`);
  
  const schedulesWithBookings = await prisma.schedule.count({
    where: {
      bookings: {
        some: {}
      }
    }
  });
  
  console.log(`Schedules with bookings: ${schedulesWithBookings}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
