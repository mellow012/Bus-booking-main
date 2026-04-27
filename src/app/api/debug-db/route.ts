import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
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
