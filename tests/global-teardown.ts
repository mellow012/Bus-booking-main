/**
 * tests/global-teardown.ts
 *
 * Playwright global teardown — runs once after ALL test suites finish,
 * regardless of pass/fail/interrupt (Playwright guarantees this hook runs
 * even when tests are killed with Ctrl+C).
 *
 * Cleans up all data seeded by the seat concurrency test helpers so
 * orphaned "Concurrency Test Co..." records never appear on the live site.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load env before any DB imports — prefer DIRECT_URL (port 5432) over the
// PgBouncer transaction pooler (port 6543) which rejects standalone connections.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { Pool } from 'pg';

// Both UUID-based (current helper) and legacy string-based IDs
const TEST_COMPANY_IDS = [
  'a0000000-0000-4000-8000-000000000001',
  'concurrency-company-1',
];
const TEST_ROUTE_IDS = [
  'c0000000-0000-4000-8000-000000000001',
  'concurrency-route-1',
];
const TEST_BUS_IDS = [
  ...[31, 32, 33, 34, 35].map(
    cap => `b0000000-0000-4000-8000-${cap.toString(16).padStart(12, '0')}`
  ),
  ...[31, 32, 33, 34, 35].map(cap => `concurrency-bus-${cap}`),
];

const TEST_USER_IDS = Array.from({ length: 35 }, (_, i) => `concurrency-user-${i + 1}`);

async function globalTeardown() {
  let pool: Pool | undefined;
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 2,
      connectionTimeoutMillis: 10_000,
    });

    const client = await pool.connect();
    console.log('\n[teardown] Cleaning up concurrency test data...');

    try {
      // ── 1. Find all schedules owned by any test company ───────────────────
      const companyPh = TEST_COMPANY_IDS.map((_, i) => `$${i + 1}`).join(', ');
      const { rows: schedules } = await client.query<{ id: string }>(
        `SELECT id FROM "Schedule" WHERE "companyId" IN (${companyPh})`,
        TEST_COMPANY_IDS
      );

      for (const { id: scheduleId } of schedules) {
        // SeatReservation → Payment → BookingSegment → Booking (FK order)
        await client.query(`DELETE FROM "SeatReservation" WHERE "scheduleId" = $1`, [scheduleId]);

        const { rows: bookings } = await client.query<{ id: string }>(
          `SELECT id FROM "Booking" WHERE "scheduleId" = $1`, [scheduleId]
        );
        if (bookings.length > 0) {
          const ids = bookings.map(b => b.id);
          const ph  = ids.map((_, i) => `$${i + 1}`).join(', ');
          await client.query(`DELETE FROM "Payment"        WHERE "bookingId" IN (${ph})`, ids).catch(() => {});
          await client.query(`DELETE FROM "BookingSegment" WHERE "bookingId" IN (${ph})`, ids).catch(() => {});
          await client.query(`DELETE FROM "Booking"        WHERE id          IN (${ph})`, ids).catch(() => {});
        }

        await client.query(`DELETE FROM "Schedule" WHERE id = $1`, [scheduleId]).catch(() => {});
      }

      if (schedules.length > 0) {
        console.log(`[teardown]   • Removed ${schedules.length} test schedule(s)`);
      }

      // ── 2. Remove test buses ──────────────────────────────────────────────
      const busPh = TEST_BUS_IDS.map((_, i) => `$${i + 1}`).join(', ');
      const { rowCount: busCount } = await client.query(
        `DELETE FROM "Bus" WHERE id IN (${busPh})`, TEST_BUS_IDS
      );
      if ((busCount ?? 0) > 0) console.log(`[teardown]   • Removed ${busCount} test bus(es)`);

      // ── 3. Remove test routes ─────────────────────────────────────────────
      const routePh = TEST_ROUTE_IDS.map((_, i) => `$${i + 1}`).join(', ');
      const { rowCount: routeCount } = await client.query(
        `DELETE FROM "Route" WHERE id IN (${routePh})`, TEST_ROUTE_IDS
      );
      if ((routeCount ?? 0) > 0) console.log(`[teardown]   • Removed ${routeCount} test route(s)`);

      // ── 4. Remove test companies ──────────────────────────────────────────
      const companyPh2 = TEST_COMPANY_IDS.map((_, i) => `$${i + 1}`).join(', ');
      const { rowCount: companyCount } = await client.query(
        `DELETE FROM "Company" WHERE id IN (${companyPh2})`, TEST_COMPANY_IDS
      );
      if ((companyCount ?? 0) > 0) console.log(`[teardown]   • Removed ${companyCount} test company record(s)`);

      // ── 5. Remove test users (clear FK dependents first) ─────────────────
      const userPh = TEST_USER_IDS.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(`DELETE FROM "Notification"    WHERE "userId" IN (${userPh})`, TEST_USER_IDS).catch(() => {});
      await client.query(`DELETE FROM "SeatReservation" WHERE "userId" IN (${userPh})`, TEST_USER_IDS).catch(() => {});
      const { rows: uBookings } = await client.query<{ id: string }>(
        `SELECT id FROM "Booking" WHERE "userId" IN (${userPh})`, TEST_USER_IDS
      );
      if (uBookings.length > 0) {
        const bIds = uBookings.map(b => b.id);
        const bPh  = bIds.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(`DELETE FROM "Payment"        WHERE "bookingId" IN (${bPh})`, bIds).catch(() => {});
        await client.query(`DELETE FROM "BookingSegment" WHERE "bookingId" IN (${bPh})`, bIds).catch(() => {});
        await client.query(`DELETE FROM "Booking"        WHERE id          IN (${bPh})`, bIds).catch(() => {});
      }
      const { rowCount: userCount } = await client.query(
        `DELETE FROM "User" WHERE id IN (${userPh}) OR uid IN (${userPh})`,
        TEST_USER_IDS
      );
      if ((userCount ?? 0) > 0) console.log(`[teardown]   • Removed ${userCount} test user(s)`);

      console.log('[teardown] ✅  Concurrency test data cleaned up.\n');
    } finally {
      client.release();
    }
  } catch (err: any) {
    // Non-fatal: teardown errors should not fail the test run report
    console.warn('[teardown] ⚠️  Cleanup error (non-fatal):', err?.message ?? err);
  } finally {
    await pool?.end().catch(() => {});
  }
}

export default globalTeardown;
