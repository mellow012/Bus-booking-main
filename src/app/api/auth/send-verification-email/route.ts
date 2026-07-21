import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { authRateLimiter, getClientIp } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success, reset } = await authRateLimiter.limit(ip);
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter > 0 ? retryAfter : 60) } }
      );
    }
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authentication session' },
        { status: 401 }
      );
    }

    if (user.email_confirmed_at) {
      return NextResponse.json(
        { success: true, message: 'Email is already verified', alreadyVerified: true },
        { status: 200 }
      );
    }

    const email = user.email;
    if (!email) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'User email not found' },
        { status: 400 }
      );
    }

    // Trigger Supabase resend verification flow
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${new URL(request.url).origin}/verify-email?mode=verified`,
      },
    });

    if (resendError) {
      throw resendError;
    }

    return NextResponse.json(
      { success: true, message: 'Verification email sent successfully' },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('[send-verification-email] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Failed to resend verification email',
      },
      { status: 500 }
    );
  }
}
