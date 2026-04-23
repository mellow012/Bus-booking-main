require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

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
    console.log('Sample Company:', companies[0].name, companies[0].id);
  }
}

checkPrerequisites()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
