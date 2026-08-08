const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const booking = await prisma.booking.findUnique({
    where: { bookingReference: 'BK-MKL0XN' },
    include: { schedule: true }
  });
  console.log(JSON.stringify(booking, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
