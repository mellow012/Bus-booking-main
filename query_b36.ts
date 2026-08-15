import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { prisma } from './src/lib/prisma.js';

async function main() {
  const booking = await prisma.booking.findFirst({
    where: { bookingReference: 'BK-JRXA98' },
    include: { chatterSchedule: true, schedule: true }
  });
  console.log(JSON.stringify(booking, null, 2));
}

main().catch(console.error);
