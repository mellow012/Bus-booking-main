import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST — submit a review for a completed booking
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;
    const body = await request.json();
    const { rating, reviewText } = body;

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be a number between 1 and 5' },
        { status: 400 }
      );
    }

    // Verify the booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        companyId: true,
        bookingStatus: true,
        reviewRating: true,
        schedule: {
          select: { companyId: true, arrivalDateTime: true, tripStatus: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Only allow reviews on confirmed or completed bookings where the trip has completed
    const schedule = booking.schedule;
    const arrivalTime = schedule?.arrivalDateTime ? new Date(schedule.arrivalDateTime) : null;
    const now = new Date();
    const tripCompleted =
      !schedule ||
      schedule.tripStatus === 'completed' ||
      (arrivalTime !== null && !isNaN(arrivalTime.getTime()) && arrivalTime < now) ||
      process.env.NODE_ENV === 'development';

    if (booking.bookingStatus !== 'confirmed' && booking.bookingStatus !== 'completed') {
      console.warn(`[POST Review] Booking ${bookingId} has invalid status: ${booking.bookingStatus}`);
      return NextResponse.json(
        { error: `Reviews are only available for confirmed or completed bookings (current status: ${booking.bookingStatus})` },
        { status: 400 }
      );
    }

    if (!tripCompleted) {
      console.warn(`[POST Review] Booking ${bookingId} trip not completed yet. Arrival: ${arrivalTime}, Status: ${schedule?.tripStatus}`);
      return NextResponse.json(
        { error: 'Reviews can only be submitted after the trip is complete' },
        { status: 400 }
      );
    }

    if (booking.reviewRating) {
      console.warn(`[POST Review] Booking ${bookingId} already reviewed`);
      return NextResponse.json(
        { error: 'You have already reviewed this booking' },
        { status: 400 }
      );
    }

    // Update the booking with the review
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        reviewRating: Math.round(rating),
        reviewText: typeof reviewText === 'string' ? reviewText.trim().slice(0, 500) : null,
      },
    });

    // Recalculate company aggregate rating dynamically from all reviewed bookings for this company
    try {
      const companyId = booking.companyId || booking.schedule?.companyId;
      if (companyId) {
        const ratingAgg = await prisma.booking.aggregate({
          where: {
            companyId,
            reviewRating: { not: null },
          },
          _avg: { reviewRating: true },
          _count: { reviewRating: true },
        });

        const avgRating = ratingAgg._avg.reviewRating
          ? Math.round(ratingAgg._avg.reviewRating * 10) / 10
          : Math.round(rating);
        const totalReviews = ratingAgg._count.reviewRating || 1;

        // Fetch current company metadata to preserve existing fields
        const companyData = await prisma.company.findUnique({
          where: { id: companyId },
          select: { contactSettings: true },
        });

        const currentContact = (companyData?.contactSettings as Record<string, any>) || {};

        await prisma.company.update({
          where: { id: companyId },
          data: {
            contactSettings: {
              ...currentContact,
              rating: avgRating,
              totalReviews: totalReviews,
            },
          },
        });
      }
    } catch (calcError) {
      console.error('Failed to recalculate company rating:', calcError);
    }

    return NextResponse.json({ success: true, message: 'Review submitted successfully' });
  } catch (error) {
    console.error('POST /api/bookings/[id]/review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
