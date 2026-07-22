'use server'

import prisma from '../prisma';
import { revalidatePath } from 'next/cache';
import { TripStatus, BusStatus } from '@/types';
import { createNotification, createActivityLog } from './activity.actions';
import { sendNotificationToUser } from '../notificationService';

/**
 * Updates the lifecycle state of a trip (Schedule).
 * Handles status transitions, bus status sync, activity logging, and operator notifications.
 */
export async function updateTripLifecycle(params: {
  scheduleId: string;
  newStatus: TripStatus;
  currentStopIndex?: number;
  currentStopId?: string;
  notes?: string;
  userId: string; // The conductor's user ID
}) {
  const { scheduleId, newStatus, currentStopIndex, currentStopId, notes, userId } = params;

  try {
    // 1. Fetch current schedule and its route/bus
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        route: {
          include: {
            operators: {
              select: { uid: true }
            }
          }
        },
        bus: true,
        bookings: {
          where: {
            bookingStatus: { in: ['confirmed', 'pending'] },
          },
          select: {
            userId: true,
          },
        },
      }
    });

    if (!schedule) throw new Error('Schedule not found');

    const updateData: any = {
      tripStatus: newStatus,
      updatedAt: new Date(),
    };

    if (currentStopIndex !== undefined) updateData.currentStopIndex = currentStopIndex;
    if (currentStopId !== undefined) updateData.currentStopId = currentStopId;
    if (notes) updateData.tripNotes = notes;

    // Handle timestamps for specific transitions
    if (newStatus === 'boarding' && !schedule.tripStartedAt) {
      updateData.tripStartedAt = new Date();
    }
    
    if (newStatus === 'completed' || (newStatus === 'arrived' && currentStopId === '__destination__')) {
       updateData.tripCompletedAt = new Date();
       updateData.isCompleted = true;
       updateData.tripStatus = 'completed';
    }

    // 2. Update Bus status if necessary
    let busStatusUpdate: BusStatus | undefined;
    if (newStatus === 'in_transit') {
      busStatusUpdate = 'on_trip';
    } else if (newStatus === 'completed' || newStatus === 'cancelled') {
      busStatusUpdate = 'active';
    }

    // 3. Perform updates in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedSchedule = await tx.schedule.update({
        where: { id: scheduleId },
        data: updateData,
      });

      if (busStatusUpdate) {
        await tx.bus.update({
          where: { id: schedule.busId },
          data: { status: busStatusUpdate },
        });
      }

      return updatedSchedule;
    });

    // 4. Log Activity
    const actionLabel = newStatus === 'boarding' ? 'STARTED BOARDING' : 
                        newStatus === 'in_transit' ? 'DEPARTED' : 
                        newStatus === 'arrived' ? 'ARRIVED AT STOP' : 
                        newStatus === 'completed' ? 'COMPLETED TRIP' : newStatus.toUpperCase();

    await createActivityLog({
      userId,
      action: `TRIP_${newStatus.toUpperCase()}`,
      description: `${actionLabel}: ${schedule.route.origin} → ${schedule.route.destination}`,
      companyId: schedule.companyId,
      scheduleId: schedule.id,
      metadata: { 
        newStatus, 
        currentStopId, 
        currentStopIndex,
        busPlate: schedule.bus.licensePlate 
      }
    });

    // 5. Notify Operators and Admins
    let recipients: string[] = schedule.route.operators.map((op: any) => op.uid).filter(Boolean);
    
    if (recipients.length === 0) {
      const companyStaff = await prisma.user.findMany({
        where: { 
          companyId: schedule.companyId, 
          role: { in: ['operator', 'company_admin'] },
          isActive: true
        },
        select: { id: true }
      });
      recipients = companyStaff.map(u => u.id);
    }

    // Remove the current user from recipients if they are in the list
    recipients = recipients.filter(id => id !== userId);

    if (recipients.length > 0) {
      const notificationPromises = recipients.map(recipientId => 
        createNotification({
          userId: recipientId,
          title: `Trip Update: ${actionLabel}`,
          message: `Bus ${schedule.bus.licensePlate} on route ${schedule.route.name} is now ${newStatus.replace('_', ' ')}.`,
          type: 'trip_update',
          data: { 
            scheduleId, 
            tripStatus: newStatus,
            currentStopId,
            licensePlate: schedule.bus.licensePlate
          }
        })
      );
      await Promise.all(notificationPromises);
    }

    // 6. Notify passengers if boarding or in_transit
    if (['boarding', 'in_transit'].includes(newStatus) && schedule.bookings && schedule.bookings.length > 0) {
      const passengerUserIds = Array.from(new Set(schedule.bookings.map((b: any) => b.userId)));
      const passengerPromises = passengerUserIds.map((passengerId: string) => {
        const title = newStatus === 'boarding' ? 'Boarding Started! 🚌' : 'Bus Departed! 🚌💨';
        const message = newStatus === 'boarding'
          ? `Boarding has started for your bus from ${schedule.route.origin} to ${schedule.route.destination}. Please proceed to the boarding area immediately.`
          : `Your bus from ${schedule.route.origin} to ${schedule.route.destination} has departed. Safe travels!`;

        return sendNotificationToUser(passengerId, {
          title,
          body: message,
          type: 'trip_update',
          priority: 'high',
          clickAction: '/bookings',
        });
      });
      await Promise.allSettled(passengerPromises);
    }

    revalidatePath('/company/conductor/dashboard');
    revalidatePath('/company/operator/dashboard');

    return { success: true, data: result as any };
  } catch (error: any) {
    console.error('Error in updateTripLifecycle:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Synchronizes the current location of the bus.
 * Usually called from the conductor's mobile device.
 * Stores updates in ActivityLog for real-time tracking.
 */
export async function syncBusLocation(params: {
  busId: string;
  scheduleId: string;
  userId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
}) {
  const { busId, scheduleId, userId, latitude, longitude, speed, heading } = params;

  try {
    // We store location in ActivityLog since Bus model lacks a dedicated metadata/location field in schema
    const log = await createActivityLog({
      userId,
      action: 'LOCATION_SYNC',
      description: `Location update`,
      scheduleId,
      metadata: { 
        busId,
        latitude, 
        longitude, 
        speed, 
        heading,
        syncedAt: new Date().toISOString()
      }
    });

    return { success: true, data: log.data };
  } catch (error: any) {
    console.error('Error syncing bus location:', error);
    return { success: false, error: error.message };
  }
}
