// app/api/auth/send-verification-email/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Resend a verification email for an authenticated user whose email is not yet
// verified. Used by the /verify-email page "Resend" button.
//
// IMPORTANT — two different verification email strategies:
//
//   1. On initial sign-up (AuthContext.signUp):
//      Uses Firebase client SDK sendEmailVerification(newUser) directly.
//      This sends a standard Firebase verification email that points to your
//      custom action URL configured in Firebase Console → Auth → Templates.
//      No involvement from this API route.
//
//   2. Resend requests (this route):
//      The client no longer has a live User object with a fresh token in all
//      resend scenarios (e.g. after a page refresh on /verify-email), so we
//      use the Admin SDK to generate a new link and send it via our own SMTP.
//      generateEmailVerificationLink() can hit Firebase rate limits if called
//      too many times — the rate limiter here prevents that.
//
// ERROR: TOO_MANY_ATTEMPTS_TRY_LATER
//   Firebase has temporarily blocked generateEmailVerificationLink for this
//   account due to too many requests during development/testing. Wait ~1 hour
//   or use a different test account. This is a Firebase-side limit, not a bug.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
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
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // ── User validation ───────────────────────────────────────────────────────
    let userRecord;
    try {
      userRecord = await adminAuth.getUser(decodedToken.uid);
    } catch {
      return NextResponse.json(
        { error: 'User not found', message: 'No user found for this token' },
        { status: 404 }
      );
    }

    if (!userRecord.email) {
      return NextResponse.json(
        { error: 'Invalid user', message: 'User has no email address on file' },
        { status: 400 }
      );
    }

    if (userRecord.emailVerified) {
      // Not an error — the client should update its state and move on
      return NextResponse.json(
        { success: true, alreadyVerified: true, message: 'Email is already verified' },
        { status: 200 }
      );
    }

    // ── Generate verification link ────────────────────────────────────────────
    // generateEmailVerificationLink() is subject to Firebase rate limiting.
    // If Firebase returns TOO_MANY_ATTEMPTS_TRY_LATER, surface a clear message
    // so the client can show a helpful error instead of a generic 500.
    let verificationLink: string;
    try {
      verificationLink = await adminAuth.generateEmailVerificationLink(
        userRecord.email,
        {
          // Must match the "Customize action URL" setting in:
          // Firebase Console → Authentication → Templates → Email verification
          url: `${process.env.NEXT_PUBLIC_APP_URL}/verify-email`,
          handleCodeInApp: true,
        }
      );
    } catch (err: any) {
      const isRateLimited =
        err?.errorInfo?.code === 'auth/too-many-requests' ||
        (err?.message ?? '').includes('TOO_MANY_ATTEMPTS_TRY_LATER');

      if (isRateLimited) {
        console.warn('[send-verification-email] Firebase rate limited generateEmailVerificationLink');
        return NextResponse.json(
          {
            error: 'Rate limited',
            message:
              'Firebase has temporarily limited verification email requests for this account. ' +
              'Please wait at least 1 hour and try again, or check your spam folder for an earlier email.',
          },
          { status: 429 }
        );
      }

      console.error('[send-verification-email] generateEmailVerificationLink failed:', err);
      return NextResponse.json(
        { error: 'Internal server error', message: 'Failed to generate verification link' },
        { status: 500 }
      );
    }

    // ── Send email ────────────────────────────────────────────────────────────
    try {
      await transporter().sendMail({
        from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to:      userRecord.email,
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
        email:   userRecord.email,
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