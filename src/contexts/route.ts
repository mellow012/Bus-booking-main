import { createClient } from '@/utils/supabase/server'; // Ensure you have a server-side client utility
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
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
      // Special handling for recovery: Ensure they land on the reset page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      
      // Successful verification for other types (signup, invite, etc.)
      return NextResponse.redirect(`${origin}${next}`);
    }
    
    console.error('[auth callback] Verification error:', error.message);
  }

  // If verification fails, redirect to login with a descriptive error
  const errorUrl = new URL('/login', origin);
  errorUrl.searchParams.set('error', 'The verification link is invalid or has expired.');
  return NextResponse.redirect(errorUrl);
}