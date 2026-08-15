import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const booking = await prisma.booking.findFirst({
      where: { bookingReference: 'BK-EDLLQ9' },
      include: { chatterSchedule: true }
    });
    return NextResponse.json({ booking });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
