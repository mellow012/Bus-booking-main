import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationEmail } from '@/lib/email-service'; // Assuming this exists based on previous context

const SUCCESS = () => new NextResponse(JSON.stringify({ status: 'success' }), { 
  status: 200, 
  headers: { 'Content-Type': 'application/json' } 
});

export async function POST(request: NextRequest) {
  try {
    // Supabase sends a POST with a JSON body
    const payload = await request.json();
    const { user, email_data, action } = payload;
    
    // Ensure this URL matches your production domain strictly
    const appUrl = 'https://www.tibhukebus.com';

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
        console.log(`[hook] Sending signup email to ${user.email} with URL: ${url}`);
        await sendVerificationEmail(user.email, url);
        break;
      }
      case 'recovery': {
        const url = buildLink('recovery');
        console.log(`[hook] Sending recovery email to ${user.email} with URL: ${url}`);
        await sendVerificationEmail(user.email, url); 
        break;
      }
      default:
        console.log('[hook] Unhandled action:', action);
    }

    return SUCCESS();

  } catch (error: any) {
    console.error('[hook] Error:', error.message);
    // Still return 200/JSON to prevent Supabase GoTrue from retrying or logging a 405/500 crash
    return SUCCESS();
  }
}