import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const result = await prisma.tripPositionSample.deleteMany({});
console.log(`Deleted ${result.count} stale demo position samples.`);
await prisma.$disconnect();
