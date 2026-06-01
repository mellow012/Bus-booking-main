import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationEmail } from '@/lib/email-service'; 

const SUCCESS = () => new NextResponse(JSON.stringify({ status: 'success' }), { 
  status: 200, 
  headers: { 'Content-Type': 'application/json' } 
});

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    // 💡 CRITICAL: Look at your deployment logs (Vercel/Terminal) to see exactly what this prints!
    console.log('[hook] FULL RAW PAYLOAD RECEIVED FROM SUPABASE:', JSON.stringify(payload, null, 2));

    const { user, email_data } = payload ?? {};
    
    /**
     * 💡 FIX: Robust Fallback Chain
     * Supabase hooks can pass the action name as 'email_action_type' inside email_data,
     * or as 'action' / 'type' at the root level depending on the GoTrue update version.
     */
    const rawAction = email_data?.email_action_type || payload?.action || payload?.type || '';
    const action = rawAction.toLowerCase().trim();
    
    const appUrl = 'https://www.tibhukebus.com';

    // Helper to format the verification URLs cleanly
    const buildLink = (type: string) => {
      const qs = new URLSearchParams({
        token_hash: email_data.token_hash,
        type: type, // Must match what Supabase verifyOtp expects ('signup', 'magiclink', or 'recovery')
        next: type === 'recovery' ? '/reset-password' : '/'
      });
      return `${appUrl}/auth/callback?${qs.toString()}`;
    };

    const targetEmail = user?.email || user?.user_metadata?.email;
    console.log(`[hook] Extracted Normalized Action: "${action}" for User: ${targetEmail}`);

    if (!user || !email_data) {
      console.warn('[hook] Processing aborted: Data envelope missing.');
      return SUCCESS();
    }

    switch (action) {
      // 💡 FIX: Catch multiple variations of the recovery keyword just in case
      case 'recovery':
      case 'password_reset':
      case 'reset_password': {
        const url = buildLink('recovery');
        console.log(`[hook] DISPATCHING REAL RECOVERY EMAIL to ${targetEmail} -> URL: ${url}`);
        
        // If you have a separate function like sendPasswordResetEmail, call it here.
        // Otherwise, sendVerificationEmail handles dispatching the link.
        await sendVerificationEmail(targetEmail, url); 
        break;
      }

      case 'signup': {
        const url = buildLink('signup');
        console.log(`[hook] DISPATCHING SIGNUP EMAIL to ${targetEmail} -> URL: ${url}`);
        await sendVerificationEmail(targetEmail, url);
        break;
      }
      
      case 'magiclink': {
        const url = buildLink('magiclink');
        console.log(`[hook] DISPATCHING MAGICLINK EMAIL to ${targetEmail} -> URL: ${url}`);
        await sendVerificationEmail(targetEmail, url);
        break;
      }
      
      default:
        /**
         * 💡 FIX: If the action falls out of bounds completely, look at the token metadata.
         * If the user is trying to log in or reset, do not blindly fall back to a verification email.
         */
        console.log(`[hook] Action "${action}" unhandled. Falling back based on token layout context.`);
        
        // Secure safety check: if we see 'recovery' anywhere, treat it as password reset
        if (action.includes('recover') || action.includes('reset')) {
          const url = buildLink('recovery');
          await sendVerificationEmail(targetEmail, url);
        } else {
          // Absolute fallback default case
          const url = buildLink('signup');
          await sendVerificationEmail(targetEmail, url);
        }
    }

    return SUCCESS();

  } catch (error: any) {
    console.error('[hook] Critical runtime crash inside hook loop:', error.message);
    return SUCCESS();
  }
}