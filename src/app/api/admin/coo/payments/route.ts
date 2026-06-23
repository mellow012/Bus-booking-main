import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const isCOOOrSuper = ['chief_of_operations', 'superadmin'].includes(user?.role || '');
    const isCompanyAdmin = user?.role === 'company_admin';
    if (!user || (!isCOOOrSuper && !isCompanyAdmin)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '25', 10));
    let companyId = searchParams.get('companyId');
    const regionId = searchParams.get('regionId');
    const routeId = searchParams.get('routeId');
    const scheduleId = searchParams.get('scheduleId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (isCompanyAdmin) {
      if (!user.companyId) {
        return NextResponse.json({ error: 'No company assigned' }, { status: 403 });
      }
      companyId = user.companyId;
    }

    const where: any = {};

    // Filter via booking relation when provided
    if (companyId) where.booking = { is: { companyId } };
    if (scheduleId) where.booking = { ...(where.booking || {}), is: { ...(where.booking?.is || {}), scheduleId } };
    if (routeId) where.booking = { ...(where.booking || {}), is: { ...(where.booking?.is || {}), schedule: { is: { routeId } } } };
    if (regionId) where.booking = { ...(where.booking || {}), is: { ...(where.booking?.is || {}), schedule: { is: { route: { is: { regionId } } } } } };

    if (from || to) {
      const range: any = {};
      if (from) range.gte = new Date(from);
      if (to) range.lte = new Date(to);
      where.createdAt = range;
    }

    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { booking: { include: { company: true, schedule: { include: { route: { include: { region: true } } } } } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    await logger.logSuccess('api', `COO GET /api/admin/coo/payments returned ${payments.length} rows`, { metadata: { userId: user.id } });
    return NextResponse.json({ payments, total, page, limit });
  } catch (err: any) {
    await logger.logError('api', 'COO GET /api/admin/coo/payments error', { error: String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
