import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { authRateLimiter, getClientIp } from '@/lib/rateLimiter';
import { withErrorHandling, createSuccessResponse, Errors } from '@/lib/errorHandler';

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
    const supabase = await createClient();

    // 2. Use Supabase's native reset method
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    if (!baseUrl.startsWith('http')) {
      baseUrl = 'http://localhost:3000';
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: clientRedirectUrl || `${baseUrl}/reset-password`,
    });

    if (resetError) throw resetError;

    return createSuccessResponse(null, 'If an account exists, a reset link has been sent to your email.');
});