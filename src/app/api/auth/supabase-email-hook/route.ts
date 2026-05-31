// app/api/auth/supabase-email-hook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'standardwebhooks';
import { sendVerificationEmail, sendGenericPasswordResetEmail, sendOperatorInviteEmail } from '@/lib/email-service';

const SUCCESS = new NextResponse(null, { status: 200 });

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const headers = Object.fromEntries(request.headers);

    // ── Verify signature ────────────────────────────────────────────────────
    const secret = process.env.SUPABASE_HOOK_SECRET ?? '';
    // Supabase stores the secret as v1,whsec_<base64> — strip the prefix
    const base64Secret = secret.replace(/^v1,whsec_/, '');

    let payload: any;
    try {
      const wh = new Webhook(base64Secret);
      payload = wh.verify(rawBody, headers);
    } catch (err: any) {
      console.error('[supabase-email-hook] Signature verification failed:', err.message);
      return new NextResponse(null, { status: 200 }); // return 200 to avoid blocking auth
    }

    const { user, email_data } = payload;

    console.log('[supabase-email-hook] Action:', email_data?.email_action_type, '| Email:', user?.email);

    switch (email_data?.email_action_type) {

      case 'signup':
      case 'magiclink': {
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token_hash=${email_data.token_hash}&type=signup&redirect_to=${process.env.NEXT_PUBLIC_APP_URL}`;
        await sendVerificationEmail(user.email, url);
        break;
      }

      case 'email_change': {
        // token_hash     → new email (user.email_new)
        // token_hash_new → current email (user.email)
        const urlCurrent = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token_hash=${email_data.token_hash_new}&type=email_change&redirect_to=${process.env.NEXT_PUBLIC_APP_URL}`;
        const urlNew = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token_hash=${email_data.token_hash}&type=email_change&redirect_to=${process.env.NEXT_PUBLIC_APP_URL}`;

        // Send to both current and new email
        await Promise.all([
          sendVerificationEmail(user.email, urlCurrent),
          sendVerificationEmail(user.email_new, urlNew),
        ]);
        break;
      }

      case 'recovery':
        // Handled manually in /api/auth/reset-password — skip
        console.log('[supabase-email-hook] Recovery skipped — handled manually');
        break;

      case 'invite': {
        // Supabase-generated invite (not your custom operator invite)
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token_hash=${email_data.token_hash}&type=invite&redirect_to=${process.env.NEXT_PUBLIC_APP_URL}`;
        await sendVerificationEmail(user.email, url);
        break;
      }

      default:
        console.log('[supabase-email-hook] Unhandled action type:', email_data?.email_action_type);
    }

    return SUCCESS;

  } catch (error: any) {
    console.error('[supabase-email-hook] Unhandled error:', error.message);
    return SUCCESS; // always 200 so auth flow isn't blocked
  }
}