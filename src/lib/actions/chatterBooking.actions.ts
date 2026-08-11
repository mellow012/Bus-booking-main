'use server';

import prisma from '../prisma';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { getCurrentUserFromServer } from '@/lib/auth-utils';
import { sendNotificationToUser } from '@/lib/notificationService';
import { logger } from '@/lib/logger';

function generateBookingReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = 'BK-';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

export async function createChatterBooking(payload: {
  chatterScheduleId: string;
  seatNumbers: string[];
  passengerDetails: Array<{
    firstName: string;
    lastName: string;
    age?: number;
    gender?: string;
    seatNumber: string;
  }>;
  contactPhone: string;
}) {
  try {
    const authUser = await getCurrentUserFromServer();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    const userData = await prisma.user.findFirst({
      where: { OR: [{ id: authUser.id }, { uid: authUser.id }] },
    });
    if (!userData) {
      return { success: false, error: 'User profile not found in database.' };
    }

    const { chatterScheduleId, seatNumbers, passengerDetails, contactPhone } = payload;

    if (!chatterScheduleId || !seatNumbers || seatNumbers.length === 0 || !passengerDetails || passengerDetails.length === 0) {
      return { success: false, error: 'All fields are required.' };
    }

    const passengerCount = passengerDetails.length;
    if (seatNumbers.length !== passengerCount) {
      return { success: false, error: 'Seat count must match passenger details count.' };
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch and lock ChatterSchedule
      const chatterSchedule = await tx.chatterSchedule.findUnique({
        where: { id: chatterScheduleId },
      });

      if (!chatterSchedule) {
        throw new Error('Chatter schedule not found.');
      }

      if (chatterSchedule.status !== 'active') {
        throw new Error('This schedule is no longer active for booking.');
      }

      // 2. Fetch existing bookings for this schedule to check seat conflicts
      const existingBookings = await tx.booking.findMany({
        where: {
          chatterScheduleId,
          bookingStatus: { not: 'cancelled' },
        },
        select: {
          seatNumbers: true,
        },
      });

      const parseSeatArray = (val: unknown): string[] => {
        if (Array.isArray(val)) return val.filter((s): s is string => typeof s === 'string');
        if (typeof val === 'string') {
          try {
            const p = JSON.parse(val);
            if (Array.isArray(p)) return p.filter((s): s is string => typeof s === 'string');
          } catch { return []; }
        }
        return [];
      };

      const bookedSeats = existingBookings.flatMap(b => parseSeatArray(b.seatNumbers));
      const conflicts = seatNumbers.filter(s => bookedSeats.includes(s));
      if (conflicts.length > 0) {
        throw new Error(`Seats already booked: ${conflicts.join(', ')}`);
      }

      const bookedSeatsCount = bookedSeats.length;
      if (chatterSchedule.totalSeats - bookedSeatsCount < passengerCount) {
        throw new Error('Not enough seats available on this schedule.');
      }

      const totalAmount = chatterSchedule.fare * passengerCount;
      const bookingReference = generateBookingReference();

      const normalisedPassengers = passengerDetails.map((p) => ({
        name: `${p.firstName} ${p.lastName}`.trim() || p.firstName,
        age: p.age ?? 0,
        gender: p.gender ?? 'other',
        seatNumber: p.seatNumber,
        ticketType: 'adult',
        originStopId: '__origin__',
        destinationStopId: '__destination__',
        originStopName: chatterSchedule.origin,
        destinationStopName: chatterSchedule.destination,
      }));

      // Create Booking (companyId is null)
      const booking = await tx.booking.create({
        data: {
          bookingReference,
          userId: userData.id,
          chatterScheduleId,
          totalAmount,
          currency: 'MWK',
          bookingStatus: 'pending',
          paymentStatus: 'pending',
          passengerDetails: normalisedPassengers as any,
          seatNumbers: seatNumbers as any,
          contactEmail: userData.email || '',
          contactPhone,
          bookingDate: new Date(),
        },
      });

      return booking;
    });

    // Send notification
    try {
      await sendNotificationToUser(userData.id, {
        title: 'Booking created',
        body: `Your booking ${result.bookingReference} for Chatter bus is pending payment.`,
        type: 'booking',
        priority: 'high',
        clickAction: `/bookings/${result.id}`,
        data: { bookingId: result.id, chatterScheduleId },
      });
    } catch (nErr) {
      console.warn('Failed to send notification:', nErr);
    }

    try {
      await logger.logBooking('created', result.id, {
        userId: userData.id,
        metadata: { bookingReference: result.bookingReference, totalAmount: result.totalAmount, chatterScheduleId },
      });
    } catch (lErr) {
      console.warn('Failed to log booking activity:', lErr);
    }

    revalidatePath('/bookings');
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error creating chatter booking:', error);
    return { success: false, error: error.message || 'Internal server error' };
  }
}

export async function getBookingsForChatterSchedule(chatterScheduleId: string) {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        chatterScheduleId,
        bookingStatus: { not: 'cancelled' },
      },
      include: {
        user: true,
      },
      orderBy: { bookingDate: 'desc' },
    });
    return { success: true, data: bookings };
  } catch (error: any) {
    console.error('Error getting bookings for chatter schedule:', error);
    return { success: false, error: error.message };
  }
}
