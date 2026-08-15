require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, fcmTokens: true }
  });
  console.log('--- User tokens list ---');
  for (const u of users) {
    console.log(`User ID: ${u.id}`);
    console.log(`Email: ${u.email}`);
    console.log(`Role: ${u.role}`);
    console.log(`Tokens count/type:`, Array.isArray(u.fcmTokens) ? `${u.fcmTokens.length} items` : typeof u.fcmTokens);
    if (Array.isArray(u.fcmTokens) && u.fcmTokens.length > 0) {
      console.log(`First item:`, JSON.stringify(u.fcmTokens[0]).slice(0, 150) + '...');
    }
    console.log('------------------------');
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
