import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const from = params.get('from')?.trim() || undefined;
    const to = params.get('to')?.trim() || undefined;
    const date = params.get('date')?.trim() || undefined;
    const companyId = params.get('companyId')?.trim() || undefined;
    const status = params.get('status')?.trim() || undefined;
    const routeName = params.get('routeName')?.trim() || undefined;
    const busId = params.get('busId')?.trim() || undefined;

    const where: any = {};

    if (companyId) where.companyId = companyId;
    if (status) where.status = status;
    if (busId) where.busId = busId;

    if (from || to || routeName) {
      where.route = { AND: [] };
      if (from) where.route.AND.push({ origin: { contains: from, mode: 'insensitive' } });
      if (to) where.route.AND.push({ destination: { contains: to, mode: 'insensitive' } });
      if (routeName) where.route.AND.push({ name: { contains: routeName, mode: 'insensitive' } });
    }

    if (date) {
      const startOfDay = new Date(`${date}T00:00:00Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      where.departureDateTime = { gte: startOfDay, lte: endOfDay };
    }

    if (from || to || routeName || date || companyId || status || busId) {
      const schedules = await prisma.schedule.findMany({
        where,
        include: {
          route: true,
          company: true,
          bus: true,
        },
        orderBy: { departureDateTime: 'asc' },
        take: 200,
      });

      return NextResponse.json({
        success: true,
        query: { from, to, date, companyId, status, routeName, busId },
        count: schedules.length,
        schedules,
      });
    }

    const companies = await prisma.company.count();
    const buses = await prisma.bus.count();
    const routes = await prisma.route.count();
    const schedules = await prisma.schedule.count();
    
    const sampleSchedule = await prisma.schedule.findFirst({
      include: {
        route: true,
        company: true,
        bus: true
      }
    });

    return NextResponse.json({
      success: true,
      counts: {
        companies,
        buses,
        routes,
        schedules
      },
      sampleSchedule
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
