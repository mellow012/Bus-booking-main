import { NextRequest, NextResponse } from 'next/server';
import { createBookingFull } from '@/lib/actions/booking.actions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await createBookingFull(body);

    if (result.error) {
      const message = result.error.toLowerCase();
      const status = message.includes('unauthorized')
        ? 401
        : message.includes('not found') || message.includes('schedule') || message.includes('route')
          ? 404
          : message.includes('required') || message.includes('must') || message.includes('invalid') || message.includes('remaining')
            ? 400
            : 500;

      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      bookingId: result.bookingId,
      bookingReference: result.bookingReference,
      totalAmount: result.totalAmount,
      discountAmount: result.discountAmount,
      appliedPromo: result.appliedPromo,
      baseFare: result.baseFare,
      fullTripFare: result.fullTripFare,
      fareSource: result.fareSource,
      currency: result.currency,
      isSegment: result.isSegment,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create booking' },
      { status: 500 }
    );
  }
}
