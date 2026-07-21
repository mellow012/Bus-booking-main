import { NextRequest, NextResponse } from 'next/server';
import { sendDepartureReminders } from '@/lib/notificationService';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    // Validate Vercel Cron authorization header if CRON_SECRET is configured
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
