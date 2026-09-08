'use server'

import prisma from '../prisma';
import { revalidatePath } from 'next/cache';
import { Schedule, ScheduleStatus, TripStatus } from '@/types';
import { invalidateScheduleCaches } from '../cache';
import { Prisma } from '@prisma/client';
import { getCurrentUserFromServer } from '@/lib/auth-utils';
import type { AuthUser } from '@/lib/auth-utils';

const SCHEDULE_MANAGEMENT_ROLES = [
  'super_admin',
  'superadmin',
  'chief_of_operations',
  'company_admin',
  'operator',
];

const PLATFORM_WIDE_ROLES = ['super_admin', 'superadmin', 'chief_of_operations'];

async function authorizeScheduleRoute(
  authUser: AuthUser,
  routeId: string,
  effectiveCompanyId: string,
) {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    select: { id: true, companyId: true, regionId: true },
  });

  if (!route) {
    return { allowed: false as const, error: 'Route not found' };
  }

  if (route.companyId !== effectiveCompanyId) {
    return { allowed: false as const, error: 'Forbidden: route does not belong to the target company' };
  }

  if (authUser.role !== 'operator') {
    return { allowed: true as const, route };
  }

  const operator = await prisma.operator.findUnique({
    where: { uid: authUser.id },
    select: {
      companyId: true,
      regionId: true,
      routes: {
        where: { id: routeId },
        select: { id: true },
      },
    },
  });

  if (!operator) {
    return { allowed: false as const, error: 'Forbidden: operator record not found' };
  }

  if (operator.companyId !== authUser.companyId) {
    return { allowed: false as const, error: 'Forbidden: operator company does not match the authenticated user' };
  }

  const hasExplicitAssignment = operator.routes.length > 0;
  const hasRegionAccess = Boolean(operator.regionId && route.regionId === operator.regionId);

  if (!hasExplicitAssignment && !hasRegionAccess) {
    return { allowed: false as const, error: 'Forbidden: route is outside the operator route scope' };
  }

  return { allowed: true as const, route };
}

async function assertBusNotOverlapping(
  tx: Prisma.TransactionClient | any,
  busId: string,
  departureDateTime: Date,
  arrivalDateTime: Date,
  excludeScheduleId?: string
): Promise<void> {
  const conflictingSchedule = await tx.schedule.findFirst({
    where: {
      busId,
      status: { notIn: ['cancelled', 'archived'] },
      id: excludeScheduleId ? { not: excludeScheduleId } : undefined,
      AND: [
        { departureDateTime: { lt: new Date(arrivalDateTime.getTime() + 30 * 60000) } },
        { arrivalDateTime: { gt: new Date(departureDateTime.getTime() - 30 * 60000) } },
      ],
    },
    select: {
      id: true,
      departureDateTime: true,
      arrivalDateTime: true,
    },
  });

  if (conflictingSchedule) {
    throw new Error(
      `Bus is already assigned to another schedule (${conflictingSchedule.id}) which runs from ` +
      `${new Date(conflictingSchedule.departureDateTime).toLocaleString()} to ` +
      `${new Date(conflictingSchedule.arrivalDateTime).toLocaleString()}.`
    );
  }
}

/**
 * --- Schedules ---
 */
export async function createSchedule(data: Omit<Partial<Schedule>, 'departureDateTime' | 'arrivalDateTime'> & {
  companyId: string;
  busId: string;
  routeId: string;
  departureDateTime: string | Date;
  arrivalDateTime: string | Date;
  availableSeats: number;
  price: number;
}) {
  // ── Server-side validation (never trust client alone) ──────────────────────
  const dep = new Date(data.departureDateTime);
  const arr = new Date(data.arrivalDateTime);
  if (isNaN(dep.getTime()) || isNaN(arr.getTime())) {
    return { success: false, error: 'Invalid departure or arrival date/time.' };
  }
  if (arr <= dep) {
    return { success: false, error: 'Arrival time must be after departure time.' };
  }
  if (!data.price || data.price <= 0) {
    return { success: false, error: 'Price per seat must be greater than 0.' };
  }
  if (!data.availableSeats || data.availableSeats <= 0) {
    return { success: false, error: 'Available seats must be greater than 0.' };
  }
  // ──────────────────────────────────────────────────────────────────────────

  const authUser = await getCurrentUserFromServer();
  if (!authUser) {
    return { success: false, error: 'Unauthorized' };
  }
  if (!SCHEDULE_MANAGEMENT_ROLES.includes(authUser.role ?? '')) {
    return { success: false, error: 'Forbidden' };
  }

  const platformWide = PLATFORM_WIDE_ROLES.includes(authUser.role ?? '');
  const effectiveCompanyId = platformWide ? data.companyId : authUser.companyId;
  if (!effectiveCompanyId) {
    return { success: false, error: 'companyId is required' };
  }

  try {
    const routeAuthorization = await authorizeScheduleRoute(authUser, data.routeId, effectiveCompanyId);
    if (!routeAuthorization.allowed) {
      return { success: false, error: routeAuthorization.error };
    }

    await assertBusNotOverlapping(prisma, data.busId, dep, arr);

    const schedule = await prisma.schedule.create({
      data: {
        id: data.id,
        companyId: effectiveCompanyId,
        busId: data.busId,
        routeId: data.routeId,
        departureDateTime: dep,
        arrivalDateTime: arr,
        availableSeats: data.availableSeats,
        bookedSeats: data.bookedSeats || [],
        price: data.price,
        status: (data.status as ScheduleStatus) || 'active',
        tripStatus: (data.tripStatus as TripStatus) || 'scheduled',
      },
    });
    invalidateScheduleCaches();
    revalidatePath('/company/operator/dashboard');
    return { success: true, data: (schedule as any) as Schedule };
  } catch (error: unknown) {
    console.error('Error creating schedule:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function createRoundTripSchedule(outboundData: any, inboundData: any) {
  try {
    const authUser = await getCurrentUserFromServer();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }
    if (!SCHEDULE_MANAGEMENT_ROLES.includes(authUser.role ?? '')) {
      return { success: false, error: 'Forbidden' };
    }

    const platformWide = PLATFORM_WIDE_ROLES.includes(authUser.role ?? '');
    const effectiveCompanyId = platformWide ? outboundData.companyId : authUser.companyId;
    if (!effectiveCompanyId) {
      return { success: false, error: 'companyId is required' };
    }

    const outboundRouteAuthorization = await authorizeScheduleRoute(
      authUser,
      outboundData.routeId,
      effectiveCompanyId,
    );
    if (!outboundRouteAuthorization.allowed) {
      return { success: false, error: outboundRouteAuthorization.error };
    }

    const outboundRoute = await prisma.route.findUnique({ where: { id: outboundData.routeId } });
    if (!outboundRoute) {
      return { success: false, error: 'Outbound route not found' };
    }

    const returnRoute = await prisma.route.findFirst({
      where: {
        companyId: effectiveCompanyId,
        origin: outboundRoute.destination,
        destination: outboundRoute.origin,
        isActive: true,
      },
    });

    if (!returnRoute) {
      throw new Error(`Return route (${outboundRoute.destination} to ${outboundRoute.origin}) not found. Please create this route first.`);
    }

    const returnRouteAuthorization = await authorizeScheduleRoute(
      authUser,
      returnRoute.id,
      effectiveCompanyId,
    );
    if (!returnRouteAuthorization.allowed) {
      return { success: false, error: returnRouteAuthorization.error };
    }

    const outDep = new Date(outboundData.departureDateTime);
    const outArr = new Date(outboundData.arrivalDateTime);
    const inDep = new Date(inboundData.departureDateTime);
    const inArr = new Date(inboundData.arrivalDateTime);

    await assertBusNotOverlapping(prisma, outboundData.busId, outDep, outArr);
    await assertBusNotOverlapping(prisma, inboundData.busId, inDep, inArr);
    
    // Check if the two legs overlap with each other if using same bus
    if (outboundData.busId === inboundData.busId) {
      if (outDep < inArr && outArr > inDep) {
        throw new Error("Outbound and return trips overlap with each other for the same bus.");
      }
    }

    const transactionResult = await prisma.$transaction([
      prisma.schedule.create({
        data: {
          companyId: effectiveCompanyId,
          busId: outboundData.busId,
          routeId: outboundData.routeId,
          departureDateTime: new Date(outboundData.departureDateTime),
          arrivalDateTime: new Date(outboundData.arrivalDateTime),
          availableSeats: outboundData.availableSeats,
          bookedSeats: [],
          price: outboundData.price,
          status: 'active',
          tripStatus: 'scheduled',
        },
      }),
      prisma.schedule.create({
        data: {
          companyId: effectiveCompanyId,
          busId: inboundData.busId,
          routeId: returnRoute.id,
          departureDateTime: new Date(inboundData.departureDateTime),
          arrivalDateTime: new Date(inboundData.arrivalDateTime),
          availableSeats: inboundData.availableSeats,
          bookedSeats: [],
          price: inboundData.price ?? returnRoute.baseFare,
          status: 'active',
          tripStatus: 'scheduled',
        },
      })
    ]);

    invalidateScheduleCaches();
    revalidatePath('/company/operator/dashboard');
    return { success: true, data: transactionResult };
  } catch (error: unknown) {
    console.error('Error creating round trip schedules:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateSchedule(id: string, data: Partial<Schedule>) {
  const authUser = await getCurrentUserFromServer();
  if (!authUser) {
    return { success: false, error: 'Unauthorized' };
  }
  if (!SCHEDULE_MANAGEMENT_ROLES.includes(authUser.role ?? '')) {
    return { success: false, error: 'Forbidden' };
  }

  const existingSchedule = await prisma.schedule.findUnique({
    where: { id },
    select: { companyId: true, routeId: true },
  });
  if (!existingSchedule) {
    return { success: false, error: 'Schedule not found' };
  }

  const effectiveCompanyId = PLATFORM_WIDE_ROLES.includes(authUser.role ?? '')
    ? existingSchedule.companyId
    : authUser.companyId;
  if (!effectiveCompanyId) {
    return { success: false, error: 'companyId is required' };
  }

  const routeAuthorization = await authorizeScheduleRoute(
    authUser,
    data.routeId ?? existingSchedule.routeId,
    effectiveCompanyId,
  );
  if (!routeAuthorization.allowed) {
    return { success: false, error: routeAuthorization.error };
  }
  try {
    const currentSchedule = await prisma.schedule.findUnique({ where: { id } });
    if (!currentSchedule) {
      return { success: false, error: 'Schedule not found' };
    }

    const newBusId = data.busId || currentSchedule.busId;
    const newDep = data.departureDateTime ? new Date(data.departureDateTime) : currentSchedule.departureDateTime;
    const newArr = data.arrivalDateTime ? new Date(data.arrivalDateTime) : currentSchedule.arrivalDateTime;

    if (data.busId || data.departureDateTime || data.arrivalDateTime || data.status) {
      // If any time/bus/status changed, and the schedule isn't being cancelled
      if (data.status !== 'cancelled' && data.status !== 'archived') {
        await assertBusNotOverlapping(prisma, newBusId, newDep, newArr, id);
      }
    }

    const { id: _, createdAt, updatedAt, ...updatableData } = data;
    const schedule = await prisma.schedule.update({
      where: { id },
      data: {
        ...(updatableData as any),
        departureDateTime: updatableData.departureDateTime ? new Date(updatableData.departureDateTime) : undefined,
        arrivalDateTime: updatableData.arrivalDateTime ? new Date(updatableData.arrivalDateTime) : undefined,
        updatedAt: new Date(),
      }
    });
    invalidateScheduleCaches();
    revalidatePath('/company/conductor/dashboard');
    revalidatePath('/company/operator/dashboard');
    return { success: true, data: (schedule as any) as Schedule };
  } catch (error: unknown) {
    console.error('Error updating schedule:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteSchedule(id: string) {
  const authUser = await getCurrentUserFromServer();
  if (!authUser) {
    return { success: false, error: 'Unauthorized' };
  }
  if (!SCHEDULE_MANAGEMENT_ROLES.includes(authUser.role ?? '')) {
    return { success: false, error: 'Forbidden' };
  }

  const existingSchedule = await prisma.schedule.findUnique({
    where: { id },
    select: { companyId: true, routeId: true },
  });
  if (!existingSchedule) {
    return { success: false, error: 'Schedule not found' };
  }

  const effectiveCompanyId = PLATFORM_WIDE_ROLES.includes(authUser.role ?? '')
    ? existingSchedule.companyId
    : authUser.companyId;
  if (!effectiveCompanyId) {
    return { success: false, error: 'companyId is required' };
  }

  const routeAuthorization = await authorizeScheduleRoute(
    authUser,
    existingSchedule.routeId,
    effectiveCompanyId,
  );
  if (!routeAuthorization.allowed) {
    return { success: false, error: routeAuthorization.error };
  }

  try {
    const [bookingCount, bookingSegmentCount] = await prisma.$transaction([
      prisma.booking.count({ where: { scheduleId: id } }),
      prisma.bookingSegment.count({ where: { scheduleId: id } }),
    ]);
    if (bookingCount > 0 || bookingSegmentCount > 0) {
      return { success: false, error: 'Cannot delete schedule because it has associated bookings. Please mark the schedule as cancelled or archived instead.' };
    }
    await prisma.schedule.delete({ where: { id } });
    invalidateScheduleCaches();
    revalidatePath('/company/conductor/dashboard');
    revalidatePath('/company/operator/dashboard');
    revalidatePath('/company/admin');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting schedule:', error);
    return { success: false, error: (error as Error).message };
  }
}


/**
 * --- Schedule Templates ---
 */
export async function createScheduleTemplate(data: any) {
  try {
    const authUser = await getCurrentUserFromServer();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }
    if (!SCHEDULE_MANAGEMENT_ROLES.includes(authUser.role ?? '')) {
      return { success: false, error: 'Forbidden' };
    }

    const platformWide = PLATFORM_WIDE_ROLES.includes(authUser.role ?? '');
    const effectiveCompanyId = platformWide ? data.companyId : authUser.companyId;
    if (!effectiveCompanyId) {
      return { success: false, error: 'companyId is required' };
    }

    const routeAuthorization = await authorizeScheduleRoute(authUser, data.routeId, effectiveCompanyId);
    if (!routeAuthorization.allowed) {
      return { success: false, error: routeAuthorization.error };
    }

    const template = await prisma.scheduleTemplate.create({
      data: {
        companyId: effectiveCompanyId,
        routeId: data.routeId,
        busId: data.busId,
        departureTime: data.departureTime,
        arrivalTime: data.arrivalTime,
        daysOfWeek: data.daysOfWeek || [],
        price: data.price,
        isActive: true,
      },
    });
    revalidatePath('/company/operator/dashboard');
    return { success: true, data: template };
  } catch (error: unknown) {
    console.error('Error creating template:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function createRoundTripScheduleTemplate(outboundData: any, inboundData: any) {
  try {
    const authUser = await getCurrentUserFromServer();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }
    if (!SCHEDULE_MANAGEMENT_ROLES.includes(authUser.role ?? '')) {
      return { success: false, error: 'Forbidden' };
    }

    const platformWide = PLATFORM_WIDE_ROLES.includes(authUser.role ?? '');
    const effectiveCompanyId = platformWide ? outboundData.companyId : authUser.companyId;
    if (!effectiveCompanyId) {
      return { success: false, error: 'companyId is required' };
    }

    const outboundRouteAuthorization = await authorizeScheduleRoute(
      authUser,
      outboundData.routeId,
      effectiveCompanyId,
    );
    if (!outboundRouteAuthorization.allowed) {
      return { success: false, error: outboundRouteAuthorization.error };
    }

    const outboundRoute = await prisma.route.findUnique({ where: { id: outboundData.routeId } });
    if (!outboundRoute) {
      return { success: false, error: 'Outbound route not found' };
    }

    const returnRoute = await prisma.route.findFirst({
      where: {
        companyId: effectiveCompanyId,
        origin: outboundRoute.destination,
        destination: outboundRoute.origin,
        isActive: true,
      },
    });

    if (!returnRoute) {
      throw new Error(`Return route (${outboundRoute.destination} to ${outboundRoute.origin}) not found. Please create this route first.`);
    }

    const returnRouteAuthorization = await authorizeScheduleRoute(
      authUser,
      returnRoute.id,
      effectiveCompanyId,
    );
    if (!returnRouteAuthorization.allowed) {
      return { success: false, error: returnRouteAuthorization.error };
    }

    const transactionResult = await prisma.$transaction([
      prisma.scheduleTemplate.create({
        data: {
          companyId: effectiveCompanyId,
          routeId: outboundData.routeId,
          busId: outboundData.busId,
          departureTime: outboundData.departureTime,
          arrivalTime: outboundData.arrivalTime,
          daysOfWeek: outboundData.daysOfWeek || [],
          price: outboundData.price,
          isActive: true,
        },
      }),
      prisma.scheduleTemplate.create({
        data: {
          companyId: effectiveCompanyId,
          routeId: returnRoute.id,
          busId: inboundData.busId,
          departureTime: inboundData.departureTime,
          arrivalTime: inboundData.arrivalTime,
          daysOfWeek: inboundData.daysOfWeek || [],
          price: inboundData.price ?? returnRoute.baseFare,
          isActive: true,
        },
      })
    ]);

    revalidatePath('/company/operator/dashboard');
    return { success: true, data: transactionResult };
  } catch (error: unknown) {
    console.error('Error creating round trip template:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getScheduleTemplates(companyId: string) {
  try {
    const templates = await prisma.scheduleTemplate.findMany({
      where: { companyId },
      include: {
        route: true,
        bus: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: templates };
  } catch (error: unknown) {
    console.error('Error fetching templates:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateScheduleTemplate(id: string, data: any) {
  try {
    const template = await prisma.scheduleTemplate.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
    revalidatePath('/company/operator/dashboard');
    return { success: true, data: template };
  } catch (error: unknown) {
    console.error('Error updating template:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteScheduleTemplate(id: string) {
  try {
    const authUser = await getCurrentUserFromServer();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }
    if (!SCHEDULE_MANAGEMENT_ROLES.includes(authUser.role ?? '')) {
      return { success: false, error: 'Forbidden' };
    }

    const template = await prisma.scheduleTemplate.findUnique({
      where: { id },
      select: { companyId: true, routeId: true },
    });
    if (!template) {
      return { success: false, error: 'Schedule template not found' };
    }

    const effectiveCompanyId = PLATFORM_WIDE_ROLES.includes(authUser.role ?? '')
      ? template.companyId
      : authUser.companyId;
    if (!effectiveCompanyId) {
      return { success: false, error: 'companyId is required' };
    }

    const routeAuthorization = await authorizeScheduleRoute(authUser, template.routeId, effectiveCompanyId);
    if (!routeAuthorization.allowed) {
      return { success: false, error: routeAuthorization.error };
    }

    await prisma.scheduleTemplate.delete({ where: { id } });
    revalidatePath('/company/operator/dashboard');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting template:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function materializeSchedules(companyId: string, routeId: string, daysAhead: number) {
  try {
    const authUser = await getCurrentUserFromServer();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }
    if (!SCHEDULE_MANAGEMENT_ROLES.includes(authUser.role ?? '')) {
      return { success: false, error: 'Forbidden' };
    }

    const effectiveCompanyId = PLATFORM_WIDE_ROLES.includes(authUser.role ?? '')
      ? companyId
      : authUser.companyId;
    if (!effectiveCompanyId) {
      return { success: false, error: 'companyId is required' };
    }

    const routeAuthorization = await authorizeScheduleRoute(authUser, routeId, effectiveCompanyId);
    if (!routeAuthorization.allowed) {
      return { success: false, error: routeAuthorization.error };
    }

    const templates = await prisma.scheduleTemplate.findMany({
      where: { 
        companyId: effectiveCompanyId, 
        isActive: true,
        ...(routeId ? { routeId } : {})
      },
      include: {
        bus: true,
        route: true
      }
    });

    if (templates.length === 0) {
      return { success: true, createdCount: 0, message: "No active blueprints found." };
    }

    // All date arithmetic uses UTC throughout to avoid server-timezone shifts.
    // Template times are stored as UTC strings (converted from local at save time
    // in UnifiedScheduleModal), so setUTCHours produces the correct UTC instant.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setUTCDate(endDate.getUTCDate() + daysAhead);

    const existingSchedules = await prisma.schedule.findMany({
      where: {
        companyId,
        ...(routeId ? { routeId } : {}),
        departureDateTime: { gte: today, lte: endDate }
      },
      select: { routeId: true, busId: true, departureDateTime: true }
    });

    const existingSchedulesForOverlap = await prisma.schedule.findMany({
      where: {
        companyId,
        status: { notIn: ['cancelled', 'archived'] },
        departureDateTime: { 
          gte: new Date(today.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(endDate.getTime() + 24 * 60 * 60 * 1000)
        }
      },
      select: { id: true, busId: true, departureDateTime: true, arrivalDateTime: true }
    });

    // Idempotency key: UTC date + UTC HH:MM + routeId + busId
    const toUTCDateStr = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;

    const existingSet = new Set(
      existingSchedules.map(s => {
        const dep = new Date(s.departureDateTime);
        const dateStr = toUTCDateStr(dep);
        const timeStr = `${String(dep.getUTCHours()).padStart(2,'0')}:${String(dep.getUTCMinutes()).padStart(2,'0')}`;
        return `${s.routeId}_${s.busId}_${dateStr}_${timeStr}`;
      })
    );

    const newSchedules: any[] = [];
    const allSchedulesToCheck = [...existingSchedulesForOverlap];

    for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
      const targetDate = new Date(today);
      targetDate.setUTCDate(targetDate.getUTCDate() + dayOffset);
      const dayOfWeek = targetDate.getUTCDay(); // UTC day — consistent with UTC midnight base

      for (const template of templates) {
        const activeDays = (template.daysOfWeek as number[]) || [];
        if (!activeDays.includes(dayOfWeek)) continue;

        // Template times are stored as UTC strings — use setUTCHours for exact match
        const [depHours, depMinutes] = template.departureTime.split(':').map(Number);
        const departureDateTime = new Date(targetDate);
        departureDateTime.setUTCHours(depHours, depMinutes, 0, 0);

        const [arrHours, arrMinutes] = template.arrivalTime.split(':').map(Number);
        const arrivalDateTime = new Date(targetDate);
        arrivalDateTime.setUTCHours(arrHours, arrMinutes, 0, 0);
        if (arrivalDateTime < departureDateTime) {
          arrivalDateTime.setUTCDate(arrivalDateTime.getUTCDate() + 1);
        }

        // Idempotency key — UTC date + UTC time string matches existingSet format
        const dateStr = toUTCDateStr(targetDate);
        const uniqueKey = `${template.routeId}_${template.busId}_${dateStr}_${template.departureTime}`;

        if (!existingSet.has(uniqueKey)) {
          const newSched = {
            companyId: effectiveCompanyId,
            busId: template.busId,
            routeId: template.routeId,
            departureDateTime,
            arrivalDateTime,
            departureLocation: template.route.origin,
            arrivalLocation: template.route.destination,
            availableSeats: template.bus.capacity,
            price: template.price,
            status: 'active',
            tripStatus: 'scheduled',
            isActive: true,
            isArchived: false,
            isCompleted: false,
          };
          
          // Overlap validation
          const newDep = newSched.departureDateTime.getTime();
          const newArr = newSched.arrivalDateTime.getTime();
          
          const conflicting = allSchedulesToCheck.find(s => {
            if (s.busId !== newSched.busId) return false;
            const sDep = s.departureDateTime.getTime();
            const sArr = s.arrivalDateTime.getTime();
            
            return sDep < (newArr + 30 * 60000) && sArr > (newDep - 30 * 60000);
          });
          
          if (conflicting) {
            throw new Error(
              `Conflict detected for bus ${template.bus.licensePlate || newSched.busId} on ${new Date(newDep).toLocaleString()}. ` +
              `It overlaps with another schedule from ${new Date(conflicting.departureDateTime).toLocaleString()} ` +
              `to ${new Date(conflicting.arrivalDateTime).toLocaleString()} (including 30m turnaround).`
            );
          }
          
          allSchedulesToCheck.push({
            id: 'new', // placeholder
            busId: newSched.busId,
            departureDateTime: newSched.departureDateTime,
            arrivalDateTime: newSched.arrivalDateTime,
          });

          newSchedules.push(newSched);
          existingSet.add(uniqueKey);
        }
      }
    }

    if (newSchedules.length > 0) {
      await prisma.schedule.createMany({ data: newSchedules });
      revalidatePath('/company/operator/dashboard');
      revalidatePath('/company/admin');
      revalidatePath('/schedules');
      revalidatePath('/');
    }

    return { success: true, createdCount: newSchedules.length };
  } catch (error: unknown) {
    console.error('Error materializing schedules:', error);
    return { success: false, error: (error as Error).message };
  }
}

