import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Updating unpartnered buses and schedules to 56 seats...");

  const unpartnered = await prisma.company.findMany({
    where: {
      isPartner: false,
      NOT: { name: { in: ["Dzuka Go", "Mellow Tours"] } }
    },
    select: { id: true, name: true }
  });

  const ids = unpartnered.map(c => c.id);

  const busRes = await prisma.bus.updateMany({
    where: { companyId: { in: ids } },
    data: { capacity: 56 }
  });

  const schRes = await prisma.schedule.updateMany({
    where: { companyId: { in: ids } },
    data: { availableSeats: 56 }
  });

  console.log(`✅ Updated ${busRes.count} buses to capacity: 56.`);
  console.log(`✅ Updated ${schRes.count} schedules to availableSeats: 56.`);
}

main().finally(() => prisma.$disconnect());
