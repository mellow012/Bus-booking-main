import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminDashboardStats } from '@/lib/actions/db.actions';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stats = await getAdminDashboardStats();

    const [companies, bookings, schedules, routes, buses, operators] = await Promise.all([
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
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        stats: stats.data,
        companies,
        bookings,
        schedules,
        routes,
        buses,
        operators
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
