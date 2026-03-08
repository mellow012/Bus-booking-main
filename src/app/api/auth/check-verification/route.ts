// app/api/auth/check-verification/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/check-verification
//
// Checks whether the authenticated user's email is verified according to
// Firebase Auth (the source of truth).
//
// Used by the /verify-email page to poll verification status so the user
// doesn't have to manually refresh after clicking the verification link.
//
// Requires: Authorization: Bearer <idToken> header
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function GET(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // ── Fetch user record ─────────────────────────────────────────────────────
    // We deliberately call getUser() instead of relying solely on the decoded
    // token claims because the token may be up to 1 hour old. getUser() always
    // returns the current server-side state from Firebase Auth.
    let userRecord;
    try {
      userRecord = await adminAuth.getUser(decodedToken.uid);
    } catch {
      return NextResponse.json(
        { error: 'User not found', message: 'No user found for this token' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success:       true,
        uid:           userRecord.uid,
        email:         userRecord.email,
        emailVerified: userRecord.emailVerified,
        message:       userRecord.emailVerified
          ? 'Email is verified'
          : 'Email verification pending',
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('[check-verification] Unhandled error:', error);
    return NextResponse.json(
      {
        error:   'Internal server error',
        message: error.message || 'Failed to check verification status',
      },
      { status: 500 }
    );
  }
}