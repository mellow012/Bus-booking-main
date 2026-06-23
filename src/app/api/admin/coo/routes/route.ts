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

    if (isCompanyAdmin) {
      if (!user.companyId) {
        return NextResponse.json({ error: 'No company assigned' }, { status: 403 });
      }
      companyId = user.companyId;
    }

    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (regionId) where.regionId = regionId;

    const skip = (page - 1) * limit;

    const [routes, total] = await Promise.all([
      prisma.route.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: limit, include: { company: true } }),
      prisma.route.count({ where }),
    ]);

    await logger.logSuccess('api', `COO GET /api/admin/coo/routes returned ${routes.length} rows`, { metadata: { userId: user.id } });
    return NextResponse.json({ routes, total, page, limit });
  } catch (err: any) {
    await logger.logError('api', 'COO GET /api/admin/coo/routes error', { error: String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
