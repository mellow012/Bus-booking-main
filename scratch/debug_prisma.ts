
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  try {
    const res = await prisma.schedule.findMany({
      where: {
        status: 'active',
        availableSeats: { gt: 0 },
        company: { status: 'active' },
        route: { isActive: true }
      },
      include: {
        route: true,
        bus: { include: { company: true } },
        company: true,
      },
      take: 5
    });
    console.log('Query success, count:', res.length);
  } catch (e) {
    console.error('Query failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
