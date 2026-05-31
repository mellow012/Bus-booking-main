import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type');
    const next = searchParams.get('next') ?? '/';

    if (token_hash && type) {
      const supabase = await createClient();

      // verifyOtp is the standard method to handle PKCE token hashes
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any,
      });

      if (!error) {
        // Success: Redirect to recovery page or the 'next' destination
        if (type === 'recovery') {
          return NextResponse.redirect(`${origin}/reset-password`);
        }
        
        return NextResponse.redirect(`${origin}${next}`);
      }
      
      console.error('[auth callback] Verification error:', error.message);
      const errorUrl = new URL('/login', origin);
      errorUrl.searchParams.set('error', error.message);
      return NextResponse.redirect(errorUrl);
    }

    // Handle OAuth code exchange if present
    const code = searchParams.get('code');
    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    }
  } catch (err: any) {
    console.error('[auth callback] Critical error:', err.message);
  }

  return NextResponse.redirect(new URL('/login?error=Invalid link', request.url));
}