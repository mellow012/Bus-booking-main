import { config } from 'dotenv';
config();
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting DB Cleanup...");

  const allowedNames = [
    'Kwezy Bus Company', 'Sososo Coaches', 'AXA Coach Service', 'Muchawi Coaches', 'Tam Tam Coaches', 'Falls Coaches', 'Karonga Express', 'Northern Express', 'Horizon Coaches', 'Matours Bus Service', 'Transmo', 'Malawi Post Coaches', 'Falcon Express', 'Kwacha Coaches', 'Zomba Liners', 'Shire Valley Transporters', 'Lake-Shore Liners', 'Nkhotakota Express', 'Kasungu Central', 'Dedza Commuters', 'Mchinji Shuttles', 'Rumphi Star', 'Sangano Coaches', 'Ulemu Bus Service', 'United Bus (UBZ)', 'Jobela Star Links', 'Rimbi Tours', 'Citiliner Plus', 'Inter-Cape Linkages', 'Chikhwawa International', 'Mukumba Travel', 'Falcon Cross-Border',
    'Mellow Tours', 'BlessingsTours'
  ];

  const companiesToDelete = await prisma.company.findMany({
    where: {
      name: {
        notIn: allowedNames,
      },
    },
  });

  console.log(`Found ${companiesToDelete.length} companies to delete:`);
  for (const c of companiesToDelete) {
    console.log(`- ${c.name} (${c.id})`);
  }

  const idsToDelete = companiesToDelete.map(c => c.id);

  if (idsToDelete.length > 0) {
    // 1. Delete associated SeatReservations
    const deletedReservations = await prisma.seatReservation.deleteMany({
      where: {
        schedule: {
          companyId: { in: idsToDelete }
        }
      }
    });
    console.log(`Deleted ${deletedReservations.count} seat reservations.`);

    // 2. Delete Bookings
    const deletedBookings = await prisma.booking.deleteMany({
      where: {
        companyId: { in: idsToDelete }
      }
    });
    console.log(`Deleted ${deletedBookings.count} bookings.`);

    // 3. Delete DailyReports
    const deletedReports = await prisma.dailyReport.deleteMany({
      where: {
        companyId: { in: idsToDelete }
      }
    });
    console.log(`Deleted ${deletedReports.count} daily reports.`);

    // 4. Delete ActivityLogs
    const deletedLogs = await prisma.activityLog.deleteMany({
      where: {
        companyId: { in: idsToDelete }
      }
    });
    console.log(`Deleted ${deletedLogs.count} activity logs.`);

    // 5. Delete GroupRequests
    const deletedGroupRequests = await prisma.groupRequest.deleteMany({
      where: {
        companyId: { in: idsToDelete }
      }
    });
    console.log(`Deleted ${deletedGroupRequests.count} group requests.`);

    // 6. Delete GroupCharterQuotes
    const deletedQuotes = await prisma.groupCharterQuote.deleteMany({
      where: {
        companyId: { in: idsToDelete }
      }
    });
    console.log(`Deleted ${deletedQuotes.count} charter quotes.`);

    // 7. Delete Schedules
    const deletedSchedules = await prisma.schedule.deleteMany({
      where: {
        companyId: { in: idsToDelete }
      }
    });
    console.log(`Deleted ${deletedSchedules.count} schedules.`);

    // 8. Delete ScheduleTemplates
    const deletedTemplates = await prisma.scheduleTemplate.deleteMany({
      where: {
        companyId: { in: idsToDelete }
      }
    });
    console.log(`Deleted ${deletedTemplates.count} schedule templates.`);

    // 9. Delete Routes
    const deletedRoutes = await prisma.route.deleteMany({
      where: {
        companyId: { in: idsToDelete }
      }
    });
    console.log(`Deleted ${deletedRoutes.count} routes.`);

    // 10. Delete Buses
    const deletedBuses = await prisma.bus.deleteMany({
      where: {
        companyId: { in: idsToDelete }
      }
    });
    console.log(`Deleted ${deletedBuses.count} buses.`);

    // 11. Delete Operators
    const deletedOperators = await prisma.operator.deleteMany({
      where: {
        companyId: { in: idsToDelete }
      }
    });
    console.log(`Deleted ${deletedOperators.count} operators.`);

    // 12. Delete Companies
    const deletedCompanies = await prisma.company.deleteMany({
      where: {
        id: { in: idsToDelete }
      }
    });
    console.log(`Deleted ${deletedCompanies.count} companies.`);
  }

  console.log("Cleanup finished!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
