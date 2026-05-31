
import prisma from './src/lib/prisma';

async function main() {
  const count = await prisma.schedule.count();
  console.log('Total schedules:', count);

  const activeCount = await prisma.schedule.count({
    where: { status: 'active' }
  });
  console.log('Active schedules:', activeCount);

  const bookableCount = await prisma.schedule.count({
    where: { 
      status: 'active',
      availableSeats: { gt: 0 }
    }
  });
  console.log('Bookable schedules (seats > 0):', bookableCount);

  const routes = await prisma.route.findMany({
    take: 5,
    select: { origin: true, destination: true, id: true }
  });
  console.log('Sample Routes:', routes);

  const sampleSchedules = await prisma.schedule.findMany({
    take: 3,
    include: { route: true }
  });
  console.log('Sample Schedules:', JSON.stringify(sampleSchedules, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
