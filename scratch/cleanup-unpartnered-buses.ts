import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🧹 Starting cleanup of seeded unpartnered buses & schedules...");

  // 1. Identify unpartnered companies (excluding Dzuka Go and Mellow Tours)
  const unpartneredCompanies = await prisma.company.findMany({
    where: {
      isPartner: false,
      NOT: {
        name: { in: ["Dzuka Go", "Mellow Tours"] }
      }
    },
    select: { id: true, name: true }
  });

  console.log(`Found ${unpartneredCompanies.length} unpartnered companies.`);
  const unpartneredCompanyIds = unpartneredCompanies.map(c => c.id);

  // 2. Update Buses for unpartnered companies:
  // - amenities = []
  // - licensePlate = "Unassigned"
  // - capacity = 0
  // - busType = "Standard"
  const busUpdate = await prisma.bus.updateMany({
    where: {
      companyId: { in: unpartneredCompanyIds }
    },
    data: {
      amenities: [],
      licensePlate: "Unassigned",
      busType: "Standard",
      capacity: 0,
    }
  });

  console.log(`✅ Updated ${busUpdate.count} buses for unpartnered companies (amenities: [], plate: Unassigned, capacity: 0).`);

  // 3. Update Schedules for unpartnered companies:
  // - availableSeats = 0
  const scheduleUpdate = await prisma.schedule.updateMany({
    where: {
      companyId: { in: unpartneredCompanyIds }
    },
    data: {
      availableSeats: 0
    }
  });

  console.log(`✅ Updated ${scheduleUpdate.count} schedules for unpartnered companies (availableSeats: 0).`);

  // 4. Verify Dzuka Go and Mellow Tours are intact
  const partners = await prisma.company.findMany({
    where: {
      name: { in: ["Dzuka Go", "Mellow Tours"] }
    },
    include: {
      buses: true,
      _count: { select: { schedules: true } }
    }
  });

  console.log("🔒 Partnered Companies (Untouched Verification):");
  for (const p of partners) {
    console.log(`  - ${p.name}: ${p.buses.length} buses, ${p._count.schedules} schedules (isPartner: ${p.isPartner}, bookingEnabled: ${p.bookingEnabled})`);
  }

  console.log("🎉 Cleanup complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
