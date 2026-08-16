import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Mirrors the auth helper used in generate-trips and reminders crons. */
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // dev: no secret configured

  const authHeader = request.headers.get('authorization') || '';
  const xCronSecret = request.headers.get('x-cron-secret') || '';
  const querySecret = request.nextUrl.searchParams.get('secret') || '';

  if (authHeader === `Bearer ${cronSecret}` || authHeader === cronSecret) return true;
  if (xCronSecret === cronSecret) return true;
  if (querySecret === cronSecret) return true;

  return false;
}

/**
 * POST /api/cron/archive-chatter-schedules
 *
 * Soft-archives ChatterSchedules whose travelDate passed more than
 * ARCHIVE_AFTER_DAYS ago and are still status='active' (trip completed).
 * Sets isArchived = true, archivedAt = now.
 *
 * Archived schedules are hidden from the rep's My Schedules view but not
 * permanently deleted — booking records are preserved for record-keeping.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ARCHIVE_AFTER_DAYS = 7;
    const GRACE_PERIOD_HOURS = 48;
    // Window: 7 days after the 48-hour grace period (i.e. travelDate + 48h + 7 days < now)
    const cutoff = new Date(Date.now() - (ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000 + GRACE_PERIOD_HOURS * 60 * 60 * 1000));

    // Identify active, non-archived schedules past the cutoff
    const toArchive = await prisma.chatterSchedule.findMany({
      where: {
        status: 'active',
        isArchived: false,
        travelDate: { lt: cutoff },
      },
      select: { id: true, busName: true, travelDate: true },
    });

    if (toArchive.length === 0) {
      return NextResponse.json({
        success: true,
        archived: 0,
        message: 'No schedules due for archiving.',
      });
    }

    const ids = toArchive.map((s) => s.id);

    const { count } = await prisma.chatterSchedule.updateMany({
      where: { id: { in: ids } },
      data: { isArchived: true, archivedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      archived: count,
      schedules: toArchive.map((s) => ({
        id: s.id,
        busName: s.busName,
        travelDate: s.travelDate,
      })),
    });
  } catch (error: any) {
    console.error('archive-chatter-schedules cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Vercel cron invocations use GET; proxy to POST handler
export async function GET(request: NextRequest) {
  return POST(request);
}

