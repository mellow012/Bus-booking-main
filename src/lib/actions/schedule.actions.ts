'use server'

import prisma from '../prisma';
import { revalidatePath } from 'next/cache';
import { Schedule, ScheduleStatus, TripStatus } from '@/types';
import { serverCache } from '../cache';
import { Prisma } from '@prisma/client';

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
        { departureDateTime: { lt: arrivalDateTime } },
        { arrivalDateTime: { gt: departureDateTime } },
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
export async function createSchedule(data: Partial<Schedule> & {
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
  try {
    await assertBusNotOverlapping(prisma, data.busId, dep, arr);

    const schedule = await prisma.schedule.create({
      data: {
        id: data.id,
        companyId: data.companyId,
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
    serverCache.invalidate('schedules');
    revalidatePath('/company/operator/dashboard');
    return { success: true, data: (schedule as any) as Schedule };
  } catch (error: unknown) {
    console.error('Error creating schedule:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function createRoundTripSchedule(outboundData: any, inboundData: any) {
  try {
    // Look up the return route
    const outboundRoute = await prisma.route.findUnique({ where: { id: outboundData.routeId } });
    if (!outboundRoute) throw new Error("Outbound route not found");

    const returnRoute = await prisma.route.findFirst({
      where: {
        companyId: outboundData.companyId,
        origin: outboundRoute.destination,
        destination: outboundRoute.origin,
        isActive: true,
      },
    });

    if (!returnRoute) {
      throw new Error(`Return route (${outboundRoute.destination} to ${outboundRoute.origin}) not found. Please create this route first.`);
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
          companyId: outboundData.companyId,
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
          companyId: inboundData.companyId,
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

    serverCache.invalidate('schedules');
    revalidatePath('/company/operator/dashboard');
    return { success: true, data: transactionResult };
  } catch (error: unknown) {
    console.error('Error creating round trip schedules:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateSchedule(id: string, data: Partial<Schedule>) {
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
    serverCache.invalidate('schedules');
    revalidatePath('/company/conductor/dashboard');
    revalidatePath('/company/operator/dashboard');
    return { success: true, data: (schedule as any) as Schedule };
  } catch (error: unknown) {
    console.error('Error updating schedule:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteSchedule(id: string) {
  try {
    await prisma.schedule.delete({ where: { id } });
    serverCache.invalidate('schedules');
    revalidatePath('/company/conductor/dashboard');
    revalidatePath('/company/operator/dashboard');
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
    const template = await prisma.scheduleTemplate.create({
      data: {
        companyId: data.companyId,
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
    // Look up the return route
    const outboundRoute = await prisma.route.findUnique({ where: { id: outboundData.routeId } });
    if (!outboundRoute) throw new Error("Outbound route not found");

    const returnRoute = await prisma.route.findFirst({
      where: {
        companyId: outboundData.companyId,
        origin: outboundRoute.destination,
        destination: outboundRoute.origin,
        isActive: true,
      },
    });

    if (!returnRoute) {
      throw new Error(`Return route (${outboundRoute.destination} to ${outboundRoute.origin}) not found. Please create this route first.`);
    }

    const transactionResult = await prisma.$transaction([
      prisma.scheduleTemplate.create({
        data: {
          companyId: outboundData.companyId,
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
          companyId: inboundData.companyId,
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
    const templates = await prisma.scheduleTemplate.findMany({
      where: { 
        companyId, 
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
          newSchedules.push({
            companyId: template.companyId,
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
          });
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

