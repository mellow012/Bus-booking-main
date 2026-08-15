// scratch/check-schedule.mjs
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const s = await p.schedule.findFirst({
  select: { id: true, price: true, route: { select: { origin: true, destination: true } } },
  orderBy: { departureDateTime: 'desc' }
});
console.log(JSON.stringify(s, null, 2));
await p.$disconnect();
