// app/api/auth/supabase-email-hook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'standardwebhooks';
import { sendVerificationEmail } from '@/lib/email-service';

const SUCCESS = new NextResponse(null, { status: 200 });

function buildVerifyUrl(supabaseUrl: string, token_hash: string, type: string, redirect_to: string) {
  const qs = new URLSearchParams({ token_hash, type, redirect_to });
  return `${supabaseUrl}/auth/v1/verify?${qs.toString()}`;
}

export async function POST(request: NextRequest) {
  try {

    const rawBody = await request.text();
    const headers = {
  ...Object.fromEntries(request.headers),
  'content-type': 'application/json', // ← add this
};

    const secret = process.env.SUPABASE_HOOK_SECRET ?? '';
    const base64Secret = secret.replace(/^v1,whsec_/, '');

    let payload: any;
    try {
      const wh = new Webhook(base64Secret);
      payload = wh.verify(rawBody, headers);
    } catch (err: any) {
      console.error('[hook] Signature verification failed:', err.message);
      return SUCCESS; // always 200 so auth isn't blocked
    }

    const { user, email_data } = payload ?? {};
    const action = email_data?.email_action_type;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    switch (action) {
      case 'signup':
      case 'magiclink': {
        const url = buildVerifyUrl(supabaseUrl, email_data.token_hash, 'signup', appUrl);
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
    return SUCCESS; // always 200
  }
}