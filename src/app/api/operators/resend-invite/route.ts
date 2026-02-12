import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { sendOperatorInviteEmail } from '@/lib/email-service';
import { FieldValue } from 'firebase-admin/firestore';

type TeamRole = 'operator' | 'conductor';

interface ResendInviteRequest {
  operatorId: string;
  email: string;
  name: string;
  role?: TeamRole;
  companyId: string;
  companyName: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  error?: string;
}

const VALID_ROLES: TeamRole[] = ['operator', 'conductor'];

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body: ResendInviteRequest = await request.json();
    const { operatorId, email, name, companyId, companyName } = body;
    const role: TeamRole = VALID_ROLES.includes(body.role as TeamRole) ? (body.role as TeamRole) : 'operator';

    // Validation
    if (!operatorId || !email || !companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: operatorId, email, companyId', message: '' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Verify the team member document exists
    const memberDoc = await adminDb.collection('operators').doc(operatorId).get();
    if (!memberDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Team member not found', message: '' },
        { status: 404 }
      );
    }

    const memberData = memberDoc.data();
    if (memberData?.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Can only resend invitations for pending members', message: '' },
        { status: 400 }
      );
    }

    // Generate a fresh password reset link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const setupPath = role === 'conductor' ? '/conductor/setup' : '/company/setup';
    const redirectUrl = new URL(setupPath, baseUrl);
    redirectUrl.searchParams.append('operatorId', operatorId);
    redirectUrl.searchParams.append('email', trimmedEmail);
    redirectUrl.searchParams.append('role', role);

    const actionCodeSettings = {
      url: redirectUrl.toString(),
      handleCodeInApp: true,
    };

    const inviteLink = await adminAuth.generatePasswordResetLink(trimmedEmail, actionCodeSettings);

    // Update the resend timestamp in Firestore
    await adminDb.collection('operators').doc(operatorId).update({
      invitationSentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Re-send the email
    await sendOperatorInviteEmail(
      trimmedEmail,
      name?.trim() || 'Team Member',
      companyName,
      inviteLink,
      operatorId,
      role
    );

    return NextResponse.json({
      success: true,
      message: `Invitation resent to ${trimmedEmail}`,
    });

  } catch (error: any) {
    console.error('Error resending invite:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to resend invitation', message: '' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}