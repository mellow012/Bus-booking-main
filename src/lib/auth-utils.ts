/**
 * Server-side authentication utilities
 * Provides helper functions for API routes to verify and get current user
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';

export interface AuthUser {
  id: string;
  email?: string;
  emailVerified?: boolean;
  role?: string;
  companyId?: string | null;
  firstName?: string;
  lastName?: string;
}

/**
 * Extract and verify Supabase user from request cookies/headers
 * and enrich with profile data from PostgreSQL
 */
export async function getAuthUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user: authUser }, error } = await supabase.auth.getUser();

    if (error || !authUser) {
      console.error('Supabase auth verification failed:', error?.message);
      return null;
    }

    // Fetch role and other metadata from our database
    // We check both id and uid to handle Supabase/Firebase ID mismatches
    const profile = await prisma.user.findFirst({
      where: {
        OR: [
          { id: authUser.id },
          { uid: authUser.id }
        ]
      },
      select: { id: true, role: true, companyId: true, firstName: true, lastName: true }
    });

    return {
      // Return the Database ID as the primary identifier for consistent lookups
      id: profile?.id || authUser.id, 
      email: authUser.email,
      emailVerified: authUser.email_confirmed_at ? true : false,
      role: profile?.role,
      companyId: profile?.companyId,
      firstName: profile?.firstName,
      lastName: profile?.lastName,
    };
  } catch (error) {
    console.error('Auth verification exception:', error);
    return null;
  }
}

/**
 * Get current user from request context
 * This is the function to use in API route handlers
 */
export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  return getAuthUserFromRequest(request);
}
