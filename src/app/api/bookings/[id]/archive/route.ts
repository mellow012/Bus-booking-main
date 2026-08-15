import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/bookings/[id]/archive
 * Manually archive a concluded booking
 */
export async function POST(
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
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Verify ownership
    if (booking.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Only allow archiving of already concluded bookings
    if (!['cancelled', 'completed', 'payment_failed', 'expired'].includes(booking.bookingStatus)) {
      return NextResponse.json(
        { error: 'Only cancelled, completed, or failed bookings can be archived manually' },
        { status: 400 }
      );
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        bookingStatus: 'archived',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Booking archived successfully',
    });
  } catch (error) {
    await logger.logError('booking', 'POST /api/bookings/[id]/archive error', error);
    return NextResponse.json(
      { error: 'Failed to archive booking' },
      { status: 500 }
    );
  }
}
