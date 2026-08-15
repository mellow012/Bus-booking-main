import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const b = await prisma.booking.findFirst({
    where: { bookingReference: 'BK-EDLLQ9' },
    include: {
      chatterSchedule: true,
    }
  });
  console.log(JSON.stringify(b?.chatterSchedule, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
