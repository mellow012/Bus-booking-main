import { NextRequest, NextResponse } from 'next/server';
import { createChatterSchedule } from '@/lib/actions/chatter.actions';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const origin = searchParams.get('from');
    const destination = searchParams.get('to');
    const date = searchParams.get('date');

    const where: any = {
      status: 'active',
    };

    if (origin) where.origin = { contains: origin, mode: 'insensitive' };
    if (destination) where.destination = { contains: destination, mode: 'insensitive' };
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.travelDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const schedules = await prisma.chatterSchedule.findMany({
      where,
      orderBy: { travelDate: 'asc' },
    });

    return NextResponse.json({ success: true, data: schedules });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await createChatterSchedule(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
