'use server'

import prisma from '../prisma';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { Booking, BookingStatus } from '@/types';

/**
 * --- Bookings ---
 */
export async function getBookingsForSchedule(scheduleId: string) {
  try {
    const bookings = await prisma.booking.findMany({
      where: { scheduleId },
      include: {
        schedule: {
          include: {
            route: true,
            bus: true
          }
        },
        user: true
      }
    });
    return { success: true, data: bookings as any[] };
  } catch (error: unknown) {
    console.error('Error fetching bookings for schedule:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function createBooking(data: Partial<Booking> & {
  bookingReference: string;
  scheduleId: string;
  companyId: string;
  routeId: string;
  totalAmount: number;
  passengerDetails: any[];
  seatNumbers: string[];
  contactEmail?: string;
  contactPhone: string;
}) {
  try {
    const booking = await prisma.booking.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        bookingReference: data.bookingReference,
        totalAmount: data.totalAmount,
        currency: data.currency || 'MWK',
        bookingStatus: data.bookingStatus || 'pending',
        paymentStatus: data.paymentStatus || 'pending',
        passengerDetails: data.passengerDetails as any,
        seatNumbers: data.seatNumbers as any,
        contactEmail: data.contactEmail || '',
        contactPhone: data.contactPhone,
        bookingDate: data.bookingDate ? new Date(data.bookingDate) : new Date(),
        routeId: data.routeId,
        
        // Relations using connect
        company: { connect: { id: data.companyId } },
        schedule: { connect: { id: data.scheduleId } },
        user: { connect: { id: data.userId || (data as any).bookedBy || data.companyId } }, // Fallback for walk-on

        // Walk-on specific fields
        ...((data as any).isWalkOn !== undefined ? { isWalkOn: (data as any).isWalkOn } : {}),
        ...((data as any).bookedBy !== undefined ? { bookedBy: (data as any).bookedBy } : {}),
        ...((data as any).originStopId !== undefined ? { originStopId: (data as any).originStopId } : {}),
        ...((data as any).destinationStopId !== undefined ? { destinationStopId: (data as any).destinationStopId } : {}),
        ...((data as any).paidAt !== undefined ? { paidAt: (data as any).paidAt } : {}),
        
        ...((data as any).paymentMethod !== undefined ? {
          payments: {
            create: [{
              paymentId: `PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
              amount: data.totalAmount || 0,
              currency: data.currency || 'MWK',
              paymentType: (data as any).paymentMethod,
              provider: (data as any).paymentMethod,
              status: data.paymentStatus || 'pending',
              txRef: `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            }]
          }
        } : {}),
      },
      include: { payments: true }
    });
    revalidatePath('/bookings');
    revalidatePath('/company/conductor/dashboard');
    revalidatePath('/company/admin');
    return { success: true, data: (booking as any) as Booking };
  } catch (error: unknown) {
    console.error('Error creating booking:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateBooking(id: string, data: Partial<Booking>) {
  try {
    const { id: _, createdAt, updatedAt, ...updatableData } = data;
    const booking = await prisma.booking.update({
      where: { id },
      data: {
        ...(updatableData as any),
        paidAt: updatableData.paidAt ? new Date(updatableData.paidAt) : undefined,
        updatedAt: new Date(),
        ...((updatableData as any).paymentMethod !== undefined ? {
          payments: {
            create: [{
              paymentId: `PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
              amount: 0, // In update, we don't have totalAmount easily, but we just need the record
              currency: 'MWK',
              paymentType: (updatableData as any).paymentMethod,
              provider: (updatableData as any).paymentMethod,
              status: updatableData.paymentStatus || 'paid',
              txRef: `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            }]
          }
        } : {}),
      },
      include: { payments: true }
    });
    revalidatePath('/bookings');
    revalidatePath('/company/conductor/dashboard');
    return { success: true, data: (booking as any) as Booking };
  } catch (error: unknown) {
    console.error('Error updating booking:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function cancelBooking(bookingId: string, scheduleId: string, seatNumbers: string[]) {
  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Update booking status
      const booking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          bookingStatus: 'cancelled',
          cancellationDate: new Date(),
        },
      });

      // 2. Release seats in schedule
      await tx.schedule.update({
        where: { id: scheduleId },
        data: {
          availableSeats: { increment: seatNumbers.length },
        },
      });

      return booking;
    });

    revalidatePath('/bookings');
    revalidatePath('/admin');
    return { success: true, data: result };
  } catch (error: unknown) {
    console.error('Error cancelling booking:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteBooking(id: string) {
  try {
    await prisma.booking.delete({ where: { id } });
    revalidatePath('/bookings');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting booking:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getUserBookings(userId: string) {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: userId },
      include: {
        schedule: {
          include: {
            route: true,
            bus: true
          }
        },
        company: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    return { success: true, data: bookings as unknown[] };
  } catch (error: unknown) {
    console.error('Error fetching user bookings:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * --- Seat Reservations ---
 */
export async function createSeatReservation(data: {
  scheduleId: string;
  userId: string;
  seatNumbers: string[];
  status?: string;
}) {
  try {
    const reservation = await (prisma as unknown as {
      seatReservation: { create: (o: object) => Promise<unknown> }
    }).seatReservation.create({
      data: {
        scheduleId: data.scheduleId,
        userId: data.userId,
        seatNumbers: data.seatNumbers,
        status: data.status || 'reserved',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 mins default
      },
    });
    return { success: true, data: reservation };
  } catch (error: unknown) {
    console.error('Error creating reservation:', error);
    return { success: false, error: (error as Error).message };
  }
}
