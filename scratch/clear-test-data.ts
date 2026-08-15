import "dotenv/config";
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log("Cleaning up database test data...");

  // Delete seat reservations
  const resDel = await prisma.seatReservation.deleteMany({});
  console.log(`Deleted ${resDel.count} seat reservations.`);

  // Delete booking segments first
  const segDel = await prisma.bookingSegment.deleteMany({});
  console.log(`Deleted ${segDel.count} booking segments.`);

  // Delete bookings
  const bookDel = await prisma.booking.deleteMany({});
  console.log(`Deleted ${bookDel.count} bookings.`);

  // Delete trip position samples
  const posDel = await prisma.tripPositionSample.deleteMany({});
  console.log(`Deleted ${posDel.count} trip position samples.`);

  // Delete newsletter subscribers
  const subDel = await prisma.newsletterSubscriber.deleteMany({});
  console.log(`Deleted ${subDel.count} newsletter subscribers.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
