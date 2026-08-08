import { prisma } from './src/lib/prisma';

async function main() {
  const schedules = await prisma.schedule.findMany({
    where: {
      status: { notIn: ['cancelled', 'archived'] },
      isActive: true,
    },
    include: {
      bus: true,
      route: true,
    },
    orderBy: {
      departureDateTime: 'asc',
    },
  });

  const busSchedules: Record<string, any[]> = {};
  for (const s of schedules) {
    if (!busSchedules[s.busId]) busSchedules[s.busId] = [];
    busSchedules[s.busId].push(s);
  }

  let conflictsFound = 0;
  for (const busId in busSchedules) {
    const sList = busSchedules[busId];
    for (let i = 0; i < sList.length - 1; i++) {
      const current = sList[i];
      const next = sList[i + 1];
      
      const currentArr = new Date(current.arrivalDateTime).getTime();
      const nextDep = new Date(next.departureDateTime).getTime();
      const turnaroundMs = nextDep - currentArr;
      
      // If turnaround is less than 30 mins (1800000 ms) or negative (overlap)
      if (turnaroundMs < 30 * 60 * 1000) {
        console.log(`Conflict found! Bus Plate: ${current.bus.licensePlate}`);
        console.log(`Route 1: ${current.route.origin} to ${current.route.destination}`);
        console.log(`  Dep: ${current.departureDateTime}, Arr: ${current.arrivalDateTime}`);
        console.log(`Route 2: ${next.route.origin} to ${next.route.destination}`);
        console.log(`  Dep: ${next.departureDateTime}, Arr: ${next.arrivalDateTime}`);
        console.log(`Turnaround time: ${turnaroundMs / 60000} minutes`);
        console.log('---');
        conflictsFound++;
        if (conflictsFound > 5) return;
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
