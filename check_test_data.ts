import 'dotenv/config';
import prisma from './src/lib/prisma';

async function main() {
  console.log("=== TEST DATA INVESTIGATION ===\n");

  // 1. Test users (test.local emails)
  console.log("--- Users with @test.local emails ---");
  const testUsers = await prisma.user.findMany({
    where: { email: { contains: 'test.local' } },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, companyId: true, createdAt: true }
  });
  console.log(`Found ${testUsers.length} test.local users.`);
  for (const u of testUsers.slice(0, 5)) {
    console.log(`  ${u.email} | role: ${u.role} | company: ${u.companyId} | created: ${u.createdAt}`);
  }
  if (testUsers.length > 5) console.log(`  ... and ${testUsers.length - 5} more`);

  // 2. Test companies
  console.log("\n--- Companies with 'test' in name ---");
  const testCompanies = await prisma.company.findMany({
    where: { name: { contains: 'test', mode: 'insensitive' } },
    select: { id: true, name: true, email: true, status: true, createdAt: true }
  });
  console.log(`Found ${testCompanies.length} test companies.`);
  for (const c of testCompanies) {
    console.log(`  "${c.name}" | email: ${c.email} | status: ${c.status} | created: ${c.createdAt}`);
  }

  // 3. FK-linked records for test companies
  for (const c of testCompanies) {
    console.log(`\n--- FK records for company "${c.name}" (${c.id}) ---`);
    const buses = await prisma.bus.count({ where: { companyId: c.id } });
    const routes = await prisma.route.count({ where: { companyId: c.id } });
    const schedules = await prisma.schedule.count({ where: { companyId: c.id } });
    const bookings = await prisma.booking.count({ where: { companyId: c.id } });
    const operators = await prisma.operator.count({ where: { companyId: c.id } });
    const regions = await prisma.region.count({ where: { companyId: c.id } });
    const templates = await prisma.scheduleTemplate.count({ where: { companyId: c.id } });
    const activities = await prisma.activityLog.count({ where: { companyId: c.id } });
    const dailyReports = await prisma.dailyReport.count({ where: { companyId: c.id } });
    const groupRequests = await prisma.groupRequest.count({ where: { companyId: c.id } });
    const conversations = await prisma.conversation.count({ where: { companyId: c.id } });
    const staff = await prisma.user.count({ where: { companyId: c.id } });
    console.log(`  Buses: ${buses}, Routes: ${routes}, Schedules: ${schedules}, Bookings: ${bookings}`);
    console.log(`  Operators: ${operators}, Regions: ${regions}, Templates: ${templates}`);
    console.log(`  Activities: ${activities}, DailyReports: ${dailyReports}, GroupRequests: ${groupRequests}`);
    console.log(`  Conversations: ${conversations}, Staff (Users): ${staff}`);
  }

  // 4. FK-linked records for test users
  console.log("\n--- FK records for test users ---");
  for (const u of testUsers) {
    const bookings = await prisma.booking.count({ where: { userId: u.id } });
    const notifications = await prisma.notification.count({ where: { userId: u.id } });
    const reservations = await prisma.seatReservation.count({ where: { userId: u.id } });
    const activities = await prisma.activityLog.count({ where: { userId: u.id } });
    const charterRequests = await prisma.groupCharterRequest.count({ where: { userId: u.id } });
    const groupRequests = await prisma.groupRequest.count({ where: { userId: u.id } });
    const chatterSchedules = await prisma.chatterSchedule.count({ where: { repUserId: u.id } });
    if (bookings + notifications + reservations + activities + charterRequests + groupRequests + chatterSchedules > 0) {
      console.log(`  ${u.email}: bookings=${bookings}, notifications=${notifications}, reservations=${reservations}, activities=${activities}, charters=${charterRequests}, groups=${groupRequests}, chatterSchedules=${chatterSchedules}`);
    }
  }

  // 5. Other obvious test patterns
  console.log("\n--- Other potential test data patterns ---");
  const dummyEmails = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: '@example.com' } },
        { email: { contains: '@dummy' } },
        { email: { contains: 'test@' } },
      ]
    },
    select: { email: true, role: true, createdAt: true }
  });
  console.log(`Found ${dummyEmails.length} users with @example.com / @dummy / test@ patterns.`);
  for (const d of dummyEmails) {
    console.log(`  ${d.email} | role: ${d.role} | created: ${d.createdAt}`);
  }

  console.log("\n=== INVESTIGATION COMPLETE ===");
}

main().catch(console.error).finally(() => prisma.$disconnect());
