import { NextRequest, NextResponse } from 'next/server';
import { createBookingFull } from '@/lib/actions/booking.actions';

import { z } from 'zod';

const passengerDetailSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  age: z.number().int().positive().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  seatNumber: z.string().min(1, 'Seat number is required'),
  ticketType: z.enum(['adult', 'child', 'senior', 'infant']).optional(),
  phone: z.string().optional(),
  originStopId: z.string().optional(),
  destinationStopId: z.string().optional(),
  originStopName: z.string().optional(),
  destinationStopName: z.string().optional(),
});

const bookingSegmentInputSchema = z.object({
  scheduleId: z.string().uuid('Invalid scheduleId UUID format'),
  date: z.string().optional(),
  seatNumbers: z.array(z.string()).min(1, 'At least one seat number is required'),
  originStopId: z.string().optional(),
  destinationStopId: z.string().optional(),
});

const createBookingSchema = z.object({
  routeId: z.string().uuid('Invalid routeId UUID format'),
  companyId: z.string().uuid('Invalid companyId UUID format'),
  scheduleId: z.string().uuid('Invalid scheduleId UUID format').optional(),
  seatNumbers: z.array(z.string()).optional(),
  passengerDetails: z.array(passengerDetailSchema).min(1, 'At least one passenger detail is required'),
  segments: z.array(bookingSegmentInputSchema).optional(),
  originStopId: z.string().optional(),
  destinationStopId: z.string().optional(),
  promoCode: z.string().optional(),
  returnDate: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request body
    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const result = await createBookingFull(parsed.data);

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
