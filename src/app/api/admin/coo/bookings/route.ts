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
    const status = searchParams.get('status')?.toLowerCase();
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
    if (status) where.bookingStatus = status;
    if (companyId) where.companyId = companyId;
    if (scheduleId) where.scheduleId = scheduleId;

    // Filter by routeId or regionId via schedule relation
    if (routeId) {
      where.schedule = { is: { routeId } };
    } else if (regionId) {
      where.schedule = { is: { route: { is: { regionId } } } };
    }

    // Date range filter (booking.createdAt or schedule.departureDateTime based on preference)
    if (from || to) {
      const range: any = {};
      if (from) range.gte = new Date(from);
      if (to) range.lte = new Date(to);
      where.createdAt = range;
    }

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
