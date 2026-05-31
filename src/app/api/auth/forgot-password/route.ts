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
    // Ensure no trailing slash for consistent matching
    baseUrl = baseUrl.replace(/\/$/, '');

    // 1. Generate the recovery link using the Admin API
    // type: 'recovery' generates a tokenized URL that allows a user to reset their password
    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: trimmedEmail,
      options: {
        redirectTo: (clientRedirectUrl || `${baseUrl}/reset-password`).split('#')[0],
      },
    });

    if (linkError) throw linkError;

    // 2. Hand off the link to our uniform Resend service
    if (data?.properties?.action_link) {
      await sendGenericPasswordResetEmail(trimmedEmail, data.properties.action_link);
    }

    return createSuccessResponse(null, 'If an account exists, a reset link has been sent to your email.');
});