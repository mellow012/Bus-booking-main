/**
 * POST /api/notifications/register-token
 * Register or update FCM token for current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const requestSchema = z.object({
  token: z.string().min(10, 'Invalid FCM token'),
});

export async function POST(request: NextRequest) {
  try {
    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);
    let userId: string;

    // Verify ID token
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken, true);
      userId = decodedToken.uid;
    } catch (error: any) {
      await logger.logError('notification', 'Token verification failed on FCM token registration', error, {});
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { token } = requestSchema.parse(body);

    // Get user document
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await logger.logWarning('notification', 'User not found when registering FCM token', {
        userId,
        action: 'token_register_user_not_found',
      });
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data() || {};
    const existingTokens = userData.fcmTokens || [];

    // Check if token already exists
    if (existingTokens.includes(token)) {
      await logger.logSuccess('notification', 'FCM token already registered', {
        userId,
        action: 'token_already_exists',
        metadata: {
          tokenPreview: token.substring(0, 20) + '...',
        },
      });

      return NextResponse.json(
        {
          message: 'Token already registered',
          success: true,
          tokenCount: existingTokens.length,
        },
        { status: 200 }
      );
    }

    // Limit tokens per user (max 50 devices)
    const tokensToStore = existingTokens.slice(-49);
    tokensToStore.push(token);

    // Update user document with new token
    await userRef.update({
      fcmTokens: tokensToStore,
      lastTokenUpdated: new Date(),
      updatedAt: new Date(),
    });

    await logger.logSuccess('notification', 'FCM token registered successfully', {
      userId,
      action: 'token_registered',
      metadata: {
        tokenPreview: token.substring(0, 20) + '...',
        totalTokens: tokensToStore.length,
      },
    });

    return NextResponse.json(
      {
        message: 'Token registered successfully',
        success: true,
        tokenCount: tokensToStore.length,
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      await logger.logWarning('notification', 'FCM token registration validation error', {
        action: 'token_register_validation_error',
        metadata: {
          issues: error.issues,
        },
      });

      return NextResponse.json(
        {
          error: 'Validation error',
          issues: error.issues,
          success: false,
        },
        { status: 400 }
      );
    }

    await logger.logError('notification', 'FCM token registration failed', error, {
      action: 'token_register_error',
    });

    return NextResponse.json(
      {
        error: 'Failed to register token',
        message: error.message,
        success: false,
      },
      { status: 500 }
    );
  }
}
