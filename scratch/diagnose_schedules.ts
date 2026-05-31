import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DIAGNOSING SCHEDULES ---');
  try {
    const companies = await prisma.company.findMany();
    console.log('Companies found:', companies.map(c => ({ id: c.id, name: c.name, status: c.status })));

    const schedules = await prisma.schedule.findMany({
      include: {
        company: true,
        route: true
      }
    });
    
    console.log(`Total schedules: ${schedules.length}`);
    schedules.forEach(s => {
      console.log(`ID: ${s.id}`);
      console.log(`  Route: ${s.route.origin} -> ${s.route.destination}`);
      console.log(`  Status: ${s.status}, isActive: ${s.isActive}, isArchived: ${s.isArchived}`);
      console.log(`  Company: ${s.company.name} (Status: ${s.company.status})`);
      console.log(`  Available Seats: ${s.availableSeats}`);
      console.log(`  Departure: ${s.departureDateTime}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
