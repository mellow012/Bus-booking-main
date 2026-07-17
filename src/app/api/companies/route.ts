import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const companies = await prisma.company.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, logo: true },
      orderBy: { name: 'asc' }
    });
    return NextResponse.json({ success: true, data: companies });
  } catch (error: any) {
    await logger.logError('company', 'Error fetching companies', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch companies' }, { status: 500 });
  }
}
