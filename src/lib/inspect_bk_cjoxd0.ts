import { prisma } from './prisma';

async function main() {
  console.log('Inspecting BK-CJOXD0 or any delayed bookings in DB...');

  const booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { bookingReference: { contains: 'CJOXD0', mode: 'insensitive' } },
        { id: { contains: 'CJOXD0', mode: 'insensitive' } },
      ],
    },
    include: {
      schedule: true,
      segments: {
        include: { schedule: true },
      },
    },
  });

  if (!booking) {
    console.log('Booking BK-CJOXD0 not found! Listing all confirmed/paid bookings:');
    const all = await prisma.booking.findMany({
      take: 10,
      include: { schedule: true },
      orderBy: { createdAt: 'desc' },
    });
    for (const b of all) {
      console.log(`- Ref: ${b.bookingReference}, id: ${b.id}, bookingStatus: ${b.bookingStatus}, paymentStatus: ${b.paymentStatus}, schedule.tripStatus: ${b.schedule?.tripStatus}, dep: ${b.schedule?.departureDateTime}, arr: ${b.schedule?.arrivalDateTime}`);
    }
    return;
  }

  console.log('--- FOUND BOOKING ---');
  console.log('Booking ID:', booking.id);
  console.log('Reference:', booking.bookingReference);
  console.log('Booking Status:', booking.bookingStatus);
  console.log('Payment Status:', booking.paymentStatus);
  console.log('Payment Method:', (booking as any).paymentMethod);
  console.log('Schedule ID:', booking.scheduleId);
  console.log('Schedule tripStatus:', booking.schedule?.tripStatus);
  console.log('Schedule departureDateTime:', booking.schedule?.departureDateTime, typeof booking.schedule?.departureDateTime);
  console.log('Schedule arrivalDateTime:', booking.schedule?.arrivalDateTime, typeof booking.schedule?.arrivalDateTime);
  console.log('Segments count:', booking.segments?.length);
  if (booking.segments?.length) {
    for (const s of booking.segments) {
      console.log(' Segment schedule tripStatus:', s.schedule?.tripStatus, 'dep:', s.schedule?.departureDateTime, 'arr:', s.schedule?.arrivalDateTime);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
