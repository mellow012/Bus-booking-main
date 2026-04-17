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

  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim()?.replace(/["']/g, '')?.replace(/\s+/g, '');

  if (!user || !pass) {
    throw new Error('EMAIL_USER and EMAIL_PASS environment variables must be set.');
  }

  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user,
      pass: pass, // 16-char App Password required when 2FA is on
    },
    pool: true,
    maxConnections: 1,
    rateDelta: 1000,
    connectionTimeout: 15_000, // Increased to 15s
    greetingTimeout: 15_000,   // Increased to 15s
    socketTimeout: 15_000,     // Increased to 15s
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
    const transporter = getTransporter();
    await transporter.verify();
    console.log('[email-service] SMTP verification successful');
    return true;
  } catch (err: any) {
    console.error('[email-service] SMTP verification failed!');
    console.error('[email-service] ERROR:', err.message);
    if (err.code === 'EAUTH') {
      console.error('[email-service] AUTH FAILURE: Check EMAIL_USER and EMAIL_PASS. Gmail requires an App Password.');
    }
    return false;
  }
}

// ─── sendGenericPasswordResetEmail ───────────────────────────────────────────

export async function sendGenericPasswordResetEmail(
  email: string,
  resetLink: string
): Promise<void> {
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'Reset Your TibhukeBus Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07); border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 32px 40px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">TibhukeBus</h1>
          <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 14px;">Safe Travels Across Malawi 🚍</p>
        </div>
        <div style="padding: 40px;">
          <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 22px;">Reset Your Password</h2>
          <p style="color: #475569; line-height: 1.7; margin: 0 0 16px;">
            We received a request to reset your password for your TibhukeBus account. 
            No problem! Just click the button below to choose a new one.
          </p>
          <div style="text-align: center; margin: 36px 0;">
            <a href="${resetLink}" 
               style="background-color: #3b82f6; color: #ffffff; padding: 14px 36px; 
                      text-decoration: none; border-radius: 8px; font-weight: 600; 
                      font-size: 16px; display: inline-block; letter-spacing: 0.2px;">
              Reset Password
            </a>
          </div>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${resetLink}" style="color: #3b82f6; word-break: break-all; font-size: 13px;">${resetLink}</a>
          </p>
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 28px 0; border-radius: 0 6px 6px 0;">
            <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.6;">
              <strong>⏳ This link expires in 1 hour.</strong><br/>
              If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
            </p>
          </div>
        </div>
        <div style="background: #f1f5f9; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 13px; margin: 0; line-height: 1.6;">
            Safe travels across Malawi,<br/>
            <strong style="color: #64748b;">The TibhukeBus Team</strong>
          </p>
        </div>
      </div>
    `,
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log('[email-service] Generic password reset sent:', info.response);
  } catch (error: any) {
    console.error('[email-service] Failed to send generic password reset to', email, ':', error.message);
    throw new Error('Email sending failed');
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