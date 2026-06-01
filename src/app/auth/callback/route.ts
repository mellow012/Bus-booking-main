import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type'); // 💡 Will be 'signup', 'magiclink', or 'recovery'
  
  // Hard-align the base URL to your production domain to prevent Vercel domain splitting
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.tibhukebus.com';
  
  // 💡 FIX: Intelligently determine where the user should land next.
  // If it's a password reset link (recovery), send them directly to the reset form.
  let next = requestUrl.searchParams.get('next');
  if (!next) {
    next = type === 'recovery' ? '/reset-password' : '/';
  }

  // Build the strict redirection target on your production domain
  const redirectTo = new URL(next, appBaseUrl);
  const response = NextResponse.redirect(redirectTo);

  if (tokenHash && type) {
    const supabase = await createClient();

    // 💡 FIX: Verifies the OTP with the matching type passed from your email hook
    const { error } = await supabase.auth.verifyOtp({
      type: type as any, // Casts perfectly to 'signup' | 'recovery' | 'magiclink' etc.
      token_hash: tokenHash,
    });

    if (!error) {
      console.log(`[callback] Successfully verified OTP token for type: "${type}". Forwarding to: ${redirectTo.href}`);
      
      // The session cookies are now embedded in the background; pass them to the browser
      return response;
    }

    console.error(`[callback] Supabase OTP verification failed for type "${type}":`, error.message);
    return NextResponse.redirect(
      new URL(`/login?error=The verification link is invalid or has expired. Please try requesting a new one.`, appBaseUrl)
    );
  }

  console.warn('[callback] Missing token_hash or type parameters in the URL request.');
  return NextResponse.redirect(
    new URL('/login?error=Malformed authentication link callback loop.', appBaseUrl)
  );
}