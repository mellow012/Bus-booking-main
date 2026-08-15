import { prisma } from './src/lib/prisma';
async function main() {
  const s = await prisma.chatterSchedule.findUnique({
    where: { id: '0f75b783-4d98-4401-83a9-e6f04bb05271' }
  });
  console.log('schedule', s);
  console.log('travelDate', s.travelDate);
  console.log('typeof', typeof s.travelDate);
  console.log('instanceof Date', s.travelDate instanceof Date);
  if (s.travelDate instanceof Date) {
    console.log('isNaN', isNaN(s.travelDate.getTime()));
    console.log('iso', s.travelDate.toISOString());
  }
}
main().finally(() => prisma.$disconnect());
