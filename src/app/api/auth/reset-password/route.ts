import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, email } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Bad request', message: 'Password is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Update the password in Supabase Auth
    // This works if the user is authenticated (e.g. after clicking the recovery link)
    const { data: { user }, error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      console.error('[reset-password] update failed:', error);
      return NextResponse.json(
        { error: 'Failed to update password', message: error.message },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No active session found. Please request a new reset link.' },
        { status: 401 }
      );
    }

    // Also update the user record in PostgreSQL to mark password as set
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordSet: true,
          updatedAt: new Date(),
        },
      });
    } catch (dbError) {
      console.error('[reset-password] prisma update failed:', dbError);
      // We don't fail the request if Prisma update fails, but we log it
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
    });

  } catch (error: any) {
    console.error('[reset-password] Unhandled error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
