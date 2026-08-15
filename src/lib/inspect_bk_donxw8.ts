import prisma from './prisma';

async function run() {
  const booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { bookingReference: 'BK-DONXW8' },
        { id: { endsWith: 'BK-DONXW8' } },
        { id: 'BK-DONXW8' }
      ]
    },
    include: {
      chatterSchedule: true,
      schedule: {
        include: {
          bus: true,
          company: true,
          route: true
        }
      }
    }
  });

  if (!booking) {
    // If exact reference not matched, list last 3 bookings
    const recent = await prisma.booking.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: { chatterSchedule: true }
    });
    console.log('RECORDS FOUND INSTEAD:', JSON.stringify(recent, null, 2));
    return;
  }

  console.log('BOOKING RAW:', JSON.stringify(booking, null, 2));
}

run();
