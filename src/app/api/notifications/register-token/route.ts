/**
 * POST /api/notifications/register-token
 * Register or update FCM token for current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const requestSchema = z.object({
  token: z.string().min(10, 'Invalid FCM token'),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      await logger.logError('notification', 'Auth verification failed on FCM token registration', authError || new Error('No user'), {});
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authentication session' },
        { status: 401 }
      );
    }

    const userId = authUser.id;

    // Parse and validate request body
    const body = await request.json();
    const { token } = requestSchema.parse(body);

    // Get user document
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      await logger.logWarning('notification', 'User not found when registering FCM token', {
        userId,
        action: 'token_register_user_not_found',
      });
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const existingTokens = (user.fcmTokens as string[]) || [];

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
    await prisma.user.update({
      where: { id: userId },
      data: {
        fcmTokens: tokensToStore,
        lastTokenUpdated: new Date(),
        updatedAt: new Date(),
      }
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

