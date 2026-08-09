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
      conductorIds, images
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
        images: images || [],
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
      id: _, createdAt, updatedAt, companyId, metadata, ...updatableData
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
      id, companyId, regionId, name, origin, destination, distance, duration,
      baseFare, pricePerKm, stops, isActive, status
    } = data;

    const route = await prisma.route.create({
      data: {
        id,
        companyId: companyId!,
        regionId,
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
      }
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
      assignedOperatorIds, assignedConductorIds,
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
    await prisma.$transaction(
      async (tx) => {
        // ── Count check + delete are a single atomic unit ──────────────────
        // SERIALIZABLE isolation means no concurrent transaction can INSERT a
        // Schedule with this routeId between our count read and the DELETE.
        const scheduleCount = await tx.schedule.count({ where: { routeId: id } });
        if (scheduleCount > 0) {
          throw new Error(
            `Cannot delete route: ${scheduleCount} schedule${
              scheduleCount !== 1 ? 's' : ''
            } reference this route. Archive or reassign them first.`
          );
        }

        const bookingCount = await tx.booking.count({ where: { routeId: id } });
        if (bookingCount > 0) {
          throw new Error(
            `Cannot delete route: ${bookingCount} booking${
              bookingCount !== 1 ? 's' : ''
            } are linked to this route.`
          );
        }

        await tx.route.delete({ where: { id } });
      },
      { isolationLevel: 'Serializable' }
    );

    revalidatePath('/company/operator/dashboard');
    return { success: true };
  } catch (error: unknown) {
    const msg = (error as Error).message;
    console.error('Error deleting route:', msg);
    return { success: false, error: msg };
  }
}

export async function deleteBranch(id: string) {
  try {
    await prisma.$transaction(
      async (tx) => {
        // ── Count check + delete are a single atomic unit ──────────────────
        const routeCount = await tx.route.count({ where: { regionId: id } });
        if (routeCount > 0) {
          throw new Error(
            `Cannot delete branch: ${routeCount} route${
              routeCount !== 1 ? 's' : ''
            } are assigned to this branch. Reassign or move them first.`
          );
        }

        const operatorCount = await tx.operator.count({ where: { regionId: id } });
        if (operatorCount > 0) {
          throw new Error(
            `Cannot delete branch: ${operatorCount} operator${
              operatorCount !== 1 ? 's' : ''
            } are assigned to this branch. Reassign them first.`
          );
        }

        await tx.region.delete({ where: { id } });
      },
      { isolationLevel: 'Serializable' }
    );

    revalidatePath('/company/operator/dashboard');
    return { success: true };
  } catch (error: unknown) {
    const msg = (error as Error).message;
    console.error('Error deleting branch:', msg);
    return { success: false, error: msg };
  }
}
