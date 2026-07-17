import 'dotenv/config';

import { checkAndRollSchedules } from '../src/lib/schedule-generator';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('--- BEFORE ROLL CHECK ---');
  const initialFuture = await prisma.schedule.count({
    where: {
      status: 'active',
      isActive: true,
      departureDateTime: { gte: new Date() }
    }
  });
  console.log(`Initial Active Future Schedules: ${initialFuture}`);

  console.log('\n--- RUNNING checkAndRollSchedules() ---');
  const result = await checkAndRollSchedules();
  console.log('Result:', result);

  console.log('\n--- AFTER ROLL CHECK ---');
  const finalFuture = await prisma.schedule.count({
    where: {
      status: 'active',
      isActive: true,
      departureDateTime: { gte: new Date() }
    }
  });
  console.log(`Final Active Future Schedules: ${finalFuture}`);

  if (finalFuture > 0) {
    console.log('\n--- SAMPLE FUTURE SCHEDULES ---');
    const sample = await prisma.schedule.findMany({
      where: {
        status: 'active',
        isActive: true,
        departureDateTime: { gte: new Date() }
      },
      include: {
        route: true,
        company: true
      },
      take: 3
    });
    for (const s of sample) {
      console.log(`ID: ${s.id}`);
      console.log(`  Company: ${s.company.name}`);
      console.log(`  Route: ${s.route.origin} to ${s.route.destination}`);
      console.log(`  Departure: ${s.departureDateTime.toISOString()}`);
      console.log(`  Arrival: ${s.arrivalDateTime.toISOString()}`);
      console.log(`  Seats Available: ${s.availableSeats}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
