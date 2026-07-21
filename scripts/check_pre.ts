import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPrerequisites() {
  const companies = await prisma.company.findMany();
  const buses = await prisma.bus.findMany();
  const routes = await prisma.route.findMany();
  
  console.log('--- Database Status ---');
  console.log(`Companies: ${companies.length}`);
  console.log(`Buses: ${buses.length}`);
  console.log(`Routes: ${routes.length}`);
  
  if (companies.length > 0) {
    console.log('Company IDs:', companies.map(c => c.id));
  }
  if (buses.length > 0) {
    console.log('Bus IDs:', buses.map(b => b.id));
  }
  if (routes.length > 0) {
    console.log('Route IDs:', routes.map(r => r.id));
  }
}

checkPrerequisites()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
