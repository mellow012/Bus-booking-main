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
  const count = await prisma.schedule.count({
    where: {
      status: 'active',
      availableSeats: { gt: 0 },
      company: { status: 'active' }
    }
  });
  console.log(`Active schedules count: ${count}`);

  const schedules = await prisma.schedule.findMany({
    where: {
      status: 'active',
      availableSeats: { gt: 0 },
      company: { status: 'active' }
    },
    include: {
      route: true,
      company: true
    },
    take: 5
  });

  console.log('Sample schedules:', JSON.stringify(schedules, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
