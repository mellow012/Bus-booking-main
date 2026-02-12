import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { sendOperatorInviteEmail } from '@/lib/email-service';
import { FieldValue } from 'firebase-admin/firestore';

type TeamRole = 'operator' | 'conductor';

interface InviteTeamMemberRequest {
  name: string;
  email: string;
  role?: TeamRole; // defaults to 'operator' for backward compat
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

const VALID_ROLES: TeamRole[] = ['operator', 'conductor'];

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body: InviteTeamMemberRequest = await request.json();
    console.log('Invite API received:', body);

    const { name, email, companyId, companyName, invitedBy } = body;
    const role: TeamRole = VALID_ROLES.includes(body.role as TeamRole) ? (body.role as TeamRole) : 'operator';

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
          { success: false, error: 'Email already in use', message: '' },
          { status: 400 }
        );
      }
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') throw error;
    }

    // 3. Create Firebase Auth User
    const userRecord = await adminAuth.createUser({
      email: trimmedEmail,
      emailVerified: false,
      disabled: false,
      displayName: name.trim(),
    });

    // 4. Create document in 'users' collection with correct role
    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      name: name.trim(),
      email: trimmedEmail,
      role,                  // 'operator' or 'conductor'
      companyId,
      passwordSet: false,
      setupCompleted: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 5. Create document in 'operators' collection (shared collection, role field distinguishes them)
    const memberRef = adminDb.collection('operators').doc();
    const operatorId = memberRef.id;

    await memberRef.set({
      id: operatorId,
      uid: userRecord.uid,
      name: name.trim(),
      email: trimmedEmail,
      role,                  // 'operator' or 'conductor'
      companyId,
      companyName,
      status: 'pending',
      createdBy: invitedBy,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      invitationSent: true,
      invitationSentAt: FieldValue.serverTimestamp(),
    });

    // 6. Generate password reset / setup link
    // Conductors get their own dashboard route on setup
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

    // 7. Send email
    await sendOperatorInviteEmail(
      trimmedEmail,
      name.trim(),
      companyName,
      inviteLink,
      operatorId,
      role
    );

    return NextResponse.json({
      success: true,
      message: `${role === 'conductor' ? 'Conductor' : 'Operator'} invitation sent successfully!`,
      operatorId,
    });

  } catch (error: any) {
    console.error('Error inviting team member:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send invite', message: '' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}