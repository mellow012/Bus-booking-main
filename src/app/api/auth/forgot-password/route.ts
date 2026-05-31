import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { authRateLimiter, getClientIp } from '@/lib/rateLimiter';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const ip = getClientIp(request);
    const rateLimit = await authRateLimiter.limit(ip);

    if (!rateLimit.success) {
      const retryAfter = Math.ceil((rateLimit.reset - Date.now()) / 1000);
      return NextResponse.json(
        { 
          error: 'Too many requests', 
          message: `Please wait ${retryAfter} seconds before requesting another reset email.`,
          retryAfter 
        },
        { 
          status: 429,
          headers: { 'Retry-After': String(retryAfter) }
        }
      );
    }

    const body = await request.json();
    const { email, redirectUrl: clientRedirectUrl } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Bad request', message: 'Email is required' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const supabase = await createClient();

    // 2. Use Supabase's native reset method
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    if (!baseUrl.startsWith('http')) {
      baseUrl = 'http://localhost:3000';
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: clientRedirectUrl || `${baseUrl}/reset-password`,
    });

    if (resetError) {
      console.error('[forgot-password] Supabase reset error:', resetError);
      return NextResponse.json(
        { error: resetError.message, message: 'Could not process password reset request.' },
        { status: resetError.status || 400 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'If an account exists, a reset link has been sent to your email.' 
    });
  } catch (error: any) {
    console.error('[forgot-password] Unhandled error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}