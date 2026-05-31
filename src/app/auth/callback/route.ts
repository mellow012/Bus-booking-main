import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/reset-password';

  if (code) {
    const supabase = await createClient();
    
    // Exchange the verification string parameter token securely for active app context sessions
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    
    console.error('Code exchange failed against global schema metrics:', error.message);
  }

  // Fallback scenario error catch block matching form fallback state triggers
  return NextResponse.redirect(
    new URL('/login?error=Invalid or expired system security token verification loop.', request.url)
  );
}