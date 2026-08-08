import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: busId } = await params;

    if (!busId) {
      return NextResponse.json({ error: 'Bus ID is required' }, { status: 400 });
    }

    // Fetch all bookings for this bus that have a review rating
    const busReviews = await prisma.booking.findMany({
      where: {
        schedule: { busId },
        reviewRating: { not: null },
      },
      select: {
        reviewRating: true,
        reviewText: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            profilePicture: true,
          }
        },
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20, // Limit to 20 recent reviews for performance
    });

    let totalRating = 0;
    let count = 0;
    const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    busReviews.forEach((review) => {
      if (review.reviewRating != null && review.reviewRating > 0) {
        const rating = Number(review.reviewRating);
        totalRating += rating;
        count += 1;
        if (rating >= 1 && rating <= 5) {
          ratingBreakdown[rating as keyof typeof ratingBreakdown] += 1;
        }
      }
    });

    const averageRating = count > 0 ? Number((totalRating / count).toFixed(1)) : 0;

    return NextResponse.json({
      success: true,
      data: {
        averageRating,
        count,
        ratingBreakdown,
        reviews: busReviews.filter(r => r.reviewText || (r.reviewRating && r.reviewRating > 0)).map(r => ({
          rating: Number(r.reviewRating),
          text: r.reviewText,
          authorName: r.user ? `${r.user.firstName} ${r.user.lastName}` : 'Anonymous',
          authorAvatar: (r.user as any)?.profilePicture || null,
          date: r.createdAt.toISOString(),
        })),
      }
    });
  } catch (error: any) {
    logger.logError('api', 'Failed to fetch bus reviews', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reviews', message: error.message },
      { status: 500 }
    );
  }
}
