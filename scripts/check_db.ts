import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSchedules() {
  const allSchedules = await prisma.schedule.findMany({
    include: {
      route: true,
      bus: true,
      company: true,
    }
  });
  console.log(`Total schedules: ${allSchedules.length}`);
  console.log('Status counts:', allSchedules.reduce((acc: any, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {}));
  
  if (allSchedules.length > 0) {
    console.log('Sample Schedule:', JSON.stringify({
      id: allSchedules[0].id,
      status: allSchedules[0].status,
      departure: allSchedules[0].departureDateTime,
      arrival: allSchedules[0].arrivalDateTime,
      availableSeats: allSchedules[0].availableSeats,
      companyStatus: allSchedules[0].company?.status,
      origin: allSchedules[0].route?.origin,
      destination: allSchedules[0].route?.destination
    }, null, 2));
  } else {
    console.log('No schedules found in database.');
  }
}

checkSchedules()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
