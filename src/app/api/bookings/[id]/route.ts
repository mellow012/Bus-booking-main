import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/bookings/[id]
 * Fetch a single booking
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookingId = (await params).id;
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        schedule: {
          include: {
            route: true,
            bus: true,
            company: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Verify ownership
    if (booking.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({
      data: booking,
    });
  } catch (error) {
    await logger.logError('booking', 'GET /api/bookings/[id] error', error);
    return NextResponse.json(
      { error: 'Failed to fetch booking' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/bookings/[id]
 * Update booking (payment status, method, etc)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookingId = (await params).id;
    const body = await req.json();

    // Fetch booking to verify ownership
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update only allowed fields
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        // DO NOT allow updating paymentStatus or bookingStatus via client PATCH.
        // These must be updated via payment webhooks or admin actions only.
        ...(body.paymentMethod && { paymentMethod: body.paymentMethod }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      data: updated,
    });
  } catch (error) {
    await logger.logError('booking', 'PATCH /api/bookings/[id] error', error);
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bookings/[id]
 * Delete a cancelled booking (soft delete)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookingId = (await params).id;

    // Fetch booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Verify ownership
    if (booking.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Only allow deletion of cancelled bookings
    if (booking.bookingStatus !== 'cancelled') {
      return NextResponse.json(
        { error: 'Only cancelled bookings can be deleted' },
        { status: 400 }
      );
    }

    // Soft delete - mark as deleted
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        bookingStatus: 'deleted',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Booking deleted successfully',
    });
  } catch (error) {
    await logger.logError('booking', 'DELETE /api/bookings/[id] error', error);
    return NextResponse.json(
      { error: 'Failed to delete booking' },
      { status: 500 }
    );
  }
}
