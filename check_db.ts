import prisma from './src/lib/prisma';
async function run() {
  const schedules = await prisma.chatterSchedule.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('Recent Chatter Schedules:');
  schedules.forEach(s => {
    console.log('- ID:', s.id);
    console.log('  travelDate:', s.travelDate, '| typeof:', typeof s.travelDate);
    console.log('  createdAt:', s.createdAt);
    console.log('---');
  });
}
run().catch(console.error).finally(() => prisma.$disconnect());