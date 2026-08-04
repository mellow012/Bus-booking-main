import { prisma } from '../src/lib/prisma';

async function main() {
  const result = await prisma.tripPositionSample.deleteMany({});
  console.log(`Deleted ${result.count} stale demo position samples.`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
