// app/api/auth/send-verification-email/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Resend a verification email for an authenticated user whose email is not yet
// verified. Used by the /verify-email page "Resend" button.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { authRateLimiter, getClientIp } from '@/lib/rateLimiter';
import { transporter } from '@/lib/email-service';

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
      await transporter().sendMail({
        from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to:      user.email!,
        subject: 'Verify Your TibhukeBus Email Address',
        html: buildVerificationEmailHtml(verificationLink),
      });
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

// ─── Email template ───────────────────────────────────────────────────────────

function buildVerificationEmailHtml(verificationLink: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);padding:32px 40px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;letter-spacing:-0.5px;">TibhukeBus</h1>
          <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Safe Travels Across Malawi 🚍</p>
        </div>

        <!-- Body -->
        <div style="padding:40px;">
          <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;">Verify Your Email Address</h2>
          <p style="color:#475569;line-height:1.7;margin:0 0 16px;">
            Thanks for joining TibhukeBus — Malawi's easiest way to book buses!
            Just one quick step: verify your email so you can start searching routes,
            booking seats, and traveling hassle-free.
          </p>

          <!-- CTA -->
          <div style="text-align:center;margin:36px 0;">
            <a href="${verificationLink}"
               style="background-color:#3b82f6;color:#ffffff;padding:14px 36px;
                      text-decoration:none;border-radius:8px;font-weight:600;
                      font-size:16px;display:inline-block;letter-spacing:0.2px;">
              Verify My Email
            </a>
          </div>

          <!-- Fallback link -->
          <p style="color:#64748b;font-size:14px;line-height:1.6;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${verificationLink}"
               style="color:#3b82f6;word-break:break-all;font-size:13px;">${verificationLink}</a>
          </p>

          <!-- Warning box -->
          <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;margin:28px 0;border-radius:0 6px 6px 0;">
            <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
              <strong>⏳ This link expires in 3 days.</strong><br/>
              If you didn't create a TibhukeBus account, you can safely ignore this email.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#f1f5f9;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:13px;margin:0;line-height:1.6;">
            Safe travels across Malawi,<br/>
            <strong style="color:#64748b;">The TibhukeBus Team</strong>
          </p>
        </div>

      </div>
    </body>
    </html>
  `;
}
