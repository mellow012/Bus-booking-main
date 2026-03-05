// app/api/auth/send-verification-email/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { authRateLimiter, getClientIp } from '@/lib/rateLimiter';
// FIX: import getTransporter() not transporter — email-service now uses lazy init
import { transporter } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    // ── Rate limiting ─────────────────────────────────────────────────────────
    const ip = getClientIp(request);
    // FIX: await the limit() call once and reuse the result — the old code
    // awaited it in the if-check but then read .retryAfter on the un-awaited Promise
    const rateLimit = await authRateLimiter.limit(ip);

    if (!rateLimit.success) {
      const retryAfter = Math.ceil((rateLimit.reset - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Too many verification email requests. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      );
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
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

    const userRecord = await adminAuth.getUser(decodedToken.uid);

    if (!userRecord.email) {
      return NextResponse.json(
        { error: 'Invalid user', message: 'User email not found' },
        { status: 400 }
      );
    }

    if (userRecord.emailVerified) {
      return NextResponse.json({ success: false, message: 'Email is already verified' });
    }

    // ── Generate verification link ────────────────────────────────────────────
    const verificationLink = await adminAuth.generateEmailVerificationLink(
      userRecord.email,
      {
        url: `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?uid=${decodedToken.uid}`,
        handleCodeInApp: true,
      }
    );

    // ── Send email ────────────────────────────────────────────────────────────
    try {
      await transporter().sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: userRecord.email,
        subject: 'Verify Your TibhukeBus Email Address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3b82f6; margin: 0;">TibhukeBus</h1>
              <p style="color: #64748b; margin-top: 8px;">Email Verification</p>
            </div>
            <h2 style="color: #1e293b;">Hi there,</h2>
            <p>Thanks for joining TibhukeBus — Malawi's easiest way to book buses!</p>
            <p>Just one quick step: verify your email so you can start searching routes, booking seats, and traveling hassle-free.</p>
            <div style="text-align: center; margin: 35px 0;">
              <a href="${verificationLink}"
                 style="background-color: #3b82f6; color: white; padding: 14px 32px;
                        text-decoration: none; border-radius: 8px; font-weight: 600;
                        font-size: 16px; display: inline-block;">
                Verify My Email
              </a>
            </div>
            <p style="color: #475569;">
              If the button doesn't work, copy and paste this link:<br/>
              <a href="${verificationLink}" style="color: #3b82f6; word-break: break-all;">${verificationLink}</a>
            </p>
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 25px 0; border-radius: 4px;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Note:</strong> This link expires in 3 days. If you didn't sign up, you can safely ignore this email.
              </p>
            </div>
            <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
              Safe travels across Malawi,<br/>The TibhukeBus Team 🚍
            </p>
          </div>
        `,
      });
    } catch (mailError: any) {
      console.error('[send-verification-email] Email delivery failed:', mailError.message);
      return NextResponse.json(
        {
          error: 'Email delivery failed',
          message: "We generated the link but couldn't send the email. Please try again later.",
          details: process.env.NODE_ENV === 'development' ? mailError.message : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Verification email sent successfully',
        email: userRecord.email,
        ...(process.env.NODE_ENV === 'development' && { verificationLink }),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[send-verification-email]', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}