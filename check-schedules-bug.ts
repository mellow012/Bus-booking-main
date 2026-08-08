require('dotenv').config();
import { prisma } from './src/lib/prisma';

async function checkSchedules() {
  const routes = await prisma.route.findMany({
    where: {
      origin: { contains: 'Lilongwe', mode: 'insensitive' },
      destination: { contains: 'Salima', mode: 'insensitive' }
    }
  });
  console.log("Found Routes:");
  console.log(routes.map(r => ({id: r.id, origin: r.origin, destination: r.destination})));

  for (const route of routes) {
    const schedules = await prisma.schedule.findMany({
      where: {
        routeId: route.id
      }
    });
    console.log(`Schedules for route ${route.id}:`);
    console.log(schedules.map(s => ({
      id: s.id,
      status: s.status,
      tripStatus: s.tripStatus,
      departureDateTime: s.departureDateTime,
      departureTimeZone: s.departureTimeZone,
      isActive: s.isActive,
      isArchived: s.isArchived,
      isCompleted: s.isCompleted
    })));
  }
}

checkSchedules().finally(() => prisma.$disconnect());
