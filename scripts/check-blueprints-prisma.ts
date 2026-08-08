import { prisma } from '../src/lib/prisma';
import { parseUtcDate } from '../src/lib/timezone';

async function main() {
  const templates = await prisma.scheduleTemplate.findMany({
    include: { route: true }
  });

  console.log(`Found ${templates.length} blueprints across all routes.`);

  const now = new Date();

  for (const template of templates) {
    if (!template.isActive) continue;

    const schedules = await prisma.schedule.findMany({
      where: {
        routeId: template.routeId,
        departureDateTime: { gt: now }
      },
      orderBy: { departureDateTime: 'asc' }
    });

    if (schedules.length === 0) {
      console.log(`\n⚠️ Route: ${template.route.name || template.route.origin + '->' + template.route.destination} has 0 upcoming schedules! (Template ID: ${template.id})`);
    } else {
      console.log(`✅ Route: ${template.route.name || template.route.origin + '->' + template.route.destination} has ${schedules.length} upcoming schedules. Next at: ${schedules[0].departureDateTime}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
