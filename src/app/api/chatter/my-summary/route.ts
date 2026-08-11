import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromServer } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getCurrentUserFromServer();
    if (!user) {
      return NextResponse.json({ chatterScheduleCount: 0, chatterRequestCount: 0 });
    }

    const [chatterScheduleCount, chatterRequestCount] = await Promise.all([
      prisma.chatterSchedule.count({
        where: { repUserId: user.id },
      }),
      prisma.groupCharterRequest.count({
        where: {
          userId: user.id,
          charterSource: 'chatter',
        },
      }),
    ]);

    return NextResponse.json({
      chatterScheduleCount,
      chatterRequestCount,
    });
  } catch (error: any) {
    console.error('Error fetching chatter my-summary:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
