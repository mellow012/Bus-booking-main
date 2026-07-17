import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { authRateLimiter, getClientIp } from '@/lib/rateLimit';
import { withErrorHandling, createSuccessResponse, Errors } from '@/lib/errorHandler';
import { sendGenericPasswordResetEmail } from '@/lib/email-service';

import { z } from 'zod';
import { emailSchema } from '@/lib/validationSchemas';

export const POST = withErrorHandling(async (request: NextRequest) => {
    const ip = getClientIp(request);
    const rateLimit = await authRateLimiter.limit(ip);

    if (!rateLimit.success) {
      const retryAfter = Math.ceil((rateLimit.reset - Date.now()) / 1000);
      throw Errors.rateLimitExceeded(retryAfter);
    }

    const body = await request.json();
    const schema = z.object({
      email: emailSchema,
      redirectUrl: z.string().optional(),
    });
    
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((err) => {
        errors[err.path.join('.')] = err.message;
      });
      throw Errors.validationError(errors);
    }
    
    const { email, redirectUrl: clientRedirectUrl } = parsed.data;

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