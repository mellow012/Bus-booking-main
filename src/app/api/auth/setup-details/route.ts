import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/auth/setup-details
 * Fetches company or operator details based on ID and type.
 * Used by /company/setup and /conductor/setup pages to display info 
 * and verify valid setup links before allowing password creation.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type') || 'company';

    if (!id) {
      return NextResponse.json(
        { error: 'Bad request', message: 'ID is required' },
        { status: 400 }
      );
    }

    // ─── Company Setup ────────────────────────────────────────────────────────
    if (type === 'company') {
      const company = await prisma.company.findUnique({
        where: { id },
        include: {
          staff: {
            where: { role: 'company_admin' },
            take: 1,
            select: { id: true }
          }
        }
      });

      if (!company) {
        return NextResponse.json(
          { error: 'Not found', message: 'Company record not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        id: company.id,
        name: company.name,
        email: company.email,
        targetUserId: company.staff[0]?.id || null,
        companyId: company.id,
      });
    }

    // ─── Operator/Conductor Setup ──────────────────────────────────────────────
    if (type === 'operator' || type === 'conductor') {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          companyId: true,
          role: true,
        }
      });

      if (!user) {
        return NextResponse.json(
          { error: 'Not found', message: 'User record not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim() || 'New Staff',
        email: user.email,
        targetUserId: user.id,
        companyId: user.companyId,
      });
    }

    return NextResponse.json(
      { error: 'Bad request', message: 'Invalid setup type' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('[setup-details] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message || 'Failed to fetch setup details' },
      { status: 500 }
    );
  }
}
