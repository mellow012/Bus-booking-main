import 'dotenv/config';
import { prisma } from './src/lib/prisma';



async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Please provide the email address to delete. Example: npx tsx delete-user.ts test@example.com');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User with email ${email} not found in the database.`);
    process.exit(1);
  }

  console.log(`Found user ${user.id}. Deleting related records...`);

  try {
    await prisma.$transaction([
      prisma.activityLog.deleteMany({ where: { userId: user.id } }),
      prisma.notification.deleteMany({ where: { userId: user.id } }),
      prisma.booking.deleteMany({ where: { userId: user.id } }),
      prisma.groupRequest.deleteMany({ where: { userId: user.id } }),
      prisma.groupCharterRequest.deleteMany({ where: { userId: user.id } }),
      prisma.seatReservation.deleteMany({ where: { userId: user.id } }),
      prisma.chatMessage.deleteMany({ where: { senderId: user.id } }),
      // Finally, delete the user
      prisma.user.delete({ where: { id: user.id } })
    ]);
    console.log(`Successfully deleted user ${email} and all related records.`);
  } catch (error) {
    console.error('Error deleting user:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
