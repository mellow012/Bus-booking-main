import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { sendPasswordResetEmail } from '@/lib/email-service';
import { FieldValue } from 'firebase-admin/firestore';

interface CreateCompanyRequest {
  companyName: string;
  companyEmail: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminPhone?: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  companyId?: string;
  adminUserId?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body: CreateCompanyRequest = await request.json();
    const { 
      companyName, 
      companyEmail, 
      adminFirstName = '', 
      adminLastName = '', 
      adminPhone = '' 
    } = body;

    if (!companyName?.trim() || !companyEmail?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Company name and email are required', message: '' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(companyEmail.trim())) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address', message: '' },
        { status: 400 }
      );
    }

    const trimmedEmail = companyEmail.trim().toLowerCase();

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
      firstName: adminFirstName.trim(),
      lastName: adminLastName.trim(),
      phone: adminPhone.trim(),
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