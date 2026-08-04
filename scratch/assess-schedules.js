require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
  console.log('Zero seats (unbookable):', upcoming.filter(s => s.availableSeats === 0).length);
  console.log('Zero price:', upcoming.filter(s => s.price === 0).length);

  const hourCounts = {};
  upcoming.forEach(s => {
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
  upcoming.slice(0, 10).forEach(s => {
    const dep = new Date(s.departureDateTime);
    const catFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Blantyre', hour: '2-digit', minute: '2-digit',
      day: '2-digit', month: 'short'
    }).format(dep);
    const flags = [];
    if (s.availableSeats === 0) flags.push('ZERO_SEATS');
    if (s.price === 0) flags.push('ZERO_PRICE');
    console.log(` ${dep.toISOString()} = ${catFmt} CAT | ${s.route && s.route.origin} -> ${s.route && s.route.destination} | seats:${s.availableSeats} price:${s.price} ${flags.join(' ')}`);
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e.message); process.exit(1); });
