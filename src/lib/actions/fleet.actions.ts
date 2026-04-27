'use server'

import prisma from '../prisma';
import { revalidatePath } from 'next/cache';
import { Bus, Route } from '@/types';

/**
 * --- Buses ---
 */
export async function createBus(data: Partial<Bus>) {
  try {
    const {
      id, companyId, licensePlate, busType, capacity, amenities,
      status, yearOfManufacture, registrationDetails, isActive,
      fuelType, insuranceDetails, lastMaintenanceDate, nextMaintenanceDate,
      conductorIds
    } = data;

    const bus = await prisma.bus.create({
      data: {
        id,
        companyId: companyId!,
        licensePlate: licensePlate!,
        busType: busType!,
        capacity: capacity!,
        amenities: amenities as any,
        status: status || 'active',
        yearOfManufacture,
        registrationDetails: registrationDetails as any,
        isActive: isActive ?? true,
        fuelType,
        insuranceDetails: insuranceDetails as any,
        lastMaintenanceDate: lastMaintenanceDate ? new Date(lastMaintenanceDate) : null,
        nextMaintenanceDate: nextMaintenanceDate ? new Date(nextMaintenanceDate) : null,
        conductorIds: conductorIds || [],
      } as any
    });
    revalidatePath('/company/operator/dashboard');
    return { success: true, data: bus as unknown as Bus };
  } catch (error: unknown) {
    console.error('Error creating bus:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateBus(id: string, data: Partial<Bus>) {
  try {
    const {
      id: _, createdAt, updatedAt, companyId, images, metadata, ...updatableData
    } = data as any;

    const bus = await prisma.bus.update({
      where: { id },
      data: {
        ...updatableData,
        lastMaintenanceDate: updatableData.lastMaintenanceDate ? new Date(updatableData.lastMaintenanceDate) : undefined,
        nextMaintenanceDate: updatableData.nextMaintenanceDate ? new Date(updatableData.nextMaintenanceDate) : undefined,
        updatedAt: new Date(),
      }
    });
    revalidatePath('/company/operator/dashboard');
    return { success: true, data: bus as unknown as Bus };
  } catch (error: unknown) {
    console.error('Error updating bus:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteBus(id: string) {
  try {
    await prisma.bus.delete({ where: { id } });
    revalidatePath('/company/operator/dashboard');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting bus:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * --- Routes ---
 */
export async function createRoute(data: Partial<Route>) {
  try {
    const {
      id, companyId, name, origin, destination, distance, duration,
      baseFare, pricePerKm, stops, isActive, status,
      assignedOperatorIds, assignedConductorIds
    } = data;

    const route = await prisma.route.create({
      data: {
        id,
        companyId: companyId!,
        name: name!,
        origin: origin!,
        destination: destination!,
        distance: distance!,
        duration: duration!,
        baseFare: baseFare!,
        pricePerKm,
        stops: stops as any,
        isActive: isActive ?? true,
        status: status ?? 'active',
        assignedOperatorIds: assignedOperatorIds || [],
        assignedConductorIds: assignedConductorIds || [],
      } as any
    });
    revalidatePath('/company/operator/dashboard');
    return { success: true, data: route as unknown as Route };
  } catch (error: unknown) {
    console.error('Error creating route:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateRoute(id: string, data: Partial<Route>) {
  try {
    const {
      id: _, createdAt, updatedAt, companyId,
      assignedOperators, associatedBusIds, metadata,
      ...updatableData
    } = data as any;

    const route = await prisma.route.update({
      where: { id },
      data: {
        ...updatableData,
        updatedAt: new Date(),
      }
    });
    revalidatePath('/company/operator/dashboard');
    return { success: true, data: route as unknown as Route };
  } catch (error: unknown) {
    console.error('Error updating route:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteRoute(id: string) {
  try {
    await prisma.route.delete({ where: { id } });
    revalidatePath('/company/operator/dashboard');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting route:', error);
    return { success: false, error: (error as Error).message };
  }
}
