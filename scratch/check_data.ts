import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking database...');
  try {
    const companies = await prisma.company.findMany({ select: { id: true, name: true, status: true } });
    console.log(`Found ${companies.length} companies:`, companies);

    const schedules = await prisma.schedule.findMany({ 
      take: 5,
      include: {
        company: true,
        route: true
      }
    });
    console.log(`Found ${schedules.length} schedules (sample):`);
    schedules.forEach(s => {
      console.log(`ID: ${s.id}, Company: ${s.company.name} (${s.company.status}), Status: ${s.status}, Date: ${s.departureDateTime}`);
    });

    const activeSchedules = await prisma.schedule.count({
      where: {
        status: 'active',
        company: { status: 'active' }
      }
    });
    console.log(`Total Active Schedules with Active Companies: ${activeSchedules}`);

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
