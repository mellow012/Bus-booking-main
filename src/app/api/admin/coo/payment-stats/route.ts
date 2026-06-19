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
    const regionId = searchParams.get('regionId');
    const routeId = searchParams.get('routeId');
    const scheduleId = searchParams.get('scheduleId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Build booking filter according to provided params
    const bookingWhere: any = {};
    if (companyId) bookingWhere.companyId = companyId;
    if (scheduleId) bookingWhere.scheduleId = scheduleId;
    if (routeId) bookingWhere.schedule = { is: { routeId } };
    if (regionId) bookingWhere.schedule = { is: { route: { is: { regionId } } } };
    if (from || to) {
      bookingWhere.createdAt = {} as any;
      if (from) bookingWhere.createdAt.gte = new Date(from);
      if (to) bookingWhere.createdAt.lte = new Date(to);
    }

    const [bookingAgg, paymentAgg] = await Promise.all([
      prisma.booking.aggregate({ _sum: { totalAmount: true }, _count: { id: true }, where: bookingWhere }),
      prisma.payment.aggregate({ _sum: { amount: true }, _count: { id: true }, where: Object.keys(bookingWhere).length ? { booking: { is: bookingWhere } } : {} as any }),
    ]);

    const scheduleWhere: any = {};
    if (companyId) scheduleWhere.companyId = companyId;
    if (routeId) scheduleWhere.routeId = routeId;
    if (regionId) scheduleWhere.route = { is: { regionId } };
    if (from || to) {
      scheduleWhere.departureDateTime = {} as any;
      if (from) scheduleWhere.departureDateTime.gte = new Date(from);
      if (to) scheduleWhere.departureDateTime.lte = new Date(to);
    }

    const routeWhere: any = {};
    if (companyId) routeWhere.companyId = companyId;
    if (regionId) routeWhere.regionId = regionId;

    const busWhere: any = {};
    if (companyId) busWhere.companyId = companyId;
    if (routeId || regionId || from || to) {
      busWhere.schedules = { some: {
        ...(routeId ? { routeId } : {}),
        ...(regionId ? { route: { is: { regionId } } } : {}),
        ...(from || to ? { departureDateTime: {} as any } : {}),
      } };
      if (from) busWhere.schedules.some.departureDateTime.gte = new Date(from);
      if (to) busWhere.schedules.some.departureDateTime.lte = new Date(to);
    }

    const [scheduleCount, routesCount, busesCount, pendingBookings, pendingPayments] = await Promise.all([
      prisma.schedule.count({ where: scheduleWhere }),
      prisma.route.count({ where: routeWhere }),
      prisma.bus.count({ where: busWhere }),
      prisma.booking.count({ where: { ...bookingWhere, bookingStatus: 'pending' } }),
      prisma.payment.count({ where: { status: { in: ['pending', 'initiated'] }, ...(Object.keys(bookingWhere).length ? { booking: { is: bookingWhere } } : {}) } }),
    ]);

    // Per-company breakdown (top 50)
    const byCompanyRaw = await prisma.booking.groupBy({
      by: ['companyId'],
      where: bookingWhere,
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 50,
    });

    const companyIds = byCompanyRaw.map(item => item.companyId).filter(Boolean) as string[];
    const companies = await prisma.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true },
    });
    const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]));
    const byCompany = byCompanyRaw.map(item => ({
      ...item,
      companyName: companyMap[item.companyId] ?? item.companyId ?? 'Unknown Company',
    }));

    await logger.logSuccess('api', `COO GET /api/admin/coo/payment-stats`, { metadata: { userId: user.id } });
    return NextResponse.json({ bookingAgg, paymentAgg, scheduleCount, routesCount, busesCount, byCompany, pendingBookings, pendingPayments });
  } catch (err: any) {
    await logger.logError('api', 'COO GET /api/admin/coo/payment-stats error', { error: String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
