import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const companies = await prisma.company.count();
    const buses = await prisma.bus.count();
    const routes = await prisma.route.count();
    const schedules = await prisma.schedule.count();
    
    const sampleSchedule = await prisma.schedule.findFirst({
      include: {
        route: true,
        company: true,
        bus: true
      }
    });

    return NextResponse.json({
      success: true,
      counts: {
        companies,
        buses,
        routes,
        schedules
      },
      sampleSchedule
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
