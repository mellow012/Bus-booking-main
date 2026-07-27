/**
 * cleanup-concurrency-test-data.ts
 *
 * Removes all orphaned data created by the seat concurrency test suite:
 *   - Schedules belonging to "Concurrency Test Company"
 *   - Seat reservations & bookings tied to those schedules
 *   - The test bus (TEST-32-BUS, TEST-32-BUS, etc.)
 *   - The test route (Lilongwe - Blantyre seeded by concurrency tests)
 *   - The "Concurrency Test Company" itself
 *   - Concurrency test users (concurrency-user-1 .. concurrency-user-35)
 *
 * SAFE TO RUN: only targets records with the well-known hardcoded IDs
 * used exclusively by the concurrency test helpers.
 *
 * Usage:
 *   npx tsx scripts/cleanup-concurrency-test-data.ts
 */

// ── env setup MUST happen before any DB imports ─────────────────────────────
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// dotenvx may already have injected DATABASE_URL (transaction pooler, port 6543)
// which rejects standalone pg connections. Override with DIRECT_URL (port 5432)
// which allows normal TCP connections from scripts.
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
// ─────────────────────────────────────────────────────────────────────────────

import { Pool } from 'pg';

// ── Current UUID-based IDs (seat-concurrency-helpers.ts v2) ─────────────────
const TEST_COMPANY_IDS = [
  'a0000000-0000-4000-8000-000000000001',   // UUID scheme
  'concurrency-company-1',                  // Legacy string scheme
];
const TEST_ROUTE_IDS = [
  'c0000000-0000-4000-8000-000000000001',   // UUID scheme
  'concurrency-route-1',                    // Legacy (if present)
];

// Bus IDs: UUID scheme uses b0000000-..., legacy uses concurrency-bus-<cap>
const TEST_BUS_IDS = [
  ...[31, 32, 33, 34, 35].map(
    cap => `b0000000-0000-4000-8000-${cap.toString(16).padStart(12, '0')}`
  ),
  ...[31, 32, 33, 34, 35].map(cap => `concurrency-bus-${cap}`),
];

const TEST_USER_IDS = Array.from({ length: 35 }, (_, i) => `concurrency-user-${i + 1}`);

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  console.log('✅  Connected to database.\n');

  try {
    // ── 1. Find all test schedules ───────────────────────────────────────────
    console.log('🔍  Finding orphaned concurrency test schedules...');
    const companyPh = TEST_COMPANY_IDS.map((_, i) => `$${i + 1}`).join(', ');
    const { rows: schedules } = await client.query<{ id: string; departure_date_time: Date; status: string }>(
      `SELECT id, "departureDateTime" AS departure_date_time, status
         FROM "Schedule"
        WHERE "companyId" IN (${companyPh})`,
      TEST_COMPANY_IDS
    );

    if (schedules.length === 0) {
      console.log('   No orphaned schedules found.');
    } else {
      console.log(`🗑️   Found ${schedules.length} orphaned schedule(s). Deleting...\n`);

      for (const s of schedules) {
        console.log(`   • Schedule ${s.id}  (departs ${s.departure_date_time}, status: ${s.status})`);

        // Delete seat reservations (references both Schedule and BookingSegment)
        const { rowCount: resCount } = await client.query(
          `DELETE FROM "SeatReservation" WHERE "scheduleId" = $1`, [s.id]
        );
        if ((resCount ?? 0) > 0) console.log(`     - Deleted ${resCount} seat reservation(s)`);

        // Delete booking segments then bookings (and payments first due to FK)
        const { rows: bookings } = await client.query<{ id: string }>(
          `SELECT id FROM "Booking" WHERE "scheduleId" = $1`, [s.id]
        );
        if (bookings.length > 0) {
          const ids = bookings.map(b => b.id);
          const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
          // Payments reference Booking — must go before Booking
          await client.query(`DELETE FROM "Payment" WHERE "bookingId" IN (${placeholders})`, ids).catch(() => {});
          await client.query(`DELETE FROM "BookingSegment" WHERE "bookingId" IN (${placeholders})`, ids).catch(() => {});
          const { rowCount: bCount } = await client.query(`DELETE FROM "Booking" WHERE id IN (${placeholders})`, ids);
          console.log(`     - Deleted ${bCount} booking(s)`);
        }

        // Delete the schedule itself
        await client.query(`DELETE FROM "Schedule" WHERE id = $1`, [s.id]);
        console.log(`     - Schedule deleted`);
      }
    }

    // ── 2. Delete test buses ─────────────────────────────────────────────────
    const busPlaceholders = TEST_BUS_IDS.map((_, i) => `$${i + 1}`).join(', ');
    const { rowCount: busCount } = await client.query(
      `DELETE FROM "Bus" WHERE id IN (${busPlaceholders})`, TEST_BUS_IDS
    );
    if ((busCount ?? 0) > 0) console.log(`\n🗑️   Deleted ${busCount} test bus(es)`);

    // ── 3. Delete test route(s) ───────────────────────────────────────────────
    const routePhParts = TEST_ROUTE_IDS.map((_, i) => `$${i + 1}`).join(', ');
    const { rowCount: routeCount } = await client.query(
      `DELETE FROM "Route" WHERE id IN (${routePhParts})`, TEST_ROUTE_IDS
    );
    if ((routeCount ?? 0) > 0) console.log(`🗑️   Deleted ${routeCount} test route(s)`);

    // ── 4. Delete test company(s) ─────────────────────────────────────────────
    const companyPhParts = TEST_COMPANY_IDS.map((_, i) => `$${i + 1}`).join(', ');
    const { rowCount: companyCount } = await client.query(
      `DELETE FROM "Company" WHERE id IN (${companyPhParts})`, TEST_COMPANY_IDS
    );
    if ((companyCount ?? 0) > 0) console.log(`🗑️   Deleted ${companyCount} test company record(s)`);

    // ── 5. Delete concurrency test users (clear FK dependents first) ─────────
    const userPlaceholders = TEST_USER_IDS.map((_, i) => `$${i + 1}`).join(', ');

    // Notifications → SeatReservations → Bookings must be cleared before User delete
    await client.query(`DELETE FROM "Notification"    WHERE "userId" IN (${userPlaceholders})`, TEST_USER_IDS).catch(() => {});
    await client.query(`DELETE FROM "SeatReservation" WHERE "userId" IN (${userPlaceholders})`, TEST_USER_IDS).catch(() => {});

    // Clear any remaining bookings tied to test users (in case schedules had none)
    const { rows: userBookings } = await client.query<{ id: string }>(
      `SELECT id FROM "Booking" WHERE "userId" IN (${userPlaceholders})`, TEST_USER_IDS
    );
    if (userBookings.length > 0) {
      const bIds = userBookings.map(b => b.id);
      const bPh  = bIds.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(`DELETE FROM "Payment"        WHERE "bookingId" IN (${bPh})`, bIds).catch(() => {});
      await client.query(`DELETE FROM "BookingSegment" WHERE "bookingId" IN (${bPh})`, bIds).catch(() => {});
      await client.query(`DELETE FROM "Booking"        WHERE id          IN (${bPh})`, bIds).catch(() => {});
    }

    const { rowCount: userCount } = await client.query(
      `DELETE FROM "User" WHERE id IN (${userPlaceholders}) OR uid IN (${userPlaceholders})`,
      TEST_USER_IDS   // same values serve both IN lists via the same $1..$35 placeholders
    );
    if ((userCount ?? 0) > 0) console.log(`🗑️   Deleted ${userCount} concurrency test user(s)`);

  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n✅  Cleanup complete.');
}

main().catch(err => {
  console.error('❌  Cleanup failed:', err.message);
  process.exit(1);
});
