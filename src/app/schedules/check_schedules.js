
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const schedules = await prisma.schedule.findMany({
    include: {
      route: true,
      bus: true,
      company: true
    }
  });
  console.log('Total schedules:', schedules.length);
  schedules.forEach(s => {
    console.log(`ID: ${s.id}, Date: ${s.departureDateTime}, Status: ${s.status}, Origin: ${s.route.origin}, Destination: ${s.route.destination}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
