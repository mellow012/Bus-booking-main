import "dotenv/config";
import prisma from "./src/lib/prisma";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== EXECUTING TEST DATA CLEANUP ===\n");

  const TEST_COMPANY_ID = "a0000000-0000-4000-8000-000000000001";

  // Step 1: Verification
  console.log("Verifying pre-cleanup counts...");
  const preTestUsers = await prisma.user.findMany({
    where: { email: { contains: "test.local" } },
    select: { id: true, email: true },
  });
  
  const testUserIds = preTestUsers.map((u) => u.id);
  
  const preNotifications = testUserIds.length > 0 
    ? await prisma.notification.count({ where: { userId: { in: testUserIds } } })
    : 0;
    
  const preBusCount = await prisma.bus.count({
    where: { companyId: TEST_COMPANY_ID },
  });
  
  const preCompanyCount = await prisma.company.count({
    where: { id: TEST_COMPANY_ID },
  });

  console.log(`Pre-verification:`);
  console.log(`- Test Users: ${preTestUsers.length}`);
  console.log(`- Notifications: ${preNotifications}`);
  console.log(`- Buses for test company: ${preBusCount}`);
  console.log(`- Test Company: ${preCompanyCount}`);

  if (
    preTestUsers.length !== 40 ||
    preNotifications !== 12 ||
    preBusCount !== 1 ||
    preCompanyCount !== 1
  ) {
    console.error("❌ ABORTING: Row counts do not match prior investigation (Expected 40 users, 12 notifications, 1 bus, 1 company).");
    process.exit(1);
  }
  
  console.log("✅ Verification passed. Starting transaction...\n");

  // Step 2: DB Transaction
  let deletedNotifications = 0;
  let deletedUsers = 0;
  let deletedBuses = 0;
  let deletedCompanies = 0;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete notifications
      const nDelete = await tx.notification.deleteMany({
        where: { userId: { in: testUserIds } },
      });
      deletedNotifications = nDelete.count;

      // 2. Delete test users
      const uDelete = await tx.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
      deletedUsers = uDelete.count;

      // 3. Delete the 1 Bus
      const bDelete = await tx.bus.deleteMany({
        where: { companyId: TEST_COMPANY_ID },
      });
      deletedBuses = bDelete.count;

      // 4. Delete the Company
      const cDelete = await tx.company.deleteMany({
        where: { id: TEST_COMPANY_ID },
      });
      deletedCompanies = cDelete.count;

      return {
        notifications: deletedNotifications,
        users: deletedUsers,
        buses: deletedBuses,
        companies: deletedCompanies,
      };
    });

    console.log("✅ Prisma transaction committed successfully.");
    console.log(`Rows deleted:`);
    console.log(`- Notifications: ${result.notifications}`);
    console.log(`- Users: ${result.users}`);
    console.log(`- Buses: ${result.buses}`);
    console.log(`- Companies: ${result.companies}\n`);
  } catch (error) {
    console.error("❌ Transaction failed and was rolled back:", error);
    process.exit(1);
  }

  // Step 3: Delete Supabase Auth users
  console.log("Starting Supabase Auth cleanup...");
  let authDeletedCount = 0;
  for (const uid of testUserIds) {
    const { error } = await supabase.auth.admin.deleteUser(uid);
    if (error) {
      console.warn(`Failed to delete Supabase auth user ${uid}:`, error.message);
    } else {
      authDeletedCount++;
    }
  }
  console.log(`✅ Supabase Auth entries removed: ${authDeletedCount} / ${preTestUsers.length}`);

  console.log("\n=== CLEANUP COMPLETE ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
