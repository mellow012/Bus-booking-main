/**
 * GET /api/csrf-token
 * Returns a fresh CSRF token for form submissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken } from '@/lib/csrfProtection';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const token = generateCSRFToken();
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown';

    await logger.logSuccess('security', 'CSRF token generated', {
      ip,
      action: 'csrf_token_generated',
    });

    // Set token in httpOnly cookie for server-side validation
    const response = NextResponse.json(
      { token, success: true },
      { status: 200 }
    );

    // Set secure, httpOnly cookie with token
    response.cookies.set('csrf_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400, // 24 hours
      path: '/',
    });

    return response;
  } catch (error: any) {
    await logger.logError('security', 'CSRF token generation failed', error, {
      action: 'csrf_token_error',
    });

    return NextResponse.json(
      { error: 'Failed to generate CSRF token', success: false },
      { status: 500 }
    );
  }
}
