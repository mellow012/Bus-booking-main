import { config } from "dotenv";
config();
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== Active Companies ===");
  const companies = await prisma.company.findMany({
    include: {
      regions: true,
      routes: true,
      buses: true,
    }
  });

  for (const c of companies) {
    console.log(`- Company: ${c.name} (ID: ${c.id})`);
    console.log(`  Status: ${c.status}`);
    console.log(`  Regions: ${c.regions.map(r => r.name).join(", ") || "None"}`);
    console.log(`  Routes: ${c.routes.map(r => `${r.origin} -> ${r.destination}`).join(", ") || "None"}`);
    console.log(`  Buses: ${c.buses.map(b => b.licensePlate).join(", ") || "None"}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
