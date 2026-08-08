import { prisma } from '../src/lib/prisma';
import { deleteSchedule } from '../src/lib/actions/schedule.actions';

async function testDelete() {
  console.log('Testing delete action...');
  
  // Find a company and route
  const company = await prisma.company.findFirst();
  const route = await prisma.route.findFirst({ where: { companyId: company?.id } });
  const bus = await prisma.bus.findFirst({ where: { companyId: company?.id } });

  if (!company || !route || !bus) {
    console.log('Missing basic data to run test.');
    return;
  }

  // 1. Create a dummy schedule with NO bookings
  const schedule = await prisma.schedule.create({
    data: {
      companyId: company.id,
      routeId: route.id,
      busId: bus.id,
      departureDateTime: new Date(Date.now() + 86400000),
      arrivalDateTime: new Date(Date.now() + 90000000),
      price: 15000,
      availableSeats: 45,
      status: 'active',
      tripStatus: 'scheduled'
    }
  });

  console.log(`Created dummy schedule ${schedule.id}`);
  
  // 2. Try to delete it (should succeed)
  let res = await deleteSchedule(schedule.id);
  console.log('Delete empty schedule result:', res);

  // 3. Find a schedule that HAS bookings
  const bookedSchedule = await prisma.schedule.findFirst({
    where: {
      bookings: { some: {} }
    }
  });

  if (bookedSchedule) {
    console.log(`Found booked schedule ${bookedSchedule.id}`);
    res = await deleteSchedule(bookedSchedule.id);
    console.log('Delete booked schedule result:', res);
  } else {
    console.log('No booked schedule found to test the block condition.');
  }
}

testDelete().catch(console.error).finally(() => prisma.$disconnect());
