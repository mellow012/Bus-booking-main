import "dotenv/config";
import { prisma } from '../src/lib/prisma';

async function main() {
  const subscribers = await prisma.newsletterSubscriber.findMany();
  console.log(`--- Newsletter Subscribers (${subscribers.length}) ---`);
  subscribers.forEach((s: any) => console.log(`- ID: ${s.id}, Email: ${s.email}, Created: ${s.createdAt}`));

  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(`\n--- Bookings (Total: ${await prisma.booking.count()}, showing last 10) ---`);
  bookings.forEach((b: any) => console.log(`- Ref: ${b.bookingReference}, Status: ${b.bookingStatus}, Payment: ${b.paymentStatus}, Created: ${b.createdAt}`));

  const reservations = await prisma.seatReservation.findMany({
    take: 10
  });
  console.log(`\n--- Seat Reservations (Total: ${await prisma.seatReservation.count()}) ---`);
  reservations.forEach((r: any) => console.log(`- ID: ${r.id}, Seats: ${JSON.stringify(r.seatNumbers)}, Status: ${r.status}, Expires: ${r.expiresAt}`));
  
  await prisma.$disconnect();
}

main().catch(console.error);
