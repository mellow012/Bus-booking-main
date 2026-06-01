import { NextRequest, NextResponse } from 'next/server';
// 💡 FIX: Import the regular customer password reset template helper here
import { sendVerificationEmail, sendGenericPasswordResetEmail } from '@/lib/email-service'; 

const SUCCESS = () => new NextResponse(JSON.stringify({ status: 'success' }), { 
  status: 200, 
  headers: { 'Content-Type': 'application/json' } 
});

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    console.log('[hook] FULL RAW PAYLOAD RECEIVED FROM SUPABASE:', JSON.stringify(payload, null, 2));

    const { user, email_data } = payload ?? {};
    
    const rawAction = email_data?.email_action_type || payload?.action || payload?.type || '';
    const action = rawAction.toLowerCase().trim();
    
    const appUrl = 'https://www.tibhukebus.com';

    // Helper to format the verification URLs cleanly
    const buildLink = (type: string) => {
      const qs = new URLSearchParams({
        token_hash: email_data.token_hash,
        type: type, 
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
      case 'recovery':
      case 'password_reset':
      case 'reset_password': {
        const url = buildLink('recovery');
        console.log(`[hook] DISPATCHING REAL RECOVERY EMAIL to ${targetEmail} -> URL: ${url}`);
        
        // 💡 FIX: Swapped out verification utility for the generic reset layout helper
        await sendGenericPasswordResetEmail(targetEmail, url); 
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
        console.log(`[hook] Action "${action}" unhandled. Falling back based on token layout context.`);
        
        if (action.includes('recover') || action.includes('reset')) {
          const url = buildLink('recovery');
          // 💡 FIX: Match fallback context layout too
          await sendGenericPasswordResetEmail(targetEmail, url);
        } else {
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