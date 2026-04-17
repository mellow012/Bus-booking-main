import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { authRateLimiter, getClientIp } from '@/lib/rateLimiter';
import { sendGenericPasswordResetEmail } from '@/lib/email-service';

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
    const adminClient = createAdminClient();

    // 2. Check if user exists (security: we always return 200, but only send if exists)
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) throw listError;
    
    const user = users.find(u => u.email === trimmedEmail);

    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return NextResponse.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    // 3. Generate reset link
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    if (!baseUrl.startsWith('http')) {
      baseUrl = 'http://localhost:3000';
    }

    // Use the client-provided redirectUrl if it exists, otherwise default to /reset-password
    const finalRedirectUrl = clientRedirectUrl || `${baseUrl}/reset-password`;

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: trimmedEmail,
      options: {
        redirectTo: finalRedirectUrl,
      },
    });

    if (linkError || !linkData.properties?.action_link) {
      console.error('[forgot-password] generateLink failed:', linkError);
      return NextResponse.json(
        { error: 'Internal server error', message: 'Failed to generate reset link' },
        { status: 500 }
      );
    }

    const resetLink = linkData.properties.action_link;

    // 4. Send email
    await sendGenericPasswordResetEmail(trimmedEmail, resetLink);

    return NextResponse.json({
      success: true,
      message: 'Password reset link sent successfully',
    });

  } catch (error: any) {
    console.error('[forgot-password] Unhandled error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
