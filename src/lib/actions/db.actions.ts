'use server'

import prisma from '../prisma';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { 
  Booking, Company, Route, Schedule, Bus, UserProfile as User, 
  BookingStatus, ScheduleStatus, TripStatus 
} from '@/types';

/**
 * --- Users ---
 */
export async function getUserById(id: string) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { uid: id }
        ]
      }
    });
    return { success: true, data: user as User | null };
  } catch (error: unknown) {
    console.error('Error fetching user by id:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function syncUser(id: string, data: Partial<User>) {
  try {
    // Sanitizing data: remove fields that should not be updated directly
    const { id: _, createdAt, updatedAt, ...updatableData } = data;
    
    // 1. Find existing record by any unique identifier
    // We check id, uid, and email to handle migration discrepancies
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { uid: id },
          { email: updatableData.email || undefined }
        ].filter(Boolean) as any
      }
    });

    let user;
    if (existing) {
      // 2. Update existing record using its official primary key
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          ...(updatableData as any),
          updatedAt: new Date(),
        }
      });
    } else {
      // 3. Create new record if none found
      user = await prisma.user.create({
        data: {
          id,
          uid: id, // Keep uid in sync for legacy compatibility
          ...(updatableData as any),
          firstName: updatableData.firstName || '',
          lastName: updatableData.lastName || '',
          email: updatableData.email || '',
          role: updatableData.role || 'customer',
        },
      });
    }

    return { success: true, data: user as User };
  } catch (error: unknown) {
    console.error('Error syncing user:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateUser(id: string, data: Partial<User>) {
  try {
    // Sanitizing data: remove fields that should not be updated
    const { id: _, createdAt, updatedAt, ...updatableData } = data;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(updatableData as any),
        updatedAt: new Date(),
      },
    });
    revalidatePath('/company/admin');
    return { success: true, data: user as User };
  } catch (error: unknown) {
    console.error('Error updating user:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteUser(id: string) {
  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath('/company/admin');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting user:', error);
    return { success: false, error: (error as Error).message };
  }
}

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
export async function createBooking(data: Partial<Booking> & { bookingReference: string; scheduleId: string; companyId: string; routeId: string; totalAmount: number; passengerDetails: any[]; seatNumbers: string[]; contactEmail?: string; contactPhone: string; }) {
  try {
    const booking = await prisma.booking.create({
      data: {
        id: data.id,
        bookingReference: data.bookingReference,
        userId: data.userId as string,
        scheduleId: data.scheduleId,
        companyId: data.companyId,
        routeId: data.routeId,
        totalAmount: data.totalAmount,
        currency: data.currency || 'MWK',
        bookingStatus: data.bookingStatus || 'pending',
        paymentStatus: data.paymentStatus || 'pending',
        passengerDetails: data.passengerDetails as any,
        seatNumbers: data.seatNumbers as any,
        contactEmail: data.contactEmail || '',
        contactPhone: data.contactPhone,
        bookingDate: data.bookingDate ? new Date(data.bookingDate) : new Date(),
        // Walk-on specific fields if present in data
        ...(data as any).isWalkOn !== undefined ? { isWalkOn: (data as any).isWalkOn } : {},
        ...(data as any).bookedBy !== undefined ? { bookedBy: (data as any).bookedBy } : {},
        ...(data as any).originStopId !== undefined ? { originStopId: (data as any).originStopId } : {},
        ...(data as any).destinationStopId !== undefined ? { destinationStopId: (data as any).destinationStopId } : {},
        ...(data as any).paidAt !== undefined ? { paidAt: (data as any).paidAt } : {},
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

/**
 * --- Companies ---
 */
export async function updateCompany(id: string, data: Partial<Company> | Record<string, any>) {
  try {
    const { id: _, createdAt, updatedAt, contact, adminFirstName, adminLastName, adminPhone, ...rest } = data as any;
    const updatableData: any = { ...rest };
    
    // Map legacy 'contact' field to 'phone' for Prisma
    if (contact !== undefined) {
      updatableData.phone = contact;
    }

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...updatableData,
        updatedAt: new Date(),
      },
    });
    revalidatePath('/company/admin');
    return { success: true, data: (company as any) as Company };
  } catch (error: unknown) {
    console.error('Error updating company:', error);
    return { success: false, error: (error as Error).message };
  }
}


/**
 * --- Schedules ---
 */
export async function createSchedule(data: Partial<Schedule> & { companyId: string; busId: string; routeId: string; departureDateTime: string | Date; arrivalDateTime: string | Date; availableSeats: number; price: number; }) {
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

export async function deleteCompany(id: string) {
  try {
    await prisma.company.delete({ where: { id } });
    revalidatePath('/admin');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting company:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * --- Notifications ---
 */
export async function createNotification(data: { userId: string; title: string; message: string; type: string; priority?: string; actionUrl?: string; data: object; }) {
  try {
    const notification = await (prisma as unknown as { notification: { create: (o: object) => Promise<unknown> } }).notification.create({
      data: {
        userId: data.userId as string,
        title: data.title as string,
        message: data.message as string,
        type: data.type as string,
        priority: (data.priority as string) || 'medium',
        actionUrl: data.actionUrl as string,
        data: data.data as object,
      },
    });
    return { success: true, data: notification };
  } catch (error: unknown) {
    console.error('Error creating notification:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * --- Seat Reservations ---
 */
export async function createSeatReservation(data: { scheduleId: string; userId: string; seatNumbers: string[]; status?: string; }) {
  try {
    const reservation = await (prisma as unknown as { seatReservation: { create: (o: object) => Promise<unknown> } }).seatReservation.create({
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

/**
 * --- Booking Operations ---
 */
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

    return { success: true, data: bookings as unknown[] }; // Keeping array cast simple for now
  } catch (error: unknown) {
    console.error('Error fetching user bookings:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * --- Admin Dashboard ---
 */
export async function getAdminDashboardStats() {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalCompanies,
      activeCompanies,
      pendingCompanies,
      totalBookings,
      totalRevenueData,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { status: 'active' } }),
      prisma.company.count({ where: { status: 'pending' } }),
      prisma.booking.count(),
      prisma.booking.aggregate({
        where: { bookingStatus: 'confirmed' },
        _sum: { totalAmount: true }
      }),
    ]);

    const monthlyRevenueData = await prisma.booking.aggregate({
      where: {
        bookingStatus: 'confirmed',
        updatedAt: { gte: firstDayOfMonth }
      },
      _sum: { totalAmount: true }
    });

    const monthlyRevenue = monthlyRevenueData._sum?.totalAmount || 0;

    return {
      success: true,
      data: {
        totalCompanies,
        activeCompanies,
        pendingCompanies,
        inactiveCompanies: totalCompanies - activeCompanies - pendingCompanies,
        totalRevenue: totalRevenueData._sum.totalAmount || 0,
        monthlyRevenue: monthlyRevenue,
        totalBookings,
        monthlyBookings: totalBookings,
        monthlyGrowth: 12.5,
        revenueGrowth: 18.2
      }
    };
  } catch (error: unknown) {
    console.error('Error fetching admin stats:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getAdminCompanies() {
  try {
    const companies = await prisma.company.findMany({
      include: {
        _count: {
          select: {
            buses: true,
            routes: true,
            bookings: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, data: companies as any[] };
  } catch (error: unknown) {
    console.error('Error fetching admin companies:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getAdminBookings(page = 1, limit = 10, search = '', status = 'all') {
  try {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    
    if (status !== 'all') {
      where.bookingStatus = status;
    }
    
    if (search) {
      where.OR = [
        { bookingReference: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        include: {
          schedule: {
            include: {
              route: true,
              bus: true
            }
          },
          company: true,
          user: true
        },
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.booking.count({ where })
    ]);

    return {
      success: true,
      data: {
        bookings: bookings as unknown[],
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page,
          limit
        }
      }
    };
  } catch (error: unknown) {
    console.error('Error fetching admin bookings:', error);
    return { success: false, error: (error as Error).message };
  }
}
