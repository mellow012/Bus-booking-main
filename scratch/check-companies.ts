import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, isPartner: true, bookingEnabled: true },
    orderBy: { name: 'asc' }
  });
  console.log("Companies:", JSON.stringify(companies, null, 2));
}

main().finally(() => prisma.$disconnect());
