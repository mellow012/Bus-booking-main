import { config } from 'dotenv';
config();
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Adding trips for TODAY...');

  const companies = await prisma.company.findMany({
    where: { name: { in: ['Zikomo Express', 'Nyasa Star Lines', 'Malawi Swift Transit'] } },
    include: {
      routes: true,
      buses: true
    }
  });

  if (companies.length === 0) {
    console.log('No seed companies found. Did you run the main seed script?');
    return;
  }

  // Current date but set hours
  const now = new Date();

  // Let's create two trips for today for each company
  // 1. A morning trip (maybe active or just departed depending on current time)
  const morningTrip = new Date(now);
  morningTrip.setHours(8, 30, 0, 0); // 8:30 AM today

  // 2. An afternoon trip
  const afternoonTrip = new Date(now);
  afternoonTrip.setHours(15, 0, 0, 0); // 3:00 PM today

  for (const company of companies) {
    if (company.routes.length > 0 && company.buses.length > 0) {
      // Add morning trip
      const route1 = company.routes[0];
      const bus1 = company.buses[0];
      
      const arrDate1 = new Date(morningTrip);
      arrDate1.setMinutes(arrDate1.getMinutes() + route1.duration);

      await prisma.schedule.create({
        data: {
          companyId: company.id,
          busId: bus1.id,
          routeId: route1.id,
          departureDateTime: morningTrip,
          arrivalDateTime: arrDate1,
          departureLocation: `${route1.origin} Main Depot`,
          arrivalLocation: `${route1.destination} Bus Terminal`,
          availableSeats: bus1.capacity,
          price: route1.baseFare,
          status: 'active',
          tripStatus: 'scheduled',
          isActive: true,
        }
      });
      console.log(`Added TODAY morning trip: ${route1.name} at ${morningTrip.toISOString()} for ${company.name}`);

      // Add afternoon trip
      if (company.routes.length > 1 && company.buses.length > 1) {
        const route2 = company.routes[1];
        const bus2 = company.buses[1];
        
        const arrDate2 = new Date(afternoonTrip);
        arrDate2.setMinutes(arrDate2.getMinutes() + route2.duration);

        await prisma.schedule.create({
          data: {
            companyId: company.id,
            busId: bus2.id,
            routeId: route2.id,
            departureDateTime: afternoonTrip,
            arrivalDateTime: arrDate2,
            departureLocation: `${route2.origin} Main Depot`,
            arrivalLocation: `${route2.destination} Bus Terminal`,
            availableSeats: bus2.capacity,
            price: route2.baseFare,
            status: 'active',
            tripStatus: 'scheduled',
            isActive: true,
          }
        });
        console.log(`Added TODAY afternoon trip: ${route2.name} at ${afternoonTrip.toISOString()} for ${company.name}`);
      }
    }
  }

  console.log("Today's trips added successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
