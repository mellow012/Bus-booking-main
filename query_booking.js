const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const b = await prisma.booking.findUnique({
    where: { bookingReference: 'BK-LRVTNE' },
    include: { chatterSchedule: true }
  });
  console.log(JSON.stringify(b, null, 2));
}
main().finally(() => prisma.$disconnect());
