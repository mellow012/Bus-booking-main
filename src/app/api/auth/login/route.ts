// src/app/api/auth/login/route.ts
//
// NOTE: This route handles company activation after login.
// It is protected to only allow company_admin role.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

interface PostLoginRequest {
  companyId: string;
  action: 'activate_company';
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Missing or invalid authentication session',
      }, { status: 401 });
    }

    const body: PostLoginRequest = await req.json();
    const { companyId, action } = body;

    if (!companyId || !action) {
      return NextResponse.json({
        error: 'Bad request',
        message: 'Missing required fields: companyId and action',
      }, { status: 400 });
    }

    // Role and permission check
    if (user.role !== 'company_admin' || user.companyId !== companyId) {
      return NextResponse.json({
        error: 'Forbidden',
        message: 'Insufficient permissions to perform this action',
      }, { status: 403 });
    }

    if (action === 'activate_company') {
      await activateCompany(companyId);
    } else {
      return NextResponse.json({
        error: 'Bad request',
        message: `Unknown action: ${action}`,
      }, { status: 400 });
    }

    console.log(`Action '${action}' completed for company ${companyId} by user ${user.id}`);

    return NextResponse.json({
      success: true,
      message: 'Action completed successfully',
    }, { status: 200 });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
    }, { status: 500 });
  }
}

/**
 * Helper function to perform the company activation in PostgreSQL
 */
async function activateCompany(companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId }
  });

  if (!company) {
    throw new Error(`Company ${companyId} not found`);
  }

  if (company.status === 'pending') {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        status: 'active',
        updatedAt: new Date(),
        // activatedAt: new Date(), // If we had this field, but Prisma schema shows updatedAt
      }
    });
    console.log(`Company ${companyId} activated successfully.`);
  } else {
    console.log(`Company ${companyId} status is already '${company.status}'. No action taken.`);
  }
}
