import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = req.nextUrl;
    const action = url.searchParams.get('action') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const companyId = url.searchParams.get('companyId') || undefined;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1000);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const where: any = {};
    if (action) where.action = action;
    if (companyId) where.companyId = companyId;
    if (status) {
      where.metadata = { path: ['status'], equals: status };
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!Number.isNaN(start.getTime())) where.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!Number.isNaN(end.getTime())) where.createdAt.lte = end;
      }
    }

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error: any) {
    console.error('/api/admin/audit-logs error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch audit logs' }, { status: 500 });
  }
}
