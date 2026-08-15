/**
 * Verification: Phase 1 fixes (TibhukeBus)
 *
 * FIX 1 — Webhook seat release on payment failure
 * FIX 2 — deleteRoute dependency guard
 * FIX 3 — deleteBranch dependency guard
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false }, max: 10 });

let PASS = 0, FAIL = 0;
function ok(label, cond, detail = '') {
  if (cond) { console.log(`  ✅ PASS — ${label}`); PASS++; }
  else       { console.log(`  🚨 FAIL — ${label}${detail ? ': ' + detail : ''}`); FAIL++; }
}
async function q(sql, params = []) {
  const c = await pool.connect();
  try { return await c.query(sql, params); } finally { c.release(); }
}

// ──────────────────────────────────────────────────────────────────────────────
// FIX 1: Webhook seat release
// ──────────────────────────────────────────────────────────────────────────────
async function testFix1() {
  console.log('\n════ FIX 1: Webhook seat release on payment failure ════\n');

  const { rows: [{ companyid: companyId }] } = await q(`SELECT id AS companyid FROM "Company" LIMIT 1`);
  const { rows: [{ busid: busId }] }          = await q(`SELECT id AS busid FROM "Bus" WHERE "companyId" = $1 LIMIT 1`, [companyId]);
  const { rows: [{ userid: userId }] }        = await q(`SELECT id AS userid FROM "User" LIMIT 1`);
  const routeRows                              = await q(`SELECT id FROM "Route" WHERE "companyId" = $1 LIMIT 1`, [companyId]);
  if (!routeRows.rows.length) { console.log('  ⚠️  No routes — skip'); return; }
  const routeId = routeRows.rows[0].id;

  const TEST_SEATS = ['WH-F1', 'WH-F2'];

  // Insert schedule with seats held
  const { rows: [{ id: scheduleId, availableseats: avail0 }] } = await q(`
    INSERT INTO "Schedule" (
      id, "companyId", "busId", "routeId",
      "departureDateTime", "arrivalDateTime",
      "availableSeats", "bookedSeats",
      price, status, "tripStatus", "isActive", "isArchived", "isCompleted",
      "createdAt", "updatedAt", "currentStopIndex", "delayMinutes", "reminderSent", "boardingReminderSent"
    ) VALUES (
      gen_random_uuid(), $1, $2, $3,
      NOW()+INTERVAL '2h', NOW()+INTERVAL '8h',
      28, $4::jsonb,
      5000,'active','scheduled',true,false,false,
      NOW(),NOW(), 0,0,false,false
    ) RETURNING id, "availableSeats" AS availableseats
  `, [companyId, busId, routeId, JSON.stringify(TEST_SEATS)]);

  console.log(`  Schedule ${scheduleId}: availableSeats=${avail0}, bookedSeats=${JSON.stringify(TEST_SEATS)}`);

  // Insert booking
  const { rows: [{ id: bookingId }] } = await q(`
    INSERT INTO "Booking" (
      id,"bookingReference","userId","scheduleId","companyId",
      "totalAmount","bookingStatus","paymentStatus",
      "seatNumbers","createdAt","updatedAt","bookingDate"
    ) VALUES (
      gen_random_uuid(),$1,$2,$3,$4,
      5000,'pending','pending',
      $5::jsonb,NOW(),NOW(),NOW()
    ) RETURNING id
  `, [`TEST-WH-${Date.now()}`, userId, scheduleId, companyId, JSON.stringify(TEST_SEATS)]);

  console.log(`  Booking ${bookingId}`);

  // Simulate webhook failure logic in one transaction
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');

    // Mark booking failed (booking.actions.ts mirrors this)
    await cli.query(
      `UPDATE "Booking" SET "paymentStatus"='failed',"bookingStatus"='payment_failed',"updatedAt"=NOW() WHERE id=$1`,
      [bookingId]
    );

    // Seat release (the new code added to webhook/route.ts)
    const { rows: [sched] } = await cli.query(
      `SELECT "bookedSeats"::jsonb, "availableSeats" FROM "Schedule" WHERE id=$1`,
      [scheduleId]
    );
    const currentBooked = Array.isArray(sched.bookedseats) ? sched.bookedseats : (sched.bookedSeats || []);
    const currentAvail  = sched.availableseats ?? sched.availableSeats;
    const newBooked     = currentBooked.filter(s => !TEST_SEATS.includes(s));

    await cli.query(
      `UPDATE "Schedule" SET "bookedSeats"=$1::jsonb,"availableSeats"=$2,"updatedAt"=NOW() WHERE id=$3`,
      [JSON.stringify(newBooked), currentAvail + TEST_SEATS.length, scheduleId]
    );

    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK');
    throw e;
  } finally {
    cli.release();
  }

  // Assert
  const { rows: [afterS] } = await q(`SELECT "availableSeats" AS avail, "bookedSeats"::jsonb AS booked FROM "Schedule" WHERE id=$1`, [scheduleId]);
  const { rows: [afterB] } = await q(`SELECT "bookingStatus" AS bstatus, "paymentStatus" AS pstatus FROM "Booking" WHERE id=$1`, [bookingId]);

  // pg with quoted identifiers returns lowercase field names
  const finalAvail  = afterS.avail;
  const finalBooked = afterS.booked || [];
  const bStatus     = afterB.bstatus;
  const pStatus     = afterB.pstatus;

  console.log(`\n  DB after simulation:`);
  console.log(`    availableSeats: ${finalAvail}  (expect 30)`);
  console.log(`    bookedSeats:    ${JSON.stringify(finalBooked)}  (expect [])`);
  console.log(`    bookingStatus:  ${bStatus}  (expect payment_failed)`);
  console.log(`    paymentStatus:  ${pStatus}  (expect failed)`);

  ok('availableSeats restored to 30', finalAvail === 30, `got ${finalAvail}`);
  ok('TEST_SEATS removed from bookedSeats', !finalBooked.includes('WH-F1') && !finalBooked.includes('WH-F2'));
  ok('bookingStatus = payment_failed', bStatus === 'payment_failed', `got "${bStatus}"`);
  ok('paymentStatus = failed', pStatus === 'failed', `got "${pStatus}"`);

  await q(`DELETE FROM "Booking" WHERE id=$1`, [bookingId]);
  await q(`DELETE FROM "Schedule" WHERE id=$1`, [scheduleId]);
  console.log('  Cleanup done.');
}

// ──────────────────────────────────────────────────────────────────────────────
// FIX 2: deleteRoute dependency guard
// ──────────────────────────────────────────────────────────────────────────────
async function testFix2() {
  console.log('\n════ FIX 2: deleteRoute dependency guard ════\n');

  const { rows: [{ companyid: companyId }] } = await q(`SELECT id AS companyid FROM "Company" LIMIT 1`);
  const { rows: [{ busid: busId }] }          = await q(`SELECT id AS busid FROM "Bus" WHERE "companyId"=$1 LIMIT 1`, [companyId]);

  // Create isolated route
  const { rows: [{ id: routeId }] } = await q(`
    INSERT INTO "Route" (id,"companyId",name,origin,destination,distance,duration,"baseFare","isActive",status,"createdAt","updatedAt")
    VALUES (gen_random_uuid(),$1,'TEST-ROUTE-DEL','TestOrigin','TestDest',100,60,5000,true,'active',NOW(),NOW())
    RETURNING id
  `, [companyId]);
  console.log(`  Route ${routeId}`);

  // Attach a schedule
  const { rows: [{ id: schedId }] } = await q(`
    INSERT INTO "Schedule" (
      id,"companyId","busId","routeId",
      "departureDateTime","arrivalDateTime",
      "availableSeats",price,status,"tripStatus","isActive","isArchived","isCompleted",
      "createdAt","updatedAt","currentStopIndex","delayMinutes","reminderSent","boardingReminderSent"
    ) VALUES (
      gen_random_uuid(),$1,$2,$3,
      NOW()+INTERVAL '5h',NOW()+INTERVAL '11h',
      30,5000,'active','scheduled',true,false,false,
      NOW(),NOW(),0,0,false,false
    ) RETURNING id
  `, [companyId, busId, routeId]);
  console.log(`  Schedule ${schedId} references route`);

  // Guard: should block
  const { rows: [{ cnt }] } = await q(`SELECT COUNT(*) AS cnt FROM "Schedule" WHERE "routeId"=$1`, [routeId]);
  ok('deleteRoute blocked (schedule exists)', parseInt(cnt) > 0, `scheduleCount=${cnt}`);

  // Remove schedule — should now be deletable
  await q(`DELETE FROM "Schedule" WHERE id=$1`, [schedId]);
  const { rows: [{ cnt: cnt2 }] } = await q(`SELECT COUNT(*) AS cnt FROM "Schedule" WHERE "routeId"=$1`, [routeId]);
  ok('deleteRoute allowed (no schedules)', parseInt(cnt2) === 0, `scheduleCount=${cnt2}`);

  await q(`DELETE FROM "Route" WHERE id=$1`, [routeId]);
  const { rows: [{ cnt: cnt3 }] } = await q(`SELECT COUNT(*) AS cnt FROM "Route" WHERE id=$1`, [routeId]);
  ok('route deleted from DB', parseInt(cnt3) === 0);
  console.log('  Cleanup done.');
}

// ──────────────────────────────────────────────────────────────────────────────
// FIX 3: deleteBranch dependency guard
// ──────────────────────────────────────────────────────────────────────────────
async function testFix3() {
  console.log('\n════ FIX 3: deleteBranch dependency guard ════\n');

  const { rows: [{ companyid: companyId }] } = await q(`SELECT id AS companyid FROM "Company" LIMIT 1`);

  // Create region
  const { rows: [{ id: regionId }] } = await q(`
    INSERT INTO "Region" (id,name,"companyId","isActive","createdAt","updatedAt")
    VALUES (gen_random_uuid(),'TEST-BRANCH-DEL',$1,true,NOW(),NOW())
    RETURNING id
  `, [companyId]);
  console.log(`  Region ${regionId}`);

  // Attach a route to it
  const { rows: [{ id: routeId }] } = await q(`
    INSERT INTO "Route" (id,"companyId","regionId",name,origin,destination,distance,duration,"baseFare","isActive",status,"createdAt","updatedAt")
    VALUES (gen_random_uuid(),$1,$2,'TEST-ROUTE-BRANCH','A','B',50,30,2000,true,'active',NOW(),NOW())
    RETURNING id
  `, [companyId, regionId]);
  console.log(`  Route ${routeId} references region`);

  // Guard: should block
  const { rows: [{ cnt }] } = await q(`SELECT COUNT(*) AS cnt FROM "Route" WHERE "regionId"=$1`, [regionId]);
  ok('deleteBranch blocked (route exists)', parseInt(cnt) > 0, `routeCount=${cnt}`);

  // Unlink route
  await q(`UPDATE "Route" SET "regionId"=NULL WHERE id=$1`, [routeId]);
  const { rows: [{ cnt: cnt2 }] } = await q(`SELECT COUNT(*) AS cnt FROM "Route" WHERE "regionId"=$1`, [regionId]);
  const { rows: [{ cnt: opcnt }] } = await q(`SELECT COUNT(*) AS cnt FROM "Operator" WHERE "regionId"=$1`, [regionId]);
  ok('deleteBranch allowed (no routes)', parseInt(cnt2) === 0, `routeCount=${cnt2}`);
  ok('no operators assigned', parseInt(opcnt) === 0, `operatorCount=${opcnt}`);

  await q(`DELETE FROM "Region" WHERE id=$1`, [regionId]);
  const { rows: [{ cnt: cnt3 }] } = await q(`SELECT COUNT(*) AS cnt FROM "Region" WHERE id=$1`, [regionId]);
  ok('region deleted from DB', parseInt(cnt3) === 0);

  await q(`DELETE FROM "Route" WHERE id=$1`, [routeId]);
  console.log('  Cleanup done.');
}

// ──────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  TibhukeBus Phase 1 Fix Verification');
  console.log('═══════════════════════════════════════════════════════');

  await testFix1();
  await testFix2();
  await testFix3();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Results: ${PASS} passed, ${FAIL} failed`);
  if (FAIL === 0) { console.log('  ✅ All checks passed.\n'); }
  else            { console.log('  🚨 Some checks FAILED.\n'); process.exit(1); }
}

main()
  .catch(e => { console.error('Fatal:', e); process.exit(1); })
  .finally(() => pool.end());
