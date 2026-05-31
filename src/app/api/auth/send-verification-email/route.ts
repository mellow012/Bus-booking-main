// app/api/auth/send-verification-email/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Resend a verification email for an authenticated user whose email is not yet
// verified. Used by the /verify-email page "Resend" button.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { authRateLimiter, getClientIp } from '@/lib/rateLimiter';
import { sendVerificationEmail } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    // ── Rate limiting ─────────────────────────────────────────────────────────
    const ip = getClientIp(request);
    const rateLimit = await authRateLimiter.limit(ip);

    if (!rateLimit.success) {
      const retryAfter = Math.ceil((rateLimit.reset - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Please wait ${retryAfter} seconds before requesting another verification email.`,
          retryAfter,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      );
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authentication session' },
        { status: 401 }
      );
    }

    if (user.email_confirmed_at) {
      return NextResponse.json(
        { success: true, alreadyVerified: true, message: 'Email is already verified' },
        { status: 200 }
      );
    }

    // ── Generate verification link ────────────────────────────────────────────
    const adminClient = createAdminClient();
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'signup',
      email: user.email!,
      password: '', // Provided to satisfy TypeScript; ignored by Supabase if user already exists
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/verify-email`,
      },
    });

    if (linkError || !linkData.properties?.action_link) {
      console.error('[send-verification-email] generateLink failed:', linkError);
      return NextResponse.json(
        { error: 'Internal server error', message: 'Failed to generate verification link' },
        { status: 500 }
      );
    }

    const verificationLink = linkData.properties.action_link;

    // ── Send email ────────────────────────────────────────────────────────────
    try {
      await sendVerificationEmail(user.email!, verificationLink);
    } catch (mailError: any) {
      console.error('[send-verification-email] Email delivery failed:', mailError.message);
      return NextResponse.json(
        {
          error:   'Email delivery failed',
          message: "We generated the link but couldn't send the email. Please try again later.",
          ...(process.env.NODE_ENV === 'development' && { details: mailError.message }),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Verification email sent successfully',
        email:   user.email,
        // Only expose the link in development to make local testing easier
        ...(process.env.NODE_ENV === 'development' && { verificationLink }),
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('[send-verification-email] Unhandled error:', error);
    return NextResponse.json(
      {
        error:   'Internal server error',
        message: error.message || 'Failed to process request',
      },
      { status: 500 }
    );
  }
}

