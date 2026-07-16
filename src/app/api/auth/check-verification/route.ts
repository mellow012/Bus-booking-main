// app/api/auth/check-verification/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/check-verification
//
// Checks whether the authenticated user's email is verified according to
// Supabase Auth (the source of truth).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authentication session' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success:       true,
        uid:           user.id,
        email:         user.email,
        emailVerified: !!user.email_confirmed_at,
        message:       user.email_confirmed_at
          ? 'Email is verified'
          : 'Email verification pending',
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('[check-verification] Unhandled error:', error);
    return NextResponse.json(
      {
        error:   'Internal server error',
        message: error.message || 'Failed to check verification status',
      },
      { status: 500 }
    );
  }
}
