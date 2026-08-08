import { prisma } from './src/lib/prisma';
import { createSchedule, materializeSchedules } from './src/lib/actions/schedule.actions';

async function main() {
  console.log("--- Starting Conflict Verification ---");

  // Get a random active company and route
  const route = await prisma.route.findFirst({ where: { isActive: true } });
  const bus = await prisma.bus.findFirst({ where: { isActive: true } });
  
  if (!route || !bus) {
    console.log("Not enough data to run test");
    return;
  }

  const companyId = route.companyId;
  const busId = bus.id;
  const routeId = route.id;

  // Let's create a schedule from 10:00 to 12:00 tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const depTime1 = new Date(tomorrow);
  depTime1.setHours(10, 0, 0, 0);
  const arrTime1 = new Date(tomorrow);
  arrTime1.setHours(12, 0, 0, 0);

  console.log("\n1. Testing single schedule creation...");
  console.log(`Creating valid schedule for bus ${busId} from 10:00 to 12:00`);
  
  let result1 = await createSchedule({
    id: "test-schedule-1",
    companyId,
    busId,
    routeId,
    departureDateTime: depTime1,
    arrivalDateTime: arrTime1,
    availableSeats: 30,
    price: 1000,
    status: 'active',
    tripStatus: 'scheduled'
  });

  if (!result1.success) {
    console.log("Failed to create first schedule (maybe it conflicted with something already there?):", result1.error);
    // Continue anyway to try the logic
  } else {
    console.log("Successfully created schedule.");
  }

  // Now try to create a conflicting schedule at 12:15 (within 30m buffer)
  const depTime2 = new Date(tomorrow);
  depTime2.setHours(12, 15, 0, 0);
  const arrTime2 = new Date(tomorrow);
  arrTime2.setHours(14, 0, 0, 0);

  console.log(`\n2. Testing 30m buffer conflict (single schedule)...`);
  console.log(`Creating schedule from 12:15 to 14:00 (Buffer overlap)`);
  
  let result2 = await createSchedule({
    id: "test-schedule-2",
    companyId,
    busId,
    routeId,
    departureDateTime: depTime2,
    arrivalDateTime: arrTime2,
    availableSeats: 30,
    price: 1000,
    status: 'active',
    tripStatus: 'scheduled'
  });

  if (!result2.success) {
    console.log("EXPECTED BEHAVIOR - Error thrown:", result2.error);
  } else {
    console.log("ERROR - Schedule was created despite 30m buffer overlap!");
  }

  // Let's create a blueprint that conflicts with itself
  // 1. 08:00 to 10:00
  // 2. 09:00 to 11:00 (overlap)
  console.log(`\n3. Testing recurring schedule materialization self-conflict...`);
  await prisma.scheduleTemplate.createMany({
    data: [
      {
        companyId, routeId, busId,
        departureTime: '08:00',
        arrivalTime: '10:00',
        daysOfWeek: [new Date().getUTCDay()],
        price: 1000,
        isActive: true,
      },
      {
        companyId, routeId, busId,
        departureTime: '09:00',
        arrivalTime: '11:00',
        daysOfWeek: [new Date().getUTCDay()],
        price: 1000,
        isActive: true,
      }
    ]
  });

  let result3 = await materializeSchedules(companyId, routeId, 0);
  if (!result3.success) {
    console.log("EXPECTED BEHAVIOR - Batch materialization aborted:", result3.error);
  } else {
    console.log("ERROR - Batch materialization succeeded despite internal conflict!");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
