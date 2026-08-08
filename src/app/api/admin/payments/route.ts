import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
  try {
    const auth = await getCurrentUser(request as any);
    if (!auth || (auth.role !== 'superadmin' && auth.role !== 'company_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const companyId = searchParams.get('companyId');

    const payments = await prisma.payment.findMany({
      where: {
        ...(companyId ? {
          booking: {
            companyId: companyId
          }
        } : {}),
      },
      include: {
        booking: {
          include: {
            company: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ data: payments });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}
