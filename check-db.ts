import { prisma } from './src/lib/prisma';

async function main() {
  const scheduleCount = await prisma.schedule.count();
  const bookingCount = await prisma.booking.count();
  const companyCount = await prisma.company.count();
  const busCount = await prisma.bus.count();
  const routeCount = await prisma.route.count();
  
  console.log('--- DATABASE RECORD COUNTS ---');
  console.log(`Companies: ${companyCount}`);
  console.log(`Buses: ${busCount}`);
  console.log(`Routes: ${routeCount}`);
  console.log(`Schedules: ${scheduleCount}`);
  console.log(`Bookings: ${bookingCount}`);
  
  if (scheduleCount > 0) {
    const activeFuture = await prisma.schedule.count({
      where: {
        status: 'active',
        departureDateTime: { gt: new Date() }
      }
    });
    console.log(`Active Future Schedules (visible to users): ${activeFuture}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
  });
