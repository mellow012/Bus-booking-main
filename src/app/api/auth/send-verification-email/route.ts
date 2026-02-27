import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { authRateLimiter, getClientIp } from '@/lib/rateLimiter';

/**
 * POST /api/auth/send-verification-email
 * Sends a verification email to the authenticated user
 * Requires: Bearer token in Authorization header
 */
export async function POST(request: NextRequest) {
  try {
    // ─── Rate Limiting ───────────────────────────────────────────────────────
    const ip = getClientIp(request);
    const rateLimitResult = authRateLimiter.check(ip);

    if (!rateLimitResult.allowed) {
      console.warn(`[RATE LIMIT] Too many verification email requests from ${ip}`);
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Too many verification email requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
          },
        }
      );
    }

    // ─── Authorization ──────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify the token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error: any) {
      console.error('Token verification failed:', error);
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const uid = decodedToken.uid;
    const userRecord = await adminAuth.getUser(uid);

    // Check if email exists
    if (!userRecord.email) {
      return NextResponse.json(
        { error: 'Invalid user', message: 'User email not found' },
        { status: 400 }
      );
    }

    // Check if email is already verified
    if (userRecord.emailVerified) {
      return NextResponse.json(
        { success: false, message: 'Email is already verified' },
        { status: 200 }
      );
    }

    // Generate email verification link
    const actionCodeSettings = {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?uid=${uid}`,
      handleCodeInApp: true,
    };

    const verificationLink = await adminAuth.generateEmailVerificationLink(
      userRecord.email,
      actionCodeSettings
    );

    console.log(`✅ Verification email sent to ${userRecord.email} (UID: ${uid})`);

    return NextResponse.json(
      {
        success: true,
        message: 'Verification email sent successfully',
        email: userRecord.email,
        verificationLink: process.env.NODE_ENV === 'development' ? verificationLink : undefined,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error sending verification email:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Failed to send verification email',
      },
      { status: 500 }
    );
  }
}
