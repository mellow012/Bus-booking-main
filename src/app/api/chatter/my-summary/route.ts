import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromServer } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getCurrentUserFromServer();
    if (!user) {
      return NextResponse.json({ chatterScheduleCount: 0, chatterRequestCount: 0 });
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [chatterScheduleCount, chatterRequestCount, bookedChatterCount] = await Promise.all([
      prisma.chatterSchedule.count({
        where: {
          repUserId: user.id,
          status: 'active',
          isArchived: false,
          travelDate: { gte: todayStart },
        },
      }),
      prisma.groupCharterRequest.count({
        where: {
          userId: user.id,
          charterSource: 'chatter',
          status: { in: ['pending', 'approved', 'confirmed'] },
          departureDate: { gte: todayStart },
        },
      }),
      prisma.booking.count({
        where: {
          userId: user.id,
          chatterScheduleId: { not: null },
          bookingStatus: { notIn: ['cancelled', 'expired'] },
          chatterSchedule: {
            isArchived: false,
            status: 'active',
            travelDate: { gte: todayStart },
          },
        },
      }),
    ]);

    const hasActiveCharter = (chatterScheduleCount + chatterRequestCount + bookedChatterCount) > 0;

    return NextResponse.json({
      success: true,
      hasActiveCharter,
      chatterScheduleCount,
      chatterRequestCount,
      bookedChatterCount,
    });
  } catch (error: any) {
    console.error('Error fetching chatter my-summary:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
