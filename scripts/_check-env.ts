import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    // Find any company named "Concurrency Test Company"
    const { rows: companies } = await client.query(
      `SELECT id, name, email FROM "Company" WHERE name ILIKE '%concurrency%' OR email ILIKE '%concurrency%' OR email ILIKE '%test.local%'`
    );
    console.log('\n=== Companies ===');
    console.table(companies);

    // Find any schedule with TEST or concurrency bus plate
    const { rows: schedules } = await client.query(`
      SELECT s.id, s."companyId", s."departureDateTime", s.status, s."isActive", b."licensePlate"
      FROM "Schedule" s
      JOIN "Bus" b ON b.id = s."busId"
      WHERE b."licensePlate" ILIKE '%TEST%'
         OR s."companyId" IN (SELECT id FROM "Company" WHERE name ILIKE '%concurrency%' OR email ILIKE '%test.local%')
      ORDER BY s."departureDateTime"
    `);
    console.log('\n=== Orphaned Schedules ===');
    console.table(schedules);

    // Find any seat reservations belonging to concurrency-user-* that have no matching schedule in the previous query
    const { rows: stranded } = await client.query(`
      SELECT sr.id, sr."userId", sr."scheduleId", sr.status
      FROM "SeatReservation" sr
      WHERE sr."userId" ILIKE '%concurrency-user%'
      LIMIT 20
    `);
    console.log('\n=== Stranded SeatReservations (concurrency users) ===');
    console.table(stranded);

    // Find any buses with TEST in license plate
    const { rows: buses } = await client.query(
      `SELECT id, "licensePlate", "companyId", status FROM "Bus" WHERE "licensePlate" ILIKE '%TEST%'`
    );
    console.log('\n=== Test Buses ===');
    console.table(buses);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
