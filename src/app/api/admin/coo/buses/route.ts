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

    const where: any = {};
    if (companyId) where.companyId = companyId;

    const skip = (page - 1) * limit;

    const [buses, total] = await Promise.all([
      prisma.bus.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: limit, include: { company: true } }),
      prisma.bus.count({ where }),
    ]);

    await logger.logSuccess('api', `COO GET /api/admin/coo/buses returned ${buses.length} rows`, { metadata: { userId: user.id } });
    return NextResponse.json({ buses, total, page, limit });
  } catch (err: any) {
    await logger.logError('api', 'COO GET /api/admin/coo/buses error', { error: String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
