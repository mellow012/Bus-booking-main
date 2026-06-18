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
    const companyId = searchParams.get('companyId');

    // Overall totals
    const bookingWhere: any = {};
    if (companyId) bookingWhere.companyId = companyId;

    const [bookingAgg, paymentAgg] = await Promise.all([
      prisma.booking.aggregate({ _sum: { totalAmount: true }, _count: { id: true }, where: bookingWhere }),
      prisma.payment.aggregate({ _sum: { amount: true }, _count: { id: true }, where: companyId ? { metadata: { path: ['companyId'], equals: companyId } } : {} as any }),
    ]);

    // Per-company breakdown (top 50)
    const byCompany = await prisma.booking.groupBy({
      by: ['companyId'],
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 50,
    });

    await logger.logSuccess('api', `COO GET /api/admin/coo/payment-stats`, { metadata: { userId: user.id } });
    return NextResponse.json({ bookingAgg, paymentAgg, byCompany });
  } catch (err: any) {
    await logger.logError('api', 'COO GET /api/admin/coo/payment-stats error', { error: String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
