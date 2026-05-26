import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

async function main() {
  console.log('✅ Verifying Database Setup...\n');

  try {
    // Check Operators
    const operators = await prisma.operator.findMany();
    console.log(`📋 Operators Count: ${operators.length}`);
    operators.forEach((op: any) => {
      console.log(`   - ${op.name} (${op.role}) - ${op.email}`);
    });

    // Check Companies
    const companies = await prisma.company.findMany();
    console.log(`\n🏢 Companies Count: ${companies.length}`);
    companies.forEach((co: any) => {
      console.log(`   - ${co.name}`);
    });

    // Check Routes
    const routes = await prisma.route.findMany();
    console.log(`\n🛣️  Routes Count: ${routes.length}`);

    // Check Schedules
    const schedules = await prisma.schedule.findMany();
    console.log(`\n🚌 Schedules Count: ${schedules.length}`);

    // Check if operators are linked to schedules
    const schedulesWithOperators = await prisma.schedule.findMany({
      where: { operatorId: { not: null } },
      include: { operator: true }
    });
    console.log(`\n✨ Schedules with Assigned Operators: ${schedulesWithOperators.length}`);
    if (schedulesWithOperators.length > 0) {
      console.log(`   - Example: ${(schedulesWithOperators[0] as any).operator?.name} assigned to schedule`);
    }

    console.log('\n✅ Database setup verified successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
