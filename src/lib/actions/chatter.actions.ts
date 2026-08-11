'use server';

import prisma from '../prisma';
import { revalidatePath } from 'next/cache';
import { getCurrentUserFromServer } from '@/lib/auth-utils';

export async function createChatterSchedule(payload: {
  busName: string;
  origin: string;
  destination: string;
  travelDate: string;
  fare: number;
  totalSeats: number;
  contactPhone: string;
}) {
  try {
    const user = await getCurrentUserFromServer();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const chatterSchedule = await prisma.chatterSchedule.create({
      data: {
        repUserId: user.id,
        busName: payload.busName,
        origin: payload.origin,
        destination: payload.destination,
        travelDate: new Date(payload.travelDate),
        fare: payload.fare,
        totalSeats: payload.totalSeats,
        contactPhone: payload.contactPhone,
        status: 'active',
      },
    });

    revalidatePath('/chatter/my-schedules');
    return { success: true, data: chatterSchedule };
  } catch (error: any) {
    console.error('Error creating chatter schedule:', error);
    return { success: false, error: error.message || 'Internal server error' };
  }
}

export async function getChatterSchedule(id: string) {
  try {
    const schedule = await prisma.chatterSchedule.findUnique({
      where: { id },
      include: {
        rep: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!schedule) {
      return { success: false, error: 'Chatter schedule not found' };
    }

    // Calculate available seats: totalSeats - booked count
    const bookings = await prisma.booking.findMany({
      where: {
        chatterScheduleId: id,
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

    const bookedSeats = bookings.flatMap(b => parseSeatArray(b.seatNumbers));
    const bookedSeatsCount = bookedSeats.length;
    const availableSeats = Math.max(0, schedule.totalSeats - bookedSeatsCount);

    return {
      success: true,
      data: {
        ...schedule,
        availableSeats,
        bookedSeatsCount,
        bookedSeats,
      },
    };
  } catch (error: any) {
    console.error('Error fetching chatter schedule:', error);
    return { success: false, error: error.message };
  }
}

export async function getRepChatterSchedules() {
  try {
    const user = await getCurrentUserFromServer();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const [schedules, requests] = await Promise.all([
      prisma.chatterSchedule.findMany({
        where: { repUserId: user.id },
        orderBy: { travelDate: 'desc' },
      }),
      prisma.groupCharterRequest.findMany({
        where: {
          userId: user.id,
          charterSource: 'chatter',
        },
        include: {
          resultingSchedule: {
            include: {
              company: true,
              route: true,
            },
          },
          company: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      success: true,
      data: {
        schedules,
        requests,
      },
    };
  } catch (error: any) {
    console.error('Error fetching rep chatter schedules:', error);
    return { success: false, error: error.message };
  }
}

export async function createChatterRequest(payload: {
  companyId: string;
  origin: string;
  destination: string;
  pickupPoint?: string;
  dropoffPoint?: string;
  travelDate: string;
  seatsRequested: number;
  proposedFare: number;
  contactPhone: string;
  notes?: string;
}) {
  try {
    const user = await getCurrentUserFromServer();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Combine pickup/dropoff points into the notes field since the schema does not have these fields
    let combinedNotes = payload.notes || 'Chatter Request';
    if (payload.pickupPoint || payload.dropoffPoint) {
      combinedNotes = `${combinedNotes}\n\n[Logistics Details]\nPickup: ${payload.pickupPoint || 'Not specified'}\nDrop-off: ${payload.dropoffPoint || 'Not specified'}`;
    }

    const request = await prisma.groupCharterRequest.create({
      data: {
        userId: user.id,
        organizerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Representative',
        organizerPhone: payload.contactPhone,
        origin: payload.origin,
        destination: payload.destination,
        departureDate: new Date(payload.travelDate),
        estimatedPax: payload.seatsRequested || 0,
        status: 'pending',
        charterType: 'group',
        notes: combinedNotes,
        seatsRequested: payload.seatsRequested,
        proposedFare: payload.proposedFare,
        contactPhone: payload.contactPhone,
        charterSource: 'chatter',
        companyId: payload.companyId,
      },
    });

    revalidatePath('/chatter/my-schedules');
    return { success: true, data: request };
  } catch (error: any) {
    console.error('Error creating chatter request:', error);
    return { success: false, error: error.message };
  }
}

export async function getChatterRequestsForCompany(companyId: string) {
  try {
    const requests = await prisma.groupCharterRequest.findMany({
      where: {
        companyId,
        charterSource: 'chatter',
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: requests };
  } catch (error: any) {
    console.error('Error fetching company chatter requests:', error);
    return { success: false, error: error.message };
  }
}

export async function confirmChatterRequest(payload: {
  requestId: string;
  busId: string;
  routeId: string;
  departureDateTime: string;
  arrivalDateTime: string;
  confirmedPrice: number;
}) {
  try {
    const user = await getCurrentUserFromServer();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const request = await prisma.groupCharterRequest.findUnique({
      where: { id: payload.requestId },
    });

    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    const companyId = request.companyId;
    if (!companyId) {
      return { success: false, error: 'Request has no associated company' };
    }

    // 1. Create a real Schedule row
    const schedule = await prisma.schedule.create({
      data: {
        companyId,
        busId: payload.busId,
        routeId: payload.routeId,
        departureDateTime: new Date(payload.departureDateTime),
        arrivalDateTime: new Date(payload.arrivalDateTime),
        price: payload.confirmedPrice,
        availableSeats: request.seatsRequested || request.estimatedPax || 40,
        status: 'active',
        tripStatus: 'scheduled',
      },
    });

    // 2. Update GroupCharterRequest
    const updatedRequest = await prisma.groupCharterRequest.update({
      where: { id: payload.requestId },
      data: {
        status: 'confirmed',
        confirmedPrice: payload.confirmedPrice,
        resultingScheduleId: schedule.id,
      },
    });

    revalidatePath('/company/admin');
    return { success: true, data: updatedRequest };
  } catch (error: any) {
    console.error('Error confirming chatter request:', error);
    return { success: false, error: error.message };
  }
}

export async function declineChatterRequest(requestId: string) {
  try {
    const user = await getCurrentUserFromServer();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const updatedRequest = await prisma.groupCharterRequest.update({
      where: { id: requestId },
      data: {
        status: 'declined',
      },
    });

    revalidatePath('/company/admin');
    return { success: true, data: updatedRequest };
  } catch (error: any) {
    console.error('Error declining chatter request:', error);
    return { success: false, error: error.message };
  }
}
