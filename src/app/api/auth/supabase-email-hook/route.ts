// app/api/auth/supabase-email-hook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationEmail, sendGenericPasswordResetEmail } from '@/lib/email-service';
import { createHmac, timingSafeEqual } from 'crypto';

function verifySignature(secret: string, body: string, signature: string): boolean {
  try {
    // Supabase sends: v1,whsec_<base64secret>
    const secretBytes = Buffer.from(secret.replace('v1,whsec_', ''), 'base64');
    const hmac = createHmac('sha256', secretBytes);
    hmac.update(body);
    const digest = hmac.digest('hex');
    const expected = Buffer.from(`v1=${digest}`);
    const received = Buffer.from(signature);
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-supabase-signature') ?? '';
    const secret = process.env.SUPABASE_HOOK_SECRET ?? '';

    if (!verifySignature(secret, rawBody, signature)) {
      console.error('[supabase-email-hook] Invalid signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const { user, email_data } = payload;

    if (!user?.email || !email_data?.email_action_type) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    switch (email_data.email_action_type) {
      case 'signup':
      case 'email_change':
        await sendVerificationEmail(user.email, email_data.confirmation_url);
        break;

      case 'recovery':
        await sendGenericPasswordResetEmail(user.email, email_data.confirmation_url);
        break;

      default:
        console.log('[supabase-email-hook] Unhandled action type:', email_data.email_action_type);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[supabase-email-hook] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}