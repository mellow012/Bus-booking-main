// lib/email-service.ts
//
// FIX F-17: transporter.verify() was called at module scope, meaning it ran
// on every cold start / import — even for requests that never send email.
// An SMTP failure at import time logs noise on every pod restart.
//
// It is now exposed as verifyEmailTransporter() which should be called only
// from your GET /api/health endpoint, not at module load time.

import { Resend } from 'resend';

type TeamRole = 'operator' | 'conductor';

let _resend: Resend | null = null;

function getResendApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? process.env.resend_apikey?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY or resend_apikey environment variable must be set.');
  }
  return apiKey;
}

function getFromAddress(): string {
  return (
    process.env.RESEND_FROM?.trim() || 'TibhukeBus <admin@tibhukebus.com>'
  );
}

function getResendClient(): Resend {
  if (_resend) return _resend;
  _resend = new Resend(getResendApiKey());
  return _resend;
}

async function sendResendEmail(options: { to: string; subject: string; html: string; from?: string }) {
  const { data, error } = await getResendClient().emails.send({
    from: options.from || getFromAddress(),
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  if (error) {
    throw new Error(`[Resend] ${error.name}: ${error.message}`);
  }
  return data;
}

// ─── Branded Email Template Wrappers ──────────────────────────────────────────

function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://www.tibhukebus.com').replace(/\/$/, '');
}

function getEmailHeaderHtml(title: string): string {
  const baseUrl = getBaseUrl();
  const logoUrl = `${baseUrl}/tibhukebus_logo_transparent.png`;
  return `
    <div style="background: linear-gradient(135deg, #005a5b, #009091); padding: 32px 24px; text-align: center;">
      <img src="${logoUrl}" alt="TibhukeBus Logo" style="height: 56px; max-width: 56px; object-fit: contain; margin-bottom: 12px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15));" />
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; font-family: 'Inter', system-ui, -apple-system, sans-serif; letter-spacing: -0.5px;">${title}</h1>
    </div>
  `;
}

function getEmailFooterHtml(): string {
  return `
    <div style="background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 13px; font-family: 'Inter', system-ui, -apple-system, sans-serif;">
      <p style="margin: 0; font-weight: 600; color: #005a5b;">TibhukeBus</p>
      <p style="margin: 4px 0 0; color: #64748b;">Safe travels across Malawi 🚍</p>
      <p style="margin: 8px 0 0; font-size: 11px; color: #cbd5e1;">If you did not request this email, you can safely ignore it.</p>
    </div>
  `;
}

// ─── Health check helper ──────────────────────────────────────────────────────
// Call this ONLY from GET /api/health — never at module load time.

export async function verifyEmailTransporter(): Promise<boolean> {
  try {
    getResendClient();
    console.log('[email-service] Resend API key verification successful');
    return true;
  } catch (err: any) {
    console.error('[email-service] Resend verification failed!');
    console.error('[email-service] ERROR:', err.message);
    return false;
  }
}

// ─── Verification Email ───────────────────────────────────────────────────────

export async function sendVerificationEmail(email: string, verificationLink: string): Promise<void> {
  const mailOptions = {
    to: email,
    subject: 'Verify Your TibhukeBus Email Address',
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Verify Your Email</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Inter',system-ui,-apple-system,sans-serif;">
          <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.08);border: 1px solid #e2e8f0;">
            ${getEmailHeaderHtml('Verify Your Email')}
            <div style="padding:32px 40px;color:#1e293b;">
              <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Welcome to TibhukeBus! Please verify your email address to complete your registration and begin booking your travels.</p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${verificationLink}" style="background:#d04f3c;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;font-size:16px;box-shadow:0 4px 6px rgba(208,79,60,0.15);">Verify Email Address</a>
              </div>
              <p style="font-size:14px;line-height:1.7;color:#64748b;margin:24px 0 8px;">If the button does not work, copy and paste this link into your browser:</p>
              <p style="font-size:13px;word-break:break-all;color:#007b7c;margin:0;"><a href="${verificationLink}" style="color:#007b7c;text-decoration:none;">${verificationLink}</a></p>
            </div>
            ${getEmailFooterHtml()}
          </div>
        </body>
      </html>
    `,
  };

  try {
    const data = await sendResendEmail(mailOptions);
    console.log('[email-service] Verification email sent:', data?.id);
  } catch (error: any) {
    console.error('[email-service] Failed to send verification email to', email, ':', error.message);
    throw new Error('Email sending failed');
  }
}

// ─── sendGenericPasswordResetEmail ───────────────────────────────────────────

export async function sendGenericPasswordResetEmail(
  email: string,
  resetLink: string
): Promise<void> {
  const mailOptions = {
    to: email,
    subject: 'Reset Your TibhukeBus Password',
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Reset Your Password</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Inter',system-ui,-apple-system,sans-serif;">
          <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
            ${getEmailHeaderHtml('Reset Password')}
            <div style="padding: 40px; color: #1e293b;">
              <p style="color: #475569; line-height: 1.7; margin: 0 0 16px; font-size: 16px;">
                We received a request to reset your password for your TibhukeBus account. 
                No problem! Just click the button below to choose a new one.
              </p>
              <div style="text-align: center; margin: 36px 0;">
                <a href="${resetLink}" 
                   style="background-color: #d04f3c; color: #ffffff; padding: 14px 36px; 
                          text-decoration: none; border-radius: 8px; font-weight: 600; 
                          font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(208,79,60,0.15);">
                  Reset Password
                </a>
              </div>
              <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 24px 0 8px;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${resetLink}" style="color: #007b7c; word-break: break-all; font-size: 13px; text-decoration: none;">${resetLink}</a>
              </p>
              <div style="background: #e6f4f4; border-left: 4px solid #009091; padding: 16px; margin: 28px 0 0; border-radius: 0 6px 6px 0;">
                <p style="margin: 0; color: #003d3e; font-size: 13px; line-height: 1.6;">
                  <strong>⏳ This link expires in 1 hour.</strong><br/>
                  If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                </p>
              </div>
            </div>
            ${getEmailFooterHtml()}
          </div>
        </body>
      </html>
    `,
  };

  try {
    const data = await sendResendEmail(mailOptions);
    console.log('[email-service] Generic password reset sent:', data?.id);
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
    to: email,
    subject: `Complete Your ${companyName} Account Setup`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Complete Your Account Setup</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Inter',system-ui,-apple-system,sans-serif;">
          <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
            ${getEmailHeaderHtml('Welcome to TibhukeBus!')}
            <div style="padding: 40px; color: #1e293b;">
              <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Welcome to the Platform!</h2>
              <p style="color: #475569; line-height: 1.7; margin: 0 0 16px; font-size: 15px;">
                Your company, <strong style="color: #1e293b;">${companyName}</strong>, has been successfully registered on TibhukeBus.
              </p>
              <p style="color: #475569; line-height: 1.7; margin: 0 0 16px; font-size: 15px;">
                To begin managing your routes and schedules, you need to set up your administrator account and choose a password.
              </p>
              <div style="text-align: center; margin: 36px 0;">
                <a href="${resetLink}" 
                   style="background-color: #d04f3c; color: #ffffff; padding: 14px 36px; 
                          text-decoration: none; border-radius: 8px; font-weight: 600; 
                          font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(208,79,60,0.15);">
                  Set Up Account
                </a>
              </div>
              <div style="background: #e6f4f4; padding: 16px; border-radius: 8px; margin-top: 24px;">
                <p style="margin: 0; color: #003d3e; font-size: 13px; text-align: center;">
                  <strong>⏳ Link expires in 24 hours</strong><br/>
                  Company ID: ${companyId}
                </p>
              </div>
            </div>
            ${getEmailFooterHtml()}
          </div>
        </body>
      </html>
    `,
  };

  try {
    const data = await sendResendEmail(mailOptions);
    console.log('[email-service] Password reset sent:', data?.id);
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
  const roleColor     = isOperator ? '#007b7c' : '#d04f3c';
  const roleDescription = isOperator
    ? "In this role, you'll be able to create and manage schedules, handle bookings, and support daily operations for your company."
    : "In this role, you'll be able to view your assigned trips, check passenger manifests, and manage your daily schedule.";

  const mailOptions = {
    to: email,
    subject: `You've been invited to join ${companyName} as a ${roleLabel}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Invitation to join ${companyName}</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Inter',system-ui,-apple-system,sans-serif;">
          <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
            ${getEmailHeaderHtml(`Invitation for ${companyName}`)}
            <div style="padding: 40px; color: #1e293b;">
              <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">Hello ${operatorName},</h2>
              <p style="color: #475569; line-height: 1.6; font-size: 15px;">
                You've been invited to join <strong style="color: #1e293b;">${companyName}</strong> as a <strong style="color: #1e293b;">${roleLabel}</strong>.
              </p>
              <p style="color: #475569; line-height: 1.6; font-size: 15px;">${roleDescription}</p>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="${inviteLink}" 
                   style="background-color: ${roleColor}; color: white; padding: 15px 30px; 
                          text-decoration: none; border-radius: 8px; display: inline-block;
                          font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  Complete Your Registration
                </a>
              </div>

              <div style="background-color: #e6f4f4; border-left: 4px solid #009091; padding: 15px; border-radius: 5px; margin-bottom: 24px;">
                <p style="margin: 0; color: #003d3e; font-size: 13px; line-height: 1.5;">
                  <strong>⏳ Important:</strong> This invitation link expires in 24 hours.
                </p>
              </div>

              <p style="color: #64748b; font-size: 12px; margin: 5px 0;">Member ID: ${operatorId}</p>
            </div>
            ${getEmailFooterHtml()}
          </div>
        </body>
      </html>
    `,
  };

  try {
    const data = await sendResendEmail(mailOptions);
    console.log(`[email-service] ${roleLabel} invite sent:`, data?.id);
  } catch (error: any) {
    console.error(`[email-service] Failed to send ${roleLabel} invite to`, email, ':', error.message);
    throw new Error('Failed to send invitation email');
  }
}