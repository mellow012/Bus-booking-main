import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationEmail } from '@/lib/email-service'; 

const SUCCESS = () => NextResponse.json({ status: 'success' }, { status: 200 });

export async function POST(request: NextRequest) {
  try {
    // Supabase sends a POST with a JSON body to Auth Hooks
    const payload = await request.json();
    const { user, email_data, action } = payload;
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.tibhukebus.com';

    // Build the link pointing back to your App domain to support PKCE
    const buildLink = (type: string) => {
      const qs = new URLSearchParams({
        token_hash: email_data.token_hash,
        type: type,
        next: type === 'recovery' ? '/reset-password' : '/'
      });
      return `${appUrl}/auth/callback?${qs.toString()}`;
    };

    console.log(`[hook] Processing ${action} for ${user.email}`);

    switch (action) {
      case 'signup':
      case 'magiclink': {
        const url = buildLink('signup');
        await sendVerificationEmail(user.email, url);
        break;
      }
      case 'recovery': {
        const url = buildLink('recovery');
        await sendVerificationEmail(user.email, url); 
        break;
      }
      default:
        console.log('[hook] Unhandled action:', action);
    }

    return SUCCESS();

  } catch (error: any) {
    console.error('[hook] Error:', error.message);
    // Still return 200 JSON to satisfy GoTrue requirements
    return SUCCESS();
  }
}