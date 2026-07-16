'use server'

import prisma from '../prisma';
import { revalidatePath } from 'next/cache';
import { Company } from '@/types';
import { createClient } from '@/utils/supabase/server';
import { getUserById } from './user.actions';

// ─────────────────────────────────────────────────────────────────────────────
// Auth-related company actions (replaces /api/auth/login)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Activates a company when a company_admin logs in.
 * Replaces POST /api/auth/login { action: 'activate_company' }.
 */
export async function activateCompanyOnLogin(companyId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Unauthorized' };

  const { data: profile } = await getUserById(user.id);
  if (!profile || profile.role !== 'company_admin' || profile.companyId !== companyId) {
    return { success: false as const, error: 'Forbidden' };
  }

  try {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return { success: false as const, error: `Company ${companyId} not found` };

    if (company.status === 'pending') {
      await prisma.company.update({
        where: { id: companyId },
        data: { status: 'active', updatedAt: new Date() },
      });
      console.log(`[activateCompanyOnLogin] Company ${companyId} activated.`);
    }
    return { success: true as const };
  } catch (error: unknown) {
    console.error('[activateCompanyOnLogin] Error:', error);
    return { success: false as const, error: (error as Error).message };
  }
}

/**
 * --- Companies ---
 */
export async function updateCompany(id: string, data: Partial<Company> | Record<string, any>) {
  try {
    const { id: _, createdAt, updatedAt, contact, adminFirstName, adminLastName, adminPhone, ...rest } = data as any;
    const updatableData: any = { ...rest };

    // Map legacy 'contact' field to 'phone' for Prisma
    if (contact !== undefined) {
      updatableData.phone = contact;
    }

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...updatableData,
        updatedAt: new Date(),
      },
    });
    revalidatePath('/company/admin');
    return { success: true, data: (company as any) as Company };
  } catch (error: unknown) {
    console.error('Error updating company:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteCompany(id: string) {
  try {
    await prisma.company.delete({ where: { id } });
    revalidatePath('/admin');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting company:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * --- Admin Dashboard ---
 */
export async function getAdminDashboardStats() {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalCompanies,
      activeCompanies,
      pendingCompanies,
      totalBookings,
      totalRevenueData,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { status: 'active' } }),
      prisma.company.count({ where: { status: 'pending' } }),
      prisma.booking.count(),
      prisma.booking.aggregate({
        where: { bookingStatus: 'confirmed' },
        _sum: { totalAmount: true }
      }),
    ]);

    const monthlyRevenueData = await prisma.booking.aggregate({
      where: {
        bookingStatus: 'confirmed',
        updatedAt: { gte: firstDayOfMonth }
      },
      _sum: { totalAmount: true }
    });

    const monthlyRevenue = monthlyRevenueData._sum?.totalAmount || 0;

    return {
      success: true,
      data: {
        totalCompanies,
        activeCompanies,
        pendingCompanies,
        inactiveCompanies: totalCompanies - activeCompanies - pendingCompanies,
        totalRevenue: totalRevenueData._sum.totalAmount || 0,
        monthlyRevenue: monthlyRevenue,
        totalBookings,
        monthlyBookings: totalBookings,
        monthlyGrowth: 12.5,
        revenueGrowth: 18.2
      }
    };
  } catch (error: unknown) {
    console.error('Error fetching admin stats:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getAdminCompanies() {
  try {
    const companies = await prisma.company.findMany({
      include: {
        _count: {
          select: {
            buses: true,
            routes: true,
            bookings: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, data: companies as any[] };
  } catch (error: unknown) {
    console.error('Error fetching admin companies:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getAdminBookings(page = 1, limit = 10, search = '', status = 'all') {
  try {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (status !== 'all') {
      where.bookingStatus = status;
    }

    if (search) {
      where.OR = [
        { bookingReference: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        include: {
          schedule: {
            include: {
              route: true,
              bus: true
            }
          },
          company: true,
          user: true
        },
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.booking.count({ where })
    ]);

    return {
      success: true,
      data: {
        bookings: bookings as unknown[],
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page,
          limit
        }
      }
    };
  } catch (error: unknown) {
    console.error('Error fetching admin bookings:', error);
    return { success: false, error: (error as Error).message };
  }
}
