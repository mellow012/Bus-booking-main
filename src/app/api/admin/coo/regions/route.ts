import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const parseBranches = (data: any): string[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(b => typeof b === 'string').map(b => b.trim());
  if (typeof data === 'string') return data.split(',').map(b => b.trim()).filter(Boolean);
  return [];
};

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

    if (isCompanyAdmin) {
      if (!user.companyId) {
        return NextResponse.json({ error: 'No company assigned' }, { status: 403 });
      }
      companyId = user.companyId;
    }

    const where: any = {};
    if (companyId) where.companyId = companyId;

    const skip = (page - 1) * limit;

    let [regions, total] = await Promise.all([
      prisma.region.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: limit, include: { company: true } }),
      prisma.region.count({ where }),
    ]);




    await logger.logSuccess('api', `COO GET /api/admin/coo/regions returned ${regions.length} rows`, { metadata: { userId: user.id } });
    return NextResponse.json({ regions, total, page, limit });
  } catch (err: any) {
    await logger.logError('api', 'COO GET /api/admin/coo/regions error', { error: String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

