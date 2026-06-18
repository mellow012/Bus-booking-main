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
    const status = searchParams.get('status')?.toLowerCase();
    const companyId = searchParams.get('companyId');

    const where: any = {};
    if (status) where.bookingStatus = status;
    if (companyId) where.companyId = companyId;

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          schedule: { include: { route: true, bus: true, company: true } },
          company: { select: { id: true, name: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    await logger.logSuccess('api', `COO GET /api/admin/coo/bookings returned ${bookings.length} rows`, { metadata: { userId: user.id } });
    return NextResponse.json({ bookings, total, page, limit });
  } catch (err: any) {
    await logger.logError('api', 'COO GET /api/admin/coo/bookings error', { error: String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
