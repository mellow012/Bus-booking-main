import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { sendPasswordResetEmail } from '@/lib/email-service';
import { authRateLimiter, getClientIp } from '@/lib/rateLimiter';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { companyNameSchema, emailSchema, phoneSchema } from '@/lib/validationSchemas';

const createCompanySchema = z.object({
  companyName:    companyNameSchema,
  companyEmail:   emailSchema,
  adminFirstName: z.string().max(50).trim().default(''),
  adminLastName:  z.string().max(50).trim().default(''),
  adminPhone:     z.string().max(20).trim().default(''),
});

interface ApiResponse {
  success: boolean;
  message: string;
  companyId?: string;
  adminUserId?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    // ─── Rate Limiting ───────────────────────────────────────────────────────
    const ip = getClientIp(request);
    const rateLimit = await authRateLimiter.limit(ip);

    if (!rateLimit.success) {
      const retryAfter = Math.ceil((rateLimit.reset - Date.now()) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests',
          message: `Too many requests. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        } as any,
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      );
    }

    // ─── Validation ──────────────────────────────────────────────────────────
    let companyName: string;
    let companyEmail: string;
    let adminFirstName: string;
    let adminLastName: string;
    let adminPhone: string;

    try {
      const body = await request.json();
      ({ companyName, companyEmail, adminFirstName, adminLastName, adminPhone } =
        createCompanySchema.parse(body));
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        await logger.logWarning('api', 'Company creation validation failed', {
          ip,
          action: 'company_create_validation_error',
          metadata: {
            issues: error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
          },
        });
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid request data',
            error: error.issues[0]?.message || 'Validation failed',
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const trimmedEmail = companyEmail.toLowerCase();
    const adminClient = createAdminClient();

    // ─── Duplicate checks ────────────────────────────────────────────────────
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) throw listError;
    
    const existingUser = users.find(u => u.email === trimmedEmail);
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already in use by a user', message: '' },
        { status: 400 }
      );
    }

    const existingCompany = await prisma.company.findFirst({
      where: { email: trimmedEmail }
    });

    if (existingCompany) {
      return NextResponse.json(
        { success: false, error: 'Email already in use by a company', message: '' },
        { status: 400 }
      );
    }

    // ─── Create Supabase Auth user ───────────────────────────────────────────
    const { data: { user: userRecord }, error: createError } = await adminClient.auth.admin.createUser({
      email: trimmedEmail,
      email_confirm: false,
    });

    if (createError || !userRecord) {
      throw createError || new Error('Failed to create auth user');
    }

    // ─── Write records using Prisma transaction ─────────────────────────────
    let companyId: string;
    try {
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const company = await tx.company.create({
          data: {
            name: companyName.trim(),
            email: trimmedEmail,
            status: 'pending',
            setupCompleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            maxBuses: 3,
          },
        });

        await tx.user.create({
          data: {
            id: userRecord.id,
            uid: userRecord.id,
            email: trimmedEmail,
            firstName: (adminFirstName || '').trim(),
            lastName: (adminLastName || '').trim(),
            phone: (adminPhone || '').trim(),
            role: 'company_admin',
            companyId: company.id,
            passwordSet: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        return company;
      });

      companyId = result.id;
    } catch (error: any) {
      // Rollback: delete the Auth user if transaction fails
      await adminClient.auth.admin.deleteUser(userRecord.id).catch(() => {});
      throw error;
    }

    // ─── Send setup email ────────────────────────────────────────────────────
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    if (!baseUrl.startsWith('http')) {
      baseUrl = 'http://localhost:3000';
    }
    const redirectUrl = new URL('/company/setup', baseUrl);
    redirectUrl.searchParams.append('companyId', companyId);

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: trimmedEmail,
      options: { redirectTo: redirectUrl.toString() },
    });

    if (linkError || !linkData.properties?.hashed_token) {
      throw linkError || new Error('Failed to generate setup link');
    }

    const tokenHash = linkData.properties.hashed_token;
    redirectUrl.searchParams.append('token_hash', tokenHash);
    
    // Send our safe setup link rather than the raw single-use Supabase action_link
    const passwordResetLink = redirectUrl.toString();
    await sendPasswordResetEmail(trimmedEmail, companyName.trim(), passwordResetLink, companyId);

    return NextResponse.json({
      success: true,
      message: 'Company created and setup email sent!',
      companyId,
      adminUserId: userRecord.id,
    });

  } catch (error: any) {
    console.error('Error creating company:', error);

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create company', message: '' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
