import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    const supabase = await createClient();
    
    // Get the user from the current session
    const { data: { user } } = await supabase.auth.getUser();

    // Use the authenticated user ID if available, otherwise fallback to email
    // (The client already verified the password update with Supabase Auth)
    const identifier = user?.id 
      ? { id: user.id } 
      : (email ? { email: email.toLowerCase() } : null);

    if (!identifier) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No active session or user identification found.' },
        { status: 401 }
      );
    }

    // Also update the user record in PostgreSQL to mark password as set
    try {
      await prisma.user.update({
        where: identifier as any,
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
