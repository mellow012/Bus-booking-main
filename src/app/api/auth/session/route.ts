// app/api/auth/session/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Manages the __session HttpOnly cookie used by Edge middleware.
//
// IMPORTANT — stores ID token directly, not a Firebase session cookie.
//
// Firebase session cookies use a non-standard JWKS format (PEM certs as a
// plain map) that jose cannot parse in Edge Runtime. ID tokens use a proper
// JWK Set and verify correctly with jose. We store the ID token itself in
// the __session cookie so middleware can verify it directly.
//
// ID tokens expire in 1 hour. Clients must call POST /api/auth/session again
// with a fresh token to refresh the cookie. AuthContext handles this on:
//   - sign-in
//   - email verification
//   - (optionally) token refresh via onIdTokenChanged
//
// POST /api/auth/session  — validates ID token and sets __session cookie
// DELETE /api/auth/session — clears __session cookie
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = '__session';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ID tokens expire in 1 hour — set cookie to match
const COOKIE_MAX_AGE = 60 * 60; // 1 hour in seconds

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   IS_PRODUCTION,
  sameSite: 'lax' as const,
  path:     '/',
  maxAge:   COOKIE_MAX_AGE,
};

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.slice(7);

    // Verify the token is valid before storing it
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch (err: any) {
      console.error('[POST /api/auth/session] Invalid token:', err.code);
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired ID token' },
        { status: 401 }
      );
    }

    console.log(`[POST /api/auth/session] Session set for uid=${decoded.uid} email_verified=${decoded.email_verified}`);

    // Store the raw ID token in the cookie — middleware verifies it with jose
    const response = NextResponse.json({ success: true }, { status: 200 });
    response.cookies.set(SESSION_COOKIE_NAME, idToken, COOKIE_OPTIONS);
    return response;

  } catch (error: any) {
    console.error('[POST /api/auth/session]', error?.code, error?.message);
    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to create session' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('[DELETE /api/auth/session]', error?.code, error?.message);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}