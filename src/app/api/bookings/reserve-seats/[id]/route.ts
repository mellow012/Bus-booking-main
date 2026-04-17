import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';

/**
 * PATCH /api/bookings/reserve-seats/[id]/release
 * Release a seat reservation
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

    const reservationId = (await params).id;

    // Get reservation and verify ownership
    const reservation = await prisma.seatReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    if (reservation.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Update reservation status
    const updated = await prisma.seatReservation.update({
      where: { id: reservationId },
      data: { status: 'released' },
    });

    return NextResponse.json({
      message: 'Reservation released',
      reservationId: updated.id,
    });
  } catch (error) {
    console.error('PATCH /api/bookings/reserve-seats/[id]/release error:', error);
    return NextResponse.json(
      { error: 'Failed to release reservation' },
      { status: 500 }
    );
  }
}
