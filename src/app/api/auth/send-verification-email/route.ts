import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { authRateLimiter, getClientIp } from '@/lib/rateLimiter';

// Import your existing transporter (adjust path if needed)
import { transporter } from '@/lib/email-service'  // ← point this to wherever your nodemailer transporter lives

/**
 * POST /api/auth/send-verification-email
 * Sends a custom verification email with the Firebase-generated link
 * Requires: Bearer token in Authorization header
 */
export async function POST(request: NextRequest) {
  try {
    // ─── Rate Limiting ───────────────────────────────────────────────────────
    const ip = getClientIp(request);
    const rateLimitResult = authRateLimiter.check(ip);

    if (!rateLimitResult.allowed) {
      console.warn(`[RATE LIMIT] Too many verification email requests from ${ip}`);
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Too many verification email requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
          },
        }
      );
    }

    // ─── Authorization ──────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify the token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error: any) {
      console.error('Token verification failed:', error);
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const uid = decodedToken.uid;
    const userRecord = await adminAuth.getUser(uid);

    // Check if email exists
    if (!userRecord.email) {
      return NextResponse.json(
        { error: 'Invalid user', message: 'User email not found' },
        { status: 400 }
      );
    }

    // Check if email is already verified
    if (userRecord.emailVerified) {
      return NextResponse.json(
        { success: false, message: 'Email is already verified' },
        { status: 200 }
      );
    }

    // Generate the verification link
    const actionCodeSettings = {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?uid=${uid}`,
      handleCodeInApp: true,
    };

    const verificationLink = await adminAuth.generateEmailVerificationLink(
      userRecord.email,
      actionCodeSettings
    );

    // ─── Send the actual email ──────────────────────────────────────────────
    const mailOptions = {
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
                      font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(59,130,246,0.3);">
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
            Safe travels across Malawi,<br/>
            The TibhukeBus Team 🚍
          </p>
        </div>
      `,
    };

    try {
      console.log(`Sending verification email to ${userRecord.email} (UID: ${uid})`);
      const info = await transporter.sendMail(mailOptions);
      console.log('Verification email sent successfully:', info.response);
    } catch (mailError: any) {
      console.error('Failed to send verification email:', mailError);
      return NextResponse.json(
        {
          error: 'Email delivery failed',
          message: 'We generated the link but couldn\'t send the email. Please try again later.',
          details: process.env.NODE_ENV === 'development' ? mailError.message : undefined,
        },
        { status: 500 }
      );
    }

    console.log(`✅ Verification process completed for ${userRecord.email} (UID: ${uid})`);

    return NextResponse.json(
      {
        success: true,
        message: 'Verification email sent successfully',
        email: userRecord.email,
        // Only expose link in dev for debugging
        ...(process.env.NODE_ENV === 'development' && { verificationLink }),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in send-verification-email endpoint:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Failed to process verification request',
      },
      { status: 500 }
    );
  }
}