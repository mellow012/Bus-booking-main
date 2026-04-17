import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tripId = searchParams.get('tripId');

    if (!tripId) {
      return NextResponse.json({ success: false, error: 'tripId is required' }, { status: 400 });
    }

    // Fetch the schedule and its bookings directly from DB
    const trip = await prisma.schedule.findUnique({
      where: { id: tripId },
      include: {
        bookings: true
      }
    });

    if (!trip) {
      return NextResponse.json({ success: false, error: 'Trip not found' }, { status: 404 });
    }

    // Process bookings to generate summary
    const validBookings = trip.bookings.filter(b => b.bookingStatus !== 'cancelled');
    const boarded = validBookings.filter(b => b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed');
    const noShow = validBookings.filter(b => b.bookingStatus === 'no-show');

    // In our schema, walkons might be designated by a boolean flag or bookedBy field
    // We accommodate both patterns below.
    const walkOns = validBookings.filter(b => {
      const dbBooking = b as any;
      return dbBooking.isWalkOn === true || dbBooking.bookedBy === 'conductor';
    });

    const expectedRevenue = validBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const cashCollectedBookings = boarded.filter(b => b.paymentStatus === 'paid' && ((b as any).paymentMethod === 'cash' || !(b as any).paymentMethod)); // Assuming default walkon is cash if undefined
    const cashCollected = cashCollectedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const summary = {
      expectedRevenue,
      cashCollected,
      totalBoarded: boarded.length,
      totalNoShow: noShow.length,
      walkOns: walkOns.length,
    };

    return NextResponse.json({
      success: true,
      summary,
      tripDetails: {
        status: trip.tripStatus,
        completedAt: (trip as any).tripCompletedAt,
        departureLocation: trip.departureLocation,
        arrivalLocation: trip.arrivalLocation,
      }
    });

  } catch (error: any) {
    console.error('[Conductor Summary] Error:', error);
    await logger.logError('api', 'Failed to generate trip summary', error, {
      action: 'conductor_summary_error',
    });

    return NextResponse.json(
      { success: false, error: 'Failed to fetch summary data' },
      { status: 500 }
    );
  }
}
