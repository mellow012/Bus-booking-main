import { NextRequest, NextResponse } from 'next/server';
import { sendDepartureReminders } from '@/lib/notificationService';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  const authHeader = request.headers.get('authorization') || '';
  const xCronSecret = request.headers.get('x-cron-secret') || '';
  const querySecret = request.nextUrl.searchParams.get('secret') || '';

  if (authHeader === `Bearer ${cronSecret}` || authHeader === cronSecret) return true;
  if (xCronSecret === cronSecret) return true;
  if (querySecret === cronSecret) return true;

  return false;
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      await logger.logError('api', 'Unauthorized access attempt to reminders cron endpoint', new Error('Unauthorized'));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await sendDepartureReminders();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    await logger.logError('api', 'Error in reminders cron endpoint', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
