import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationEmail } from '@/lib/email-service'; 

const SUCCESS = () => new NextResponse(JSON.stringify({ status: 'success' }), { 
  status: 200, 
  headers: { 'Content-Type': 'application/json' } 
});

export async function POST(request: NextRequest) {
  try {
    // Supabase sends a POST with a JSON body
    const payload = await request.json();
    const { user, email_data } = payload ?? {};
    
    // 💡 FIX: Safely fallback across variations to extract the real event type string
    const action = email_data?.email_action_type || payload?.action || payload?.type;
    
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

    const targetEmail = user?.email || user?.user_metadata?.email;
    console.log(`[hook] Processing action status: "${action}" for recipient user: ${targetEmail}`);

    if (!user || !email_data) {
      console.warn('[hook] Empty structural configuration envelope payload received. Exiting safely.');
      return SUCCESS();
    }

    switch (action) {
      case 'signup': {
        const url = buildLink('signup');
        console.log(`[hook] Sending signup email to ${targetEmail} with URL: ${url}`);
        await sendVerificationEmail(targetEmail, url);
        break;
      }
      
      case 'magiclink': {
        // 💡 FIX: Pass the true authentication type state signature dynamically
        const url = buildLink('magiclink');
        console.log(`[hook] Sending magiclink email to ${targetEmail} with URL: ${url}`);
        await sendVerificationEmail(targetEmail, url);
        break;
      }
      
      case 'recovery': {
        const url = buildLink('recovery');
        console.log(`[hook] Sending recovery email to ${targetEmail} with URL: ${url}`);
        await sendVerificationEmail(targetEmail, url); 
        break;
      }
      
      default:
        console.log('[hook] Custom metadata event pipeline skipped or unhandled action type:', action);
    }

    return SUCCESS();

  } catch (error: any) {
    console.error('[hook] Critical runtime error inside email exception loop:', error.message);
    // Return 200/JSON to prevent Supabase GoTrue backend from infinitely flooding your API with retries
    return SUCCESS();
  }
}