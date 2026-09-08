
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromServer } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  companyId: z.string().uuid(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const { companyId } = schema.parse(params);

    const authUser = await getCurrentUserFromServer();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isPlatformAdmin = ['super_admin', 'superadmin', 'chief_of_growth'].includes(authUser.role ?? '');
    if (!isPlatformAdmin && authUser.companyId !== companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const now = new Date();
    const monthStart = new Date(now);
    monthStart.setDate(monthStart.getDate() - 30);

    const [
      branchCount,
      operatorCount,
      activeOperatorCount,
      routeCount,
      scheduleCount,
      upcomingScheduleCount,
      busCount,
      activeBusCount,
      maintenanceBusCount,
      branches,
      paidBookings,
    ] = await Promise.all([
      prisma.region.count({ where: { companyId } }),
      prisma.operator.count({ where: { companyId } }),
      prisma.operator.count({ where: { companyId, status: 'active' } }),
      prisma.route.count({ where: { companyId, isActive: true } }),
      prisma.schedule.count({ where: { companyId, isArchived: false } }),
      prisma.schedule.count({
        where: {
          companyId,
          isArchived: false,
          status: 'active',
          departureDateTime: { gte: now },
        },
      }),
      prisma.bus.count({ where: { companyId } }),
      prisma.bus.count({ where: { companyId, isActive: true, status: 'active' } }),
      prisma.bus.count({ where: { companyId, status: 'maintenance' } }),
      prisma.region.findMany({ where: { companyId }, select: { id: true, name: true } }),
      prisma.booking.findMany({
        where: {
          companyId,
          paymentStatus: 'paid',
          createdAt: { gte: monthStart },
        },
        select: {
          totalAmount: true,
          route: { select: { regionId: true } },
        },
      }),
    ]);

    const revenueByBranch = new Map<string, { name: string; revenue: number }>();
    branches.forEach((branch) => revenueByBranch.set(branch.id, { name: branch.name, revenue: 0 }));
    let overallRevenue = 0;

    for (const booking of paidBookings) {
      overallRevenue += booking.totalAmount;
      const branchId = booking.route?.regionId || 'unassigned';
      const existing = revenueByBranch.get(branchId);
      if (existing) {
        existing.revenue += booking.totalAmount;
      } else {
        revenueByBranch.set(branchId, { name: 'Unassigned', revenue: booking.totalAmount });
      }
    }

    const overviewData = {
      branches: {
        total: branchCount,
        routesPerBranch: branchCount ? routeCount / branchCount : 0,
        operatorsPerBranch: branchCount ? operatorCount / branchCount : 0,
      },
      operators: {
        total: operatorCount,
        active: activeOperatorCount,
        inactive: operatorCount - activeOperatorCount,
      },
      routes: { total: routeCount },
      schedules: { total: scheduleCount, upcoming: upcomingScheduleCount },
      buses: {
        total: busCount,
        active: activeBusCount,
        maintenance: maintenanceBusCount,
      },
      revenue: {
        overall: overallRevenue,
        perBranch: Array.from(revenueByBranch.entries())
          .filter(([, branch]) => branch.revenue > 0)
          .map(([branchId, branch]) => ({ branchId, ...branch }))
          .sort((a, b) => b.revenue - a.revenue),
      },
    };

    return NextResponse.json(overviewData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error fetching company overview:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
