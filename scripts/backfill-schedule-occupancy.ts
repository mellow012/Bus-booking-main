/**
 * Recompute occupancy aggregates for future schedules.
 *
 * Dry-run (default; rolls back every transaction):
 *   npx tsx scripts/backfill-schedule-occupancy.ts
 *
 * Apply changes explicitly:
 *   npx tsx scripts/backfill-schedule-occupancy.ts --apply
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Use the direct Supabase connection for standalone transactions.
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

type OccupancyChange = {
  scheduleId: string;
  departureDateTime: Date;
  capacity: number;
  before: { availableSeats: number; bookedSeats: unknown };
  after: { availableSeats: number; bookedSeats: unknown };
};

class DryRunRollback extends Error {
  constructor(readonly result: { changes: OccupancyChange[] }) {
    super('Dry-run rollback');
  }
}

function sameSeats(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const [{ prisma }, { recomputeScheduleOccupancy }] = await Promise.all([
    import('../src/lib/prisma'),
    import('../src/lib/segment-booking-core'),
  ]);

  const now = new Date();
  const schedules = await prisma.schedule.findMany({
    where: { departureDateTime: { gt: now } },
    select: {
      id: true,
      departureDateTime: true,
      availableSeats: true,
      bookedSeats: true,
      bus: { select: { capacity: true } },
    },
    orderBy: { departureDateTime: 'asc' },
  });

  console.log(`${apply ? 'APPLY' : 'DRY-RUN'}: found ${schedules.length} future schedule(s).`);

  const changes: OccupancyChange[] = [];
  const batchSize = 20;
  const workerCount = 4;
  await Promise.all(Array.from({ length: workerCount }, async (_, workerIndex) => {
    for (let offset = workerIndex * batchSize; offset < schedules.length; offset += batchSize * workerCount) {
      const batch = schedules.slice(offset, offset + batchSize);
      const batchChanges = await prisma.$transaction(async (tx) => {
        const detected: OccupancyChange[] = [];
        for (const schedule of batch) {
          const after = await recomputeScheduleOccupancy(tx, schedule.id, now);
          const differs = schedule.availableSeats !== after.availableSeats ||
            !sameSeats(schedule.bookedSeats, after.bookedSeats);
          if (differs) {
            detected.push({
              scheduleId: schedule.id,
              departureDateTime: schedule.departureDateTime,
              capacity: schedule.bus.capacity,
              before: {
                availableSeats: schedule.availableSeats,
                bookedSeats: schedule.bookedSeats,
              },
              after: {
                availableSeats: after.availableSeats,
                bookedSeats: after.bookedSeats,
              },
            });
          }
        }
        if (!apply) throw new DryRunRollback({ changes: detected });
        return detected;
      }, { timeout: 120_000, maxWait: 10_000 }).catch((error: unknown) => {
        if (error instanceof DryRunRollback) return error.result.changes;
        throw error;
      });
      changes.push(...batchChanges);
      console.log(`Processed ${Math.min(offset + batch.length, schedules.length)}/${schedules.length}.`);
    }
  }));

  const changed = changes.length;
  const nullNormalizationChanges = changes.filter((change) =>
    change.before.bookedSeats === null &&
    change.after.bookedSeats instanceof Array &&
    change.after.bookedSeats.length === 0 &&
    change.before.availableSeats === change.after.availableSeats
  );
  const genuineOccupancyChanges = changes.filter((change) => !nullNormalizationChanges.includes(change));

  console.log(`${apply ? 'Updated' : 'Would update'} ${changed} schedule(s).`);
  console.log(`Pure null-to-empty normalization: ${nullNormalizationChanges.length}`);
  console.log(`Genuine occupancy corrections: ${genuineOccupancyChanges.length}`);
  if (genuineOccupancyChanges.length > 0) {
    console.log('Complete genuine occupancy corrections:');
    for (const change of genuineOccupancyChanges) {
      console.log(JSON.stringify(change));
    }
  }
  if (!apply) {
    console.log('No changes were committed. Re-run with --apply to write these values.');
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Schedule occupancy backfill failed:', error);
  process.exitCode = 1;
});
