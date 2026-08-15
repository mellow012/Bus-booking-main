import { config } from "dotenv";
config();
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== Regions and Operators ===");
  const regions = await prisma.region.findMany({
    include: {
      operators: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          uid: true,
        }
      }
    }
  });

  for (const r of regions) {
    console.log(`Region: ${r.name} (Code: ${r.code}, ID: ${r.id})`);
    if (r.operators.length === 0) {
      console.log("  No operators assigned.");
    }
    for (const op of r.operators) {
      // Find matching user to see if they have phone
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: op.email },
            { uid: op.uid }
          ]
        },
        select: {
          phone: true,
        }
      });
      console.log(`  - Operator: ${op.name} (${op.email})`);
      console.log(`    Role: ${op.role}, Status: ${op.status}`);
      console.log(`    User Phone: ${user?.phone || "None"}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
