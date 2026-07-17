import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const total = await prisma.schedule.count();
  console.log('Total schedules:', total);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const future = await prisma.schedule.count({
    where: {
      departureDateTime: { gte: tomorrow }
    }
  });
  console.log('Schedules from tomorrow onwards:', future);

  const active = await prisma.schedule.count({
    where: {
      status: 'active',
      company: { status: 'active' }
    }
  });
  console.log('Active schedules with active companies:', active);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
