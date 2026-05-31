import { config } from 'dotenv';
config();
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting DB deduplication cleanup...');
  const schedules = await prisma.schedule.findMany({
    orderBy: { createdAt: 'asc' }
  });

  const seen = new Set<string>();
  let deletedCount = 0;
  let skippedCount = 0;

  for (const s of schedules) {
    const depStr = s.departureDateTime.toISOString();
    const key = `${s.companyId}-${s.routeId}-${depStr}`;
    if (seen.has(key)) {
      try {
        await prisma.schedule.delete({ where: { id: s.id } });
        deletedCount++;
      } catch (err) {
        skippedCount++;
      }
    } else {
      seen.add(key);
    }
  }

  console.log(`Cleaned up ${deletedCount} duplicate schedules! Skipped ${skippedCount} booked ones.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
