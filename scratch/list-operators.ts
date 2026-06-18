import { config } from 'dotenv';
config();
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const operators = await prisma.operator.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      companyName: true,
      status: true,
      createdAt: true,
    },
    orderBy: {
      companyName: 'asc',
    },
  });

  console.log(JSON.stringify(operators, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
