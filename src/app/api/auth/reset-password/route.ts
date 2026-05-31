import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling, createSuccessResponse, Errors } from '@/lib/errorHandler';

export const POST = withErrorHandling(async (request: NextRequest) => {
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
      throw Errors.unauthorized('No active session or user identification found.');
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

    return createSuccessResponse(null, 'Password updated successfully');
});
