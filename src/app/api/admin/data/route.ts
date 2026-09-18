import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminDashboardStats } from '@/lib/actions/company.actions';
import { getCurrentUser } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stats = await getAdminDashboardStats();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [companies, bookings, schedules, routes, buses, operators, schedulesTodayCount] = await Promise.all([
      prisma.company.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.booking.findMany({
        take: 100, // Limit for dashboard performance
        orderBy: { createdAt: 'desc' },
        include: { user: true, company: true }
      }),
      prisma.schedule.findMany({ orderBy: { departureDateTime: 'asc' } }),
      prisma.route.findMany({ orderBy: { name: 'asc' } }),
      prisma.bus.findMany(),
      prisma.user.findMany({
        where: {
          role: { in: ['operator', 'company_admin', 'conductor'] }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.schedule.count({
        where: {
          departureDateTime: {
            gte: todayStart,
            lte: todayEnd,
          },
          status: 'active',
          isActive: true,
          isArchived: false,
          isCompleted: false,
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        stats: stats.data,
        companies: companies.map(company => ({
          ...company,
          contact: company.phone,
        })),
        bookings,
        schedules,
        schedulesTodayCount,
        routes,
        buses,
        operators
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
