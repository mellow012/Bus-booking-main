import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { sendOperatorInviteEmail } from '@/lib/email-service';
import { FieldValue } from 'firebase-admin/firestore';

interface ResendInviteRequest {
  operatorId: string;
  email: string;
  name: string;
  companyId: string;
  companyName: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body: ResendInviteRequest = await request.json();
    const { operatorId, email, name, companyId, companyName } = body;

    if (!operatorId || !email || !name || !companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields', message: '' },
        { status: 400 }
      );
    }

    const operatorDoc = await adminDb.collection('operators').doc(operatorId).get();

    if (!operatorDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Operator not found', message: '' },
        { status: 404 }
      );
    }

    const operatorData = operatorDoc.data();

    if (operatorData?.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Operator already registered', message: '' },
        { status: 400 }
      );
    }

    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await adminAuth.createUser({
          email,
          emailVerified: false,
          disabled: true,
        });

        await adminDb.collection('operators').doc(operatorId).update({
          uid: userRecord.uid,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        throw error;
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUrl = new URL('/operator/signup', baseUrl);
    redirectUrl.searchParams.append('operatorId', operatorId);
    redirectUrl.searchParams.append('email', email);

    const actionCodeSettings = {
      url: redirectUrl.toString(),
      handleCodeInApp: true,
    };

    const inviteLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);

    await sendOperatorInviteEmail(email, name, companyName, inviteLink, operatorId);

    await adminDb.collection('operators').doc(operatorId).update({
      invitationSentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation resent successfully!',
    });

  } catch (error: any) {
    console.error('Error resending invitation:', error);

    let errorMessage = 'Failed to resend invitation';
    if (error.message) errorMessage = error.message;

    return NextResponse.json(
      { success: false, error: errorMessage, message: '' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}