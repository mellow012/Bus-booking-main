const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const schedules = await prisma.schedule.findMany({ include: { route: true } });
  console.log(schedules.map(s => ({
    id: s.id,
    origin: s.route?.origin,
    dest: s.route?.destination,
    dep: s.departureDateTime,
    arr: s.arrivalDateTime
  })));
}
main().finally(() => prisma.$disconnect());
