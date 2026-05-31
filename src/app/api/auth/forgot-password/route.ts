import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { authRateLimiter, getClientIp } from '@/lib/rateLimiter';
import { withErrorHandling, createSuccessResponse, Errors } from '@/lib/errorHandler';
import { sendGenericPasswordResetEmail } from '@/lib/email-service';

export const POST = withErrorHandling(async (request: NextRequest) => {
    const ip = getClientIp(request);
    const rateLimit = await authRateLimiter.limit(ip);

    if (!rateLimit.success) {
      const retryAfter = Math.ceil((rateLimit.reset - Date.now()) / 1000);
      throw Errors.rateLimitExceeded(retryAfter);
    }

    const body = await request.json();
    const { email, redirectUrl: clientRedirectUrl } = body;

    if (!email) throw Errors.validationError({ email: 'Email is required' });

    const trimmedEmail = email.trim().toLowerCase();
    const supabaseAdmin = createAdminClient();

    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    if (!baseUrl.startsWith('http')) {
      baseUrl = 'http://localhost:3000';
    }

    // 1. Generate the recovery link using the Admin API
    // This bypasses Supabase's built-in emailer and gives us the URL directly.
    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: trimmedEmail,
      options: {
        redirectTo: clientRedirectUrl || `${baseUrl}/reset-password`,
      },
    });

    if (linkError) throw linkError;

    // 2. Send the custom branded email via Resend
    if (data?.properties?.action_link) {
      await sendGenericPasswordResetEmail(trimmedEmail, data.properties.action_link);
    }

    return createSuccessResponse(null, 'If an account exists, a reset link has been sent to your email.');
});