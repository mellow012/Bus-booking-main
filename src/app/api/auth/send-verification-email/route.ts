// app/api/auth/supabase-email-hook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { sendVerificationEmail } from '@/lib/email-service';

const SUCCESS = new NextResponse(null, { status: 200 });

function verifySignature(secret: string, webhookId: string, webhookTimestamp: string, rawBody: string, webhookSignature: string): boolean {
  try {
    const base64Secret = secret.replace(/^v1,whsec_/, '');
    const secretBytes = Buffer.from(base64Secret, 'base64');
    const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
    const hmac = createHmac('sha256', secretBytes);
    hmac.update(signedContent);
    const digest = hmac.digest('base64');
    const expectedSig = `v1,${digest}`;
    const signatures = webhookSignature.split(' ');
    return signatures.some(sig => {
      try {
        return timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function buildVerifyUrl(supabaseUrl: string, token_hash: string, type: string, redirect_to: string) {
  return `${supabaseUrl}/auth/v1/verify?token_hash=${token_hash}&type=${type}&redirect_to=${encodeURIComponent(redirect_to)}`;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    const webhookId        = request.headers.get('webhook-id') ?? '';
    const webhookTimestamp = request.headers.get('webhook-timestamp') ?? '';
    const webhookSignature = request.headers.get('webhook-signature') ?? '';
    const secret           = process.env.SUPABASE_HOOK_SECRET ?? '';

    if (webhookId && webhookSignature) {
      const valid = verifySignature(secret, webhookId, webhookTimestamp, rawBody, webhookSignature);
      if (!valid) {
        console.error('[hook] Signature verification failed');
        return SUCCESS;
      }
    }

    const payload    = JSON.parse(rawBody);
    const { user, email_data } = payload ?? {};
    const action     = email_data?.email_action_type;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const appUrl      = process.env.NEXT_PUBLIC_APP_URL!;

    switch (action) {
      case 'signup':
      case 'magiclink': {
        const url = buildVerifyUrl(supabaseUrl, email_data.token_hash, 'signup', email_data.redirect_to || appUrl);
        await sendVerificationEmail(user.email, url);
        break;
      }

      case 'email_change': {
        if (!user.email || !user.email_new) break;
        await Promise.all([
          sendVerificationEmail(user.email, buildVerifyUrl(supabaseUrl, email_data.token_hash_new, 'email_change', appUrl)),
          sendVerificationEmail(user.email_new, buildVerifyUrl(supabaseUrl, email_data.token_hash, 'email_change', appUrl)),
        ]);
        break;
      }

      case 'invite': {
        const url = buildVerifyUrl(supabaseUrl, email_data.token_hash, 'invite', appUrl);
        await sendVerificationEmail(user.email, url);
        break;
      }

      case 'recovery':
        console.log('[hook] Recovery skipped — handled manually');
        break;

      default:
        console.log('[hook] Unhandled action:', action);
    }

    return SUCCESS;

  } catch (error: any) {
    console.error('[hook] Error:', error.message);
    return SUCCESS;
  }
}