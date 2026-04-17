// scripts/inject-tables.ts
const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();
  console.log('Connected to Supabase...');

  const commands = [
    // 1. Create Payment
    `CREATE TABLE IF NOT EXISTS "Payment" (
      "id" TEXT NOT NULL,
      "paymentId" TEXT NOT NULL,
      "bookingId" TEXT,
      "amount" INTEGER NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'MWK',
      "customerEmail" TEXT,
      "customerPhone" TEXT,
      "checkoutUrl" TEXT,
      "status" TEXT NOT NULL DEFAULT 'initiated',
      "paymentType" TEXT,
      "provider" TEXT NOT NULL DEFAULT 'paychangu',
      "txRef" TEXT,
      "metadata" JSONB,
      "paychanguResponse" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Payment_paymentId_key" ON "Payment"("paymentId")`,

    // 2. Create Notification
    `CREATE TABLE IF NOT EXISTS "Notification" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "priority" TEXT NOT NULL DEFAULT 'medium',
      "isRead" BOOLEAN NOT NULL DEFAULT false,
      "readAt" TIMESTAMP(3),
      "actionUrl" TEXT,
      "data" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
    )`,

    // 3. Create SeatReservation
    `CREATE TABLE IF NOT EXISTS "SeatReservation" (
      "id" TEXT NOT NULL,
      "scheduleId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "seatNumbers" JSONB NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'reserved',
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SeatReservation_pkey" PRIMARY KEY ("id")
    )`,

    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "region" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "invitationSent" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "invitationSentAt" TIMESTAMP(3)`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdBy" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companyId" TEXT`,

    // 5. Add Foreign Keys
    `ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    `ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    `ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    `ALTER TABLE "SeatReservation" ADD CONSTRAINT "SeatReservation_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    `ALTER TABLE "SeatReservation" ADD CONSTRAINT "SeatReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
  ];

  for (const sql of commands) {
    try {
      await client.query(sql);
      console.log('Success:', sql.slice(0, 50) + '...');
    } catch (e: any) {
      console.error('Error injecting data:', e);
    }
  }

  await client.end();
  console.log('Injection complete.');
}

run().catch(console.error);

export {};
