// assess-schedules.ts — run with: npx tsx scratch/assess-schedules.ts
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const now = new Date();
  const upcoming = await prisma.schedule.findMany({
    where: { status: 'active', isActive: true, departureDateTime: { gte: now } },
    select: {
      id: true, departureDateTime: true, availableSeats: true, price: true,
      route: { select: { origin: true, destination: true } }
    },
    orderBy: { departureDateTime: 'asc' },
    take: 200
  });

  console.log('Total upcoming active schedules:', upcoming.length);
  console.log('Zero seats (unbookable):', upcoming.filter((s: any) => s.availableSeats === 0).length);
  console.log('Zero price:', upcoming.filter((s: any) => s.price === 0).length);

  const hourCounts: Record<number, number> = {};
  upcoming.forEach((s: any) => {
    const h = new Date(s.departureDateTime).getUTCHours();
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  });
  console.log('\nUTC hour -> CAT local distribution:');
  Object.entries(hourCounts)
    .sort(([a],[b]) => Number(a) - Number(b))
    .forEach(([h, c]) => {
      const cat = (Number(h) + 2) % 24;
      console.log(`  UTC ${String(h).padStart(2,'0')}h (= ${String(cat).padStart(2,'0')}h CAT): ${c} schedules`);
    });

  console.log('\nFirst 10 schedules:');
  (upcoming as any[]).slice(0, 10).forEach((s: any) => {
    const dep = new Date(s.departureDateTime);
    const catFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Blantyre', hour: '2-digit', minute: '2-digit',
      day: '2-digit', month: 'short', year: 'numeric'
    }).format(dep);
    const flags = [];
    if (s.availableSeats === 0) flags.push('⚠ZERO_SEATS');
    if (s.price === 0) flags.push('⚠ZERO_PRICE');
    console.log(` ${dep.toISOString()} = ${catFmt} CAT | ${s.route?.origin} -> ${s.route?.destination} | seats:${s.availableSeats} price:${s.price} ${flags.join(' ')}`);
  });
}

main()
  .then(() => pool.end())
  .catch(e => { console.error(e.message); process.exit(1); });
