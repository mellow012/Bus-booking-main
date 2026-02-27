import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { sendPasswordResetEmail } from '@/lib/email-service';
import { FieldValue } from 'firebase-admin/firestore';
import { apiRateLimiter, getClientIp } from '@/lib/rateLimiter';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { companyNameSchema, emailSchema, phoneSchema } from '@/lib/validationSchemas';

const createCompanySchema = z.object({
  companyName: companyNameSchema,
  companyEmail: emailSchema,
  adminFirstName: z.string().max(50).trim().default(''),
  adminLastName: z.string().max(50).trim().default(''),
  adminPhone: z.string().max(20).trim().default(''),
}).strict();

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
    const rateLimitResult = apiRateLimiter.check(ip);

    if (!rateLimitResult.allowed) {
      console.warn(`[RATE LIMIT] Too many company creation requests from ${ip}`);
      return NextResponse.json(
        {
          success: false,
          message: `Too many requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          error: 'Rate limit exceeded',
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
          },
        }
      );
    }

    // ─── Validation ──────────────────────────────────────────────────────────
    try {
      const body = await request.json();
      var { companyName, companyEmail, adminFirstName, adminLastName, adminPhone } = 
        createCompanySchema.parse(body);
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
            error: error.issues[0]?.message || 'Validation failed' 
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const trimmedEmail = companyEmail.toLowerCase();

    let existingUser = null;
    try {
      existingUser = await adminAuth.getUserByEmail(trimmedEmail);
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') throw error;
    }

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already in use by a user', message: '' },
        { status: 400 }
      );
    }

    const existingCompanies = await adminDb
      .collection('companies')
      .where('email', '==', trimmedEmail)
      .limit(1)
      .get();

    if (!existingCompanies.empty) {
      return NextResponse.json(
        { success: false, error: 'Email already in use by a company', message: '' },
        { status: 400 }
      );
    }

    const companyRef = adminDb.collection('companies').doc();
    const companyId = companyRef.id;

    const userRecord = await adminAuth.createUser({
      email: trimmedEmail,
      emailVerified: false,
      disabled: false,
    });

    const batch = adminDb.batch();

    batch.set(companyRef, {
      name: companyName.trim(),
      email: trimmedEmail,
      adminUserId: userRecord.uid,
      status: 'pending',
      setupCompleted: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      maxBuses: 3,
      businessDetails: {
        address: '',
        phone: '',
        license: '',
        description: '',
        routes: []
      }
    });

    const userRef = adminDb.collection('users').doc(userRecord.uid);
    batch.set(userRef, {
      email: trimmedEmail,
      firstName: (adminFirstName || '').trim(),
      lastName: (adminLastName || '').trim(),
      phone: (adminPhone || '').trim(),
      role: 'company_admin',
      companyId,
      passwordSet: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUrl = new URL('/company/setup', baseUrl);
    redirectUrl.searchParams.append('companyId', companyId);

    const actionCodeSettings = {
      url: redirectUrl.toString(),
      handleCodeInApp: true, // Ensure oobCode is appended
    };

    const passwordResetLink = await adminAuth.generatePasswordResetLink(trimmedEmail, actionCodeSettings);
    await sendPasswordResetEmail(trimmedEmail, companyName.trim(), passwordResetLink, companyId);

    return NextResponse.json({
      success: true,
      message: 'Company created and setup email sent!',
      companyId,
      adminUserId: userRecord.uid
    });

  } catch (error: any) {
    console.error('Error creating company:', error);

    let errorMessage = 'Failed to create company';
    if (error.code === 'auth/email-already-in-use') errorMessage = 'Email already in use';
    else if (error.code === 'auth/invalid-email') errorMessage = 'Invalid email';
    else if (error.message && error.message.includes('continue URL must be a valid URL string')) 
      errorMessage = 'Invalid NEXT_PUBLIC_APP_URL. Check .env.local';
    else if (error.message) errorMessage = error.message;

    return NextResponse.json(
      { success: false, error: errorMessage, message: '' },
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