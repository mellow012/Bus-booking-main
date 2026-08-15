import { prisma } from './src/lib/prisma';

async function main() {
  const booking = await prisma.booking.findUnique({
    where: { bookingReference: 'BK-A69HAY' },
    include: { chatterSchedule: true }
  });
  console.log(JSON.stringify(booking, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
