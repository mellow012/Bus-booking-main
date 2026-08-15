import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.ltypsfmlloiouzwhbwcj:Quantumbyteslab%4099@aws-1-eu-central-2.pooler.supabase.com:5432/postgres?connect_timeout=600',
    },
  },
});

async function main() {
  const booking = await prisma.booking.findFirst({
    where: { bookingReference: 'BK-KJEYIX' },
    include: { chatterSchedule: true },
  });

  if (!booking) { console.log('Booking not found'); return; }

  const s = booking.chatterSchedule;
  console.log('=== BOOKING ===');
  console.log('bookingReference:', booking.bookingReference);
  console.log('chatterScheduleId:', booking.chatterScheduleId);
  console.log('metadata:', JSON.stringify(booking.metadata, null, 2));
  console.log('');
  console.log('=== CHATTER SCHEDULE ===');
  if (!s) { console.log('No chatterSchedule found'); }
  else {
    console.log('busName:', s.busName);
    console.log('travelDate (raw):', s.travelDate);
    console.log('travelDate (ISO):', s.travelDate instanceof Date ? s.travelDate.toISOString() : String(s.travelDate));
    console.log('origin:', s.origin);
    console.log('destination:', s.destination);
    console.log('contactPhone:', s.contactPhone);
    console.log('pickupPoint:', s.pickupPoint);
    console.log('dropoffPoint:', s.dropoffPoint);
    console.log('notes:', s.notes);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect().then(() => process.exit(0)));
