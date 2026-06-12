/**
 * Server-side authentication utilities
 * Provides helper functions for API routes to verify and get current user
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { COOKIE_NAME, parseSessionCookieValue } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';

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
    // Fast-path: try signed session cookie to avoid external calls
    try {
      const cookie = request.cookies.get(COOKIE_NAME)?.value;
      if (cookie) {
        const meta = await parseSessionCookieValue(cookie);
        if (meta && meta.userId) {
          try {
            const profile: any = await prisma.user.findUnique({ where: { id: meta.userId }, select: ({ id: true, role: true, companyId: true, firstName: true, lastName: true, email: true, sessionVersion: true } as any) });
            if (profile && (meta.session_version ?? null) === (profile.sessionVersion ?? null)) {
              return {
                id: profile.id,
                email: profile.email ?? undefined,
                emailVerified: undefined,
                role: normalizeRole(profile.role) ?? undefined,
                companyId: profile.companyId ?? null,
                firstName: profile.firstName ?? undefined,
                lastName: profile.lastName ?? undefined,
              };
            }
            // If session versions mismatch, fall through to Supabase verification
          } catch (err) {
            await logger.logError('auth', 'Failed to validate session cookie against DB', err);
          }
        }
      }
    } catch (err) {
      await logger.logError('auth', 'Failed to parse or validate session cookie', err);
    }

    // Fallback to Supabase server auth
    const supabase = await createClient();
    const { data: { user: authUser }, error } = await supabase.auth.getUser();
    if (error || !authUser) {
      await logger.logWarning('auth', `Supabase auth verification failed: ${error?.message ?? 'no user'}`);
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
      select: { id: true, role: true, companyId: true, firstName: true, lastName: true, email: true }
    });

    return {
      // Return the Database ID as the primary identifier for consistent lookups
      id: profile?.id || authUser.id,
      email: profile?.email ?? authUser.email,
      emailVerified: authUser.email_confirmed_at ? true : false,
      role: normalizeRole(profile?.role ?? (authUser.user_metadata as any)?.role) ?? undefined,
      companyId: profile?.companyId ?? null,
      firstName: profile?.firstName ?? undefined,
      lastName: profile?.lastName ?? undefined,
    };
  } catch (error) {
    await logger.logError('auth', 'Auth verification exception', error);
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
