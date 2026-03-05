// lib/email-service.ts
//
// FIX F-17: transporter.verify() was called at module scope, meaning it ran
// on every cold start / import — even for requests that never send email.
// An SMTP failure at import time logs noise on every pod restart.
//
// It is now exposed as verifyEmailTransporter() which should be called only
// from your GET /api/health endpoint, not at module load time.

import nodemailer from 'nodemailer';

type TeamRole = 'operator' | 'conductor';

// ─── Transporter ──────────────────────────────────────────────────────────────
// Created lazily on first use so a missing EMAIL_USER / EMAIL_PASS does not
// crash the module at import time.

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER and EMAIL_PASS environment variables must be set.');
  }

  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // 16-char App Password required when 2FA is on
    },
    pool: true,
    maxConnections: 1,
    rateDelta: 1000,
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 5_000,
  });

  return _transporter;
}

// Keep named export for any existing imports
export { getTransporter as transporter };

// ─── Health check helper ──────────────────────────────────────────────────────
// Call this ONLY from GET /api/health — never at module load time.
//
// Example in src/app/api/health/route.ts:
//   import { verifyEmailTransporter } from '@/lib/email-service';
//   const emailOk = await verifyEmailTransporter();
//   return NextResponse.json({ email: emailOk ? 'ok' : 'degraded' });

export async function verifyEmailTransporter(): Promise<boolean> {
  try {
    await getTransporter().verify();
    return true;
  } catch (err: any) {
    console.error('[email-service] SMTP verification failed:', err.message);
    console.error('[email-service] Check EMAIL_USER, EMAIL_PASS. Gmail requires an App Password when 2FA is enabled.');
    console.error('[email-service] Docs: https://support.google.com/accounts/answer/185833');
    return false;
  }
}

// ─── sendPasswordResetEmail ───────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  email: string,
  companyName: string,
  resetLink: string,
  companyId: string
): Promise<void> {
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: `Complete Your ${companyName} Account Setup`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to BusBooking Platform!</h2>
        <p>Your company <strong>${companyName}</strong> has been created.</p>
        <p>Click below to set your password and complete setup:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Set Up Account
          </a>
        </div>
        <p><small>This link expires in 24 hours. Company ID: ${companyId}</small></p>
      </div>
    `,
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log('[email-service] Password reset sent:', info.response);
  } catch (error: any) {
    console.error('[email-service] Failed to send password reset to', email, ':', error.message);
    throw new Error('Email sending failed');
  }
}

// ─── sendOperatorInviteEmail ──────────────────────────────────────────────────

export async function sendOperatorInviteEmail(
  email: string,
  operatorName: string,
  companyName: string,
  inviteLink: string,
  operatorId: string,
  role: TeamRole = 'operator'
): Promise<void> {
  const isOperator    = role === 'operator';
  const roleLabel     = isOperator ? 'Operator' : 'Conductor / Driver';
  const roleColor     = isOperator ? '#2563eb' : '#7c3aed';
  const roleDescription = isOperator
    ? "In this role, you'll be able to create and manage schedules, handle bookings, and support daily operations for your company."
    : "In this role, you'll be able to view your assigned trips, check passenger manifests, and manage your daily schedule.";

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: `You've been invited to join ${companyName} as a ${roleLabel}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: ${roleColor}; margin: 0;">BusBooking Platform</h1>
          <p style="color: #64748b; margin-top: 5px;">${roleLabel} Invitation</p>
        </div>

        <div style="background-color: #f8fafc; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h2 style="color: #1e293b; margin-top: 0;">Hello ${operatorName}!</h2>
          <p style="color: #475569; line-height: 1.6;">
            You've been invited to join <strong>${companyName}</strong> as a <strong>${roleLabel}</strong>.
          </p>
          <p style="color: #475569; line-height: 1.6;">${roleDescription}</p>
        </div>

        <div style="text-align: center; margin: 40px 0;">
          <a href="${inviteLink}" 
             style="background-color: ${roleColor}; color: white; padding: 15px 30px; 
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: 600; font-size: 16px;">
            Complete Your Registration
          </a>
        </div>

        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 5px; margin-bottom: 30px;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>Important:</strong> This invitation link expires in 24 hours.
          </p>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px;">
          <p style="color: #64748b; font-size: 12px; margin: 5px 0;">Member ID: ${operatorId}</p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 15px;">
            If you weren't expecting this email, you can safely ignore it.
          </p>
        </div>
      </div>
    `,
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`[email-service] ${roleLabel} invite sent:`, info.response);
  } catch (error: any) {
    console.error(`[email-service] Failed to send ${roleLabel} invite to`, email, ':', error.message);
    throw new Error('Failed to send invitation email');
  }
}