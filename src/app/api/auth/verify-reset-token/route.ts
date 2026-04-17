import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, token_hash } = body;
    
    const actualToken = token_hash || token;

    if (!actualToken) {
      return NextResponse.json(
        { error: 'Bad request', message: 'Token is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Verify the OTP (recovery token)
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: actualToken,
      type: 'recovery',
    });

    if (error) {
      console.error('[verify-reset-token] verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid token', message: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      email: data.user?.email,
      message: 'Token verified successfully',
    });

  } catch (error: any) {
    console.error('[verify-reset-token] Unhandled error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
