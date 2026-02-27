import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * GET /api/auth/check-verification
 * Checks if the authenticated user's email is verified
 * Requires: Bearer token in Authorization header
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
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

    return NextResponse.json(
      {
        success: true,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        message: userRecord.emailVerified 
          ? 'Email is verified' 
          : 'Email verification pending',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error checking verification status:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Failed to check verification status',
      },
      { status: 500 }
    );
  }
}
