import React from 'react';
import { getCurrentUserFromServer } from '@/lib/auth-utils';
import { getAdminUsers } from '@/lib/admin/users';
import DashboardClient from './DashboardClient';
import { logAudit } from '@/utils/AuditLogs';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUserFromServer();
  if (!user || !['superadmin', 'company_admin', 'chief_of_growth'].includes(user.role ?? '')) {
    return <div className="p-8">Access denied</div>;
  }

  const now = new Date();
  const thirtyDaysAgo  = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
  const sixtyDaysAgo   = new Date(now); sixtyDaysAgo.setDate(now.getDate() - 60);
  const sevenDaysAgo   = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);

  // ── All queries run in parallel ────────────────────────────────────────────
  const [
    // User counts
    totalUsers,
    customerCount,
    companyCount,
    crewCount,
    newUsersThisMonth,
    newUsersLastMonth,

    // Booking stats
    totalBookings,
    confirmedBookings,
    pendingBookings,
    cancelledBookings,
    bookingsThisMonth,
    bookingsLastMonth,

    // Revenue
    revenueThisMonthRaw,
    revenueLastMonthRaw,

    // Active schedules
    activeSchedules,
    completedTrips,

    // Routes & fleets
    activeRoutes,
    activeBuses,

    // Trend data (30-day buckets)
    usersLast30Days,
    bookingsLast30Days,

    // Top routes by bookings
    topRoutesRaw,

    // Recent users
    recentSignups,

    // Companies with booking counts
    companiesRaw,

    // Users for directory
    result,
  ] = await Promise.all([
    // User counts
    prisma.user.count(),
    prisma.user.count({ where: { role: 'customer' } }),
    prisma.company.count(),
    prisma.user.count({ where: { role: { in: ['operator', 'conductor', 'company_admin'] } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),

    // Booking stats
    prisma.booking.count(),
    prisma.booking.count({ where: { bookingStatus: 'confirmed' } }),
    prisma.booking.count({ where: { bookingStatus: 'pending' } }),
    prisma.booking.count({ where: { bookingStatus: { in: ['cancelled', 'no-show'] } } }),
    prisma.booking.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.booking.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),

    // Revenue (paid)
    prisma.booking.aggregate({
      _sum: { totalAmount: true },
      where: { paymentStatus: 'paid', createdAt: { gte: thirtyDaysAgo } }
    }),
    prisma.booking.aggregate({
      _sum: { totalAmount: true },
      where: { paymentStatus: 'paid', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }
    }),

    // Active schedules
    prisma.schedule.count({ where: { isActive: true, isArchived: false } }),
    prisma.schedule.count({ where: { isCompleted: true } }),

    // Routes & fleets
    prisma.route.count({ where: { isActive: true } }),
    prisma.bus.count({ where: { isActive: true } }),

    // 30-day trend data
    prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, role: true },
    }),
    prisma.booking.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, totalAmount: true, paymentStatus: true, bookingStatus: true },
    }),

    // Top routes by bookings (last 30 days)
    prisma.booking.groupBy({
      by: ['scheduleId'],
      _count: { id: true },
      _sum: { totalAmount: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),

    // Recent signups
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true, companyId: true },
    }),

    // Companies with metadata
    prisma.company.findMany({
      select: {
        id: true, name: true, email: true, phone: true,
        status: true, createdAt: true, planType: true,
        _count: { select: { bookings: true, buses: true, routes: true, operators: true } }
      },
      orderBy: { createdAt: 'desc' },
    }),

    // User directory (paginated)
    getAdminUsers({ currentUser: user as any, limit: 25 }),
  ]);

  // ── Build day-by-day trend ─────────────────────────────────────────────────
  const trendByDay: Record<string, { date: string; users: number; bookings: number; revenue: number; customers: number; staff: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    trendByDay[ds] = { date: ds, users: 0, bookings: 0, revenue: 0, customers: 0, staff: 0 };
  }
  usersLast30Days.forEach(u => {
    const ds = new Date(u.createdAt).toISOString().split('T')[0];
    if (trendByDay[ds]) {
      trendByDay[ds].users += 1;
      if (u.role === 'customer') trendByDay[ds].customers += 1;
      else trendByDay[ds].staff += 1;
    }
  });
  bookingsLast30Days.forEach(b => {
    const ds = new Date(b.createdAt).toISOString().split('T')[0];
    if (trendByDay[ds]) {
      trendByDay[ds].bookings += 1;
      if (b.paymentStatus === 'paid') trendByDay[ds].revenue += b.totalAmount;
    }
  });
  const trendData = Object.values(trendByDay).sort((a, b) => a.date.localeCompare(b.date));

  // ── Revenue MoM ───────────────────────────────────────────────────────────
  const revenueThisMonth = revenueThisMonthRaw._sum.totalAmount ?? 0;
  const revenueLastMonth = revenueLastMonthRaw._sum.totalAmount ?? 0;

  // ── Top routes — enrich with route metadata ────────────────────────────────
  const scheduleIds = topRoutesRaw.map(r => r.scheduleId).filter(Boolean);
  const schedulesForTop = await prisma.schedule.findMany({
    where: { id: { in: scheduleIds } },
    select: { id: true, route: { select: { name: true, origin: true, destination: true } } }
  });
  const scheduleMap: Record<string, { origin: string; destination: string; name: string }> = {};
  schedulesForTop.forEach(s => {
    if (s.route) scheduleMap[s.id] = { origin: s.route.origin, destination: s.route.destination, name: s.route.name };
  });
  const topRoutes = topRoutesRaw.map(r => ({
    route: scheduleMap[r.scheduleId]?.name || scheduleMap[r.scheduleId]?.origin + ' → ' + scheduleMap[r.scheduleId]?.destination || 'Unknown Route',
    bookings: r._count.id,
    revenue: r._sum.totalAmount ?? 0,
  }));

  // ── Booking funnel ────────────────────────────────────────────────────────
  const conversionRate = totalBookings > 0 ? Math.round((confirmedBookings / totalBookings) * 100) : 0;
  const cancellationRate = totalBookings > 0 ? Math.round((cancelledBookings / totalBookings) * 100) : 0;

  // ── Final stats object ────────────────────────────────────────────────────
  const stats = {
    // Users
    totalUsers,
    customerCount,
    companyCount,
    crewCount,
    newUsersThisMonth,
    newUsersLastMonth,
    userGrowthPct: newUsersLastMonth > 0 ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100) : 0,

    // Bookings
    totalBookings,
    confirmedBookings,
    pendingBookings,
    cancelledBookings,
    bookingsThisMonth,
    bookingsLastMonth,
    bookingGrowthPct: bookingsLastMonth > 0 ? Math.round(((bookingsThisMonth - bookingsLastMonth) / bookingsLastMonth) * 100) : 0,
    conversionRate,
    cancellationRate,

    // Revenue
    revenueThisMonth,
    revenueLastMonth,
    revenueGrowthPct: revenueLastMonth > 0 ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : 0,

    // Operations
    activeSchedules,
    completedTrips,
    activeRoutes,
    activeBuses,

    // Trends
    trendData,
    topRoutes,

    // Lists
    recentSignups: recentSignups.map(u => ({ ...u, createdAt: new Date(u.createdAt).toISOString() })),
    companies: companiesRaw.map(c => ({
      id: c.id, name: c.name, email: c.email,
      phone: c.phone, status: c.status,
      planType: c.planType,
      createdAt: new Date(c.createdAt).toISOString(),
      bookingsCount: c._count.bookings,
      busesCount: c._count.buses,
      routesCount: c._count.routes,
      operatorsCount: c._count.operators,
    })),
  };

  // Audit log
  try {
    await logAudit({
      action: 'access_dashboard', userId: user.id,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      userRole: user.role || 'unknown', companyId: user.companyId || '',
      resourceType: 'dashboard', resourceId: 'chief_of_growth',
      resourceName: 'Chief of Growth Dashboard',
      description: 'Accessed Chief of Growth dashboard', status: 'success', metadata: {},
    });
  } catch { /* swallow */ }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <DashboardClient initialData={result.data} initialMeta={result.meta} stats={stats as any} />
    </div>
  );
}
