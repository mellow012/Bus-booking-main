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
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  console.log(`Total companies: ${companies.length}`);
  console.log(JSON.stringify(companies, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
