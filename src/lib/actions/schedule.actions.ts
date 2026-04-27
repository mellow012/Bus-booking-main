'use server'

import prisma from '../prisma';
import { revalidatePath } from 'next/cache';
import { Schedule, ScheduleStatus, TripStatus } from '@/types';

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
  try {
    const schedule = await prisma.schedule.create({
      data: {
        id: data.id,
        companyId: data.companyId,
        busId: data.busId,
        routeId: data.routeId,
        departureDateTime: new Date(data.departureDateTime),
        arrivalDateTime: new Date(data.arrivalDateTime),
        availableSeats: data.availableSeats,
        bookedSeats: data.bookedSeats || [],
        price: data.price,
        status: (data.status as ScheduleStatus) || 'active',
        tripStatus: (data.tripStatus as TripStatus) || 'scheduled',
      },
    });
    revalidatePath('/company/operator/dashboard');
    return { success: true, data: (schedule as any) as Schedule };
  } catch (error: unknown) {
    console.error('Error creating schedule:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateSchedule(id: string, data: Partial<Schedule>) {
  try {
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
