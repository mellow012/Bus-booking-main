import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { materializeSchedules } from '@/lib/actions/schedule.actions';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max duration on Vercel

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

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      await logger.logError('api', 'Unauthorized access attempt to generate-trips cron endpoint', new Error('Unauthorized'));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all unique companies that have active blueprints
    const activeCompanies = await prisma.scheduleTemplate.findMany({
      where: {
        isActive: true
      },
      select: {
        companyId: true
      },
      distinct: ['companyId']
    });

    if (activeCompanies.length === 0) {
      return NextResponse.json({ success: true, message: 'No active blueprints found across any company.' });
    }

    let totalCreated = 0;
    const companyResults: any[] = [];
    const errors: any[] = [];

    // For each company, materialize schedules 30 days out (or whatever the default horizon should be)
    const DAYS_AHEAD = 30;

    for (const { companyId } of activeCompanies) {
      try {
        // By passing an empty routeId, materializeSchedules processes all active templates for that company
        const result = await materializeSchedules(companyId, "", DAYS_AHEAD);
        if (result.success) {
          totalCreated += (result.createdCount || 0);
          companyResults.push({ companyId, created: result.createdCount });
        } else {
          throw new Error(result.error);
        }
      } catch (err: any) {
        errors.push({ companyId, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      totalCreated,
      companyResults,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    await logger.logError('api', 'Error in generate-trips cron endpoint', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
