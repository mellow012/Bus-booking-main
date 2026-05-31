const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- DB Simulation ---');
  
  // Search for the specific user by email
  const byEmail = await prisma.user.findMany({
    where: { email: 'booknpaymw012@gmail.com' }
  });
  console.log('byEmail:', JSON.stringify(byEmail, null, 2));

  // Simulating the complete-setup check
  for (const user of byEmail) {
    console.log(`Checking user ID: ${user.id}, UID: ${user.uid}`);
    // Search by both
    const resolvedUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: user.id },
          { uid: user.id }
        ]
      }
    });
    console.log(`OR check result for user.id (${user.id}):`, resolvedUser ? `FOUND (id: ${resolvedUser.id}, uid: ${resolvedUser.uid})` : 'NOT FOUND');
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
