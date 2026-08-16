'use server';

import prisma from '../prisma';
import { toDate } from '@/lib/chatterHelpers';
import { revalidatePath } from 'next/cache';
import { getCurrentUserFromServer } from '@/lib/auth-utils';

export async function createChatterSchedule(payload: {
  busName: string;
  origin: string;
  destination: string;
  travelDate: string;
  departureTime: string;
  arrivalTime?: string;
  fare: number;
  totalSeats: number;
  contactPhone: string;
  pickupPoint?: string;
  dropoffPoint?: string;
  notes?: string;
  images?: string[];
}) {
  try {
    const user = await getCurrentUserFromServer();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const travelDateObj = toDate(payload.travelDate);
    if (!travelDateObj) return { success: false, error: 'Invalid travelDate' };

    const chatterSchedule = await prisma.chatterSchedule.create({
      data: {
        repUserId: user.id,
        busName: payload.busName,
        origin: payload.origin,
        destination: payload.destination,
        travelDate: travelDateObj,
        departureTime: payload.departureTime,
        arrivalTime: payload.arrivalTime || null,
        fare: payload.fare,
        totalSeats: payload.totalSeats,
        contactPhone: payload.contactPhone,
        pickupPoint: payload.pickupPoint,
        dropoffPoint: payload.dropoffPoint,
        notes: payload.notes,
        images: payload.images || [],
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
        bookingStatus: { in: ['pending', 'confirmed', 'completed'] },
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

    // If pickup/dropoff are not set on the schedule, try to parse them from any
    // related groupCharterRequest.notes (we store them there when requests are created).
    let pickupPoint: string | null | undefined = schedule.pickupPoint;
    let dropoffPoint: string | null | undefined = schedule.dropoffPoint;

    if ((!pickupPoint || !dropoffPoint) && schedule) {
      try {
        // Try to find a related group charter request in two ways:
        // 1. direct link via resultingScheduleId (if any)
        // 2. a request by the same rep user with matching origin/destination
        //    and a departureDate near the schedule travel date (±12 hours).
        const travelDateObj = toDate(schedule.travelDate);
        let windowStart: Date | undefined;
        let windowEnd: Date | undefined;
        if (travelDateObj) {
          windowStart = new Date(travelDateObj);
          windowStart.setHours(windowStart.getHours() - 12);
          windowEnd = new Date(travelDateObj);
          windowEnd.setHours(windowEnd.getHours() + 12);
        }

        const relatedReq = await prisma.groupCharterRequest.findFirst({
          where: {
            OR: [
              { resultingScheduleId: schedule.id },
              ...(windowStart && windowEnd ? [{
                userId: schedule.repUserId,
                origin: schedule.origin,
                destination: schedule.destination,
                departureDate: {
                  gte: windowStart,
                  lte: windowEnd,
                },
              }] : []),
            ],
          },
          orderBy: { createdAt: 'desc' },
          select: { pickupPoint: true, dropoffPoint: true, notes: true },
        });

        if (relatedReq) {
          if (relatedReq.pickupPoint) pickupPoint = relatedReq.pickupPoint;
          if (relatedReq.dropoffPoint) dropoffPoint = relatedReq.dropoffPoint;

          if ((!pickupPoint || !dropoffPoint) && relatedReq.notes) {
            const notes = relatedReq.notes;
            const pickupMatch = notes.match(/Pickup:\s*(.*)/i);
            const dropoffMatch = notes.match(/Drop-?off:\s*(.*)/i);
            if (!pickupPoint && pickupMatch && pickupMatch[1]) pickupPoint = pickupMatch[1].trim();
            if (!dropoffPoint && dropoffMatch && dropoffMatch[1]) dropoffPoint = dropoffMatch[1].trim();
          }
        }
      } catch (e) {
        // Non-fatal: if this query fails we'll still return the schedule but
        // leave pickup/dropoff as-is (likely null).
      }
    }

    return {
      success: true,
      data: {
        ...schedule,
        pickupPoint,
        dropoffPoint,
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
        where: { repUserId: user.id, isArchived: false },
        include: {
          bookings: {
            where: {
              bookingStatus: { notIn: ['cancelled'] },
            },
            select: {
              seatNumbers: true,
              paymentStatus: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
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

    // Aggregate booking counts across all the rep's schedules for the stats bar
    const scheduleIds = schedules.map((s) => s.id);
    let totalBooked = 0;
    let totalPaid = 0;
    if (scheduleIds.length > 0) {
      const [bookedCount, paidCount] = await Promise.all([
        prisma.booking.count({
          where: {
            chatterScheduleId: { in: scheduleIds },
            bookingStatus: { notIn: ['cancelled'] },
          },
        }),
        prisma.booking.count({
          where: {
            chatterScheduleId: { in: scheduleIds },
            paymentStatus: 'paid',
          },
        }),
      ]);
      totalBooked = bookedCount;
      totalPaid = paidCount;
    }

    return {
      success: true,
      data: {
        schedules,
        requests,
        stats: { totalBooked, totalPaid },
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
  departureTime: string;
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

    const travelDateObj = toDate(payload.travelDate);
    if (!travelDateObj) return { success: false, error: 'Invalid travelDate' };

    const request = await prisma.groupCharterRequest.create({
      data: {
        userId: user.id,
        organizerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Representative',
        organizerPhone: payload.contactPhone,
        origin: payload.origin,
        destination: payload.destination,
        departureDate: travelDateObj,
        estimatedPax: payload.seatsRequested || 0,
        status: 'pending',
        charterType: 'group',
        notes: combinedNotes,
        seatsRequested: payload.seatsRequested,
        proposedFare: payload.proposedFare,
        contactPhone: payload.contactPhone,
        pickupPoint: payload.pickupPoint,
        dropoffPoint: payload.dropoffPoint,
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
    const depObj = toDate(payload.departureDateTime);
    const arrObj = toDate(payload.arrivalDateTime);
    if (!depObj || !arrObj) return { success: false, error: 'Invalid departure/arrival date' };

    const schedule = await prisma.schedule.create({
      data: {
        companyId,
        busId: payload.busId,
        routeId: payload.routeId,
        departureDateTime: depObj,
        arrivalDateTime: arrObj,
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

export async function deleteChatterSchedule(id: string) {
  try {
    const user = await getCurrentUserFromServer();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const schedule = await prisma.chatterSchedule.findUnique({
      where: { id },
      select: { repUserId: true },
    });

    if (!schedule) {
      return { success: false, error: 'Schedule not found' };
    }

    if (schedule.repUserId !== user.id && user.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    // Instead of actual deletion, mark as cancelled to preserve booking relations
    const updated = await prisma.chatterSchedule.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    revalidatePath('/chatter/my-schedules');
    return { success: true, data: updated };
  } catch (error: any) {
    console.error('Error deleting chatter schedule:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Permanently hard-delete a cancelled ChatterSchedule.
 * Blocked if any booking on the schedule has paymentStatus 'paid' or 'pending'.
 * Bookings with paymentStatus 'failed' are cascade-deleted freely.
 */
export async function hardDeleteChatterSchedule(id: string) {
  try {
    const user = await getCurrentUserFromServer();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const schedule = await prisma.chatterSchedule.findUnique({
      where: { id },
      select: { repUserId: true, status: true },
    });

    if (!schedule) {
      return { success: false, error: 'Schedule not found' };
    }

    if (schedule.repUserId !== user.id && user.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    if (schedule.status !== 'cancelled') {
      return {
        success: false,
        error: 'Only cancelled schedules can be permanently deleted. Use the cancel action first.',
      };
    }

    // Guard: block hard-delete if any booking is still paid or pending
    const blockingBookings = await prisma.booking.findMany({
      where: {
        chatterScheduleId: id,
        paymentStatus: { in: ['paid', 'pending'] },
      },
      select: { id: true, paymentStatus: true },
    });

    if (blockingBookings.length > 0) {
      const paidCount = blockingBookings.filter((b) => b.paymentStatus === 'paid').length;
      const pendingCount = blockingBookings.filter((b) => b.paymentStatus === 'pending').length;

      const parts: string[] = [];
      if (paidCount > 0) parts.push(`${paidCount} paid booking${paidCount > 1 ? 's' : ''}`);
      if (pendingCount > 0) parts.push(`${pendingCount} pending booking${pendingCount > 1 ? 's' : ''}`);

      return {
        success: false,
        error: `This schedule has ${parts.join(' and ')} and cannot be permanently deleted. Refund or resolve those bookings first.`,
      };
    }

    // Safe to delete — only failed bookings remain (cascade handled by DB relation)
    await prisma.booking.deleteMany({
      where: { chatterScheduleId: id },
    });

    await prisma.chatterSchedule.delete({ where: { id } });

    revalidatePath('/chatter/my-schedules');
    return { success: true };
  } catch (error: any) {
    console.error('Error hard-deleting chatter schedule:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Soft-archive a ChatterSchedule (called by the cron job).
 * Sets isArchived = true and stamps archivedAt.
 */
export async function archiveChatterSchedule(id: string) {
  try {
    const updated = await prisma.chatterSchedule.update({
      where: { id },
      data: { isArchived: true, archivedAt: new Date() },
    });
    revalidatePath('/chatter/my-schedules');
    return { success: true, data: updated };
  } catch (error: any) {
    console.error('Error archiving chatter schedule:', error);
    return { success: false, error: error.message };
  }
}
