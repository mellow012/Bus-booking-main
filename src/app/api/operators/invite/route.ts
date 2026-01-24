import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { sendOperatorInviteEmail } from '@/lib/email-service';
import { FieldValue } from 'firebase-admin/firestore';

interface InviteOperatorRequest {
  name: string;
  email: string;
  companyId: string;
  companyName: string;
  invitedBy: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  operatorId?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body: InviteOperatorRequest = await request.json();
    console.log('Invite API received:', body);

    const { name, email, companyId, companyName, invitedBy } = body;

    // 1. Validation
    const missing: string[] = [];
    if (!name?.trim()) missing.push('name');
    if (!email?.trim()) missing.push('email');
    if (!companyId?.trim()) missing.push('companyId');
    if (!invitedBy?.trim()) missing.push('invitedBy');

    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing fields: ${missing.join(', ')}`, message: '' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    
    // 2. Check for existing user
    try {
      const existingUser = await adminAuth.getUserByEmail(trimmedEmail);
      if (existingUser) {
        return NextResponse.json(
          { success: false, error: 'Email already in use in Authentication', message: '' },
          { status: 400 }
        );
      }
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') throw error;
    }

    // 3. Create Firebase Auth User (Enabled by default)
    const userRecord = await adminAuth.createUser({
      email: trimmedEmail,
      emailVerified: false,
      disabled: false, // Changed from true to false
      displayName: name.trim(),
    });

    // 4. Create document in 'users' collection with 'operator' role
    // This prevents the user from defaulting to 'customer'
    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      name: name.trim(),
      email: trimmedEmail,
      role: 'operator', // Explicitly setting the correct role
      companyId: companyId,
      passwordSet: false,
      setupCompleted: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 5. Create document in 'operators' collection
    const operatorRef = adminDb.collection('operators').doc();
    const operatorId = operatorRef.id;

    await operatorRef.set({
      id: operatorId,
      uid: userRecord.uid,
      name: name.trim(),
      email: trimmedEmail,
      role: 'operator',
      companyId: companyId,
      companyName: companyName,
      status: 'pending',
      createdBy: invitedBy,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      invitationSent: true,
      invitationSentAt: FieldValue.serverTimestamp(),
    });

    // 6. Generate Password Reset / Setup Link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // We direct them to the company setup page where we handle password setting
    const redirectUrl = new URL('/company/setup', baseUrl);
    redirectUrl.searchParams.append('operatorId', operatorId);
    redirectUrl.searchParams.append('email', trimmedEmail);

    const actionCodeSettings = {
      url: redirectUrl.toString(),
      handleCodeInApp: true,
    };

    const inviteLink = await adminAuth.generatePasswordResetLink(trimmedEmail, actionCodeSettings);

    // 7. Send the Email
    await sendOperatorInviteEmail(
      trimmedEmail,
      name.trim(),
      companyName,
      inviteLink,
      operatorId
    );

    return NextResponse.json({
      success: true,
      message: 'Operator invitation sent successfully!',
      operatorId,
    });

  } catch (error: any) {
    console.error('Error inviting operator:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to invite operator', message: '' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}