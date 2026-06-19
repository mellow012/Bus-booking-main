import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !['chief_of_operations', 'superadmin'].includes(user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '25', 10));
    const companyId = searchParams.get('companyId');
    const routeId = searchParams.get('routeId');
    const regionId = searchParams.get('regionId');

    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (routeId) where.routeId = routeId;
    if (regionId) where.route = { is: { regionId } };
    if (from || to) {
      where.departureDateTime = {} as any;
      if (from) where.departureDateTime.gte = new Date(from);
      if (to) where.departureDateTime.lte = new Date(to);
    }

    const skip = (page - 1) * limit;

    const [schedules, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        include: { route: true, bus: true, company: true, operator: true },
        orderBy: { departureDateTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.schedule.count({ where }),
    ]);

    await logger.logSuccess('api', `COO GET /api/admin/coo/schedules returned ${schedules.length} rows`, { metadata: { userId: user.id } });
    return NextResponse.json({ schedules, total, page, limit });
  } catch (err: any) {
    await logger.logError('api', 'COO GET /api/admin/coo/schedules error', { error: String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
