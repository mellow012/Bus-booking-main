import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, createSessionCookieValue, parseSessionCookieValue } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { logger } from '@/lib/logger';

const forceCrossSiteCookies = process.env.NODE_ENV === 'production';

function normalizeCookieOptions(name: string, options?: Record<string, any>) {
  const normalized = { ...(options ?? {}) };
  const isAuthCookie = name === COOKIE_NAME || name.startsWith('sb-') || name.includes('supabase');

  if (isAuthCookie) {
    if (forceCrossSiteCookies) {
      normalized.sameSite = 'none';
      normalized.secure = true;
    } else {
      normalized.sameSite = normalized.sameSite ?? 'lax';
    }
  }

  return normalized;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, normalizeCookieOptions(name, options))
          );
        },
      },
    }
  );

  // Refresh session if expired — do NOT add any logic between createServerClient
  // and supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // session issues.
  // Fast-path: check signed session meta cookie to avoid calling Supabase on every request
  try {
    const cookie = request.cookies.get(COOKIE_NAME)?.value;
    if (cookie) {
      const meta = await parseSessionCookieValue(cookie);
      if (meta && meta.userId) {
        // Use the signed cookie payload as the fast-path identity for Edge runtime.
        // Normalize role variants (super_admin vs superadmin etc) to canonical values
        const normRole = normalizeRole(meta.role);
        return { supabaseResponse, user: { id: meta.userId, email: undefined, user_metadata: { role: normRole } }, role: normRole ?? null };
      }
    }
  } catch (err) {
    await logger.logError('auth', 'Failed to parse session cookie', err);
  }

  // Fallback: ask Supabase for the auth user and hydrate session cookie
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabaseResponse, user: null, role: null };

  // Resolve role from Supabase metadata. Do not call Prisma here (Edge runtime).
    try {
      const rawRole = (user.user_metadata as any)?.role ?? null;
      const role = normalizeRole(rawRole);
      const session_version: number | null = null;
      try {
        const cookieValue = await createSessionCookieValue({ userId: String(user.id as any), role, session_version });
        supabaseResponse.cookies.set(COOKIE_NAME, cookieValue, normalizeCookieOptions(COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' }));
      } catch (err) {
        await logger.logError('auth', 'Failed to set session cookie', err);
      }

      return { supabaseResponse, user, role };
    } catch (err) {
      await logger.logError('auth', 'Failed to resolve DB user for session', err);
      return { supabaseResponse, user, role: normalizeRole((user.user_metadata as any)?.role ?? null) };
    }
}
