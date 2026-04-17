// middleware.ts
// ─────────────────────────────────────────────────────────────────────────────
// Next.js middleware — validates the Supabase session on every request.
//
// WHAT THIS DOES:
//   1. Skips static assets, webhooks, and file requests
//   2. Delegates session refresh to the Supabase SSR helper
//   3. Redirects unauthenticated users away from protected routes → /login
//   4. Redirects authenticated users away from /login and /register → /
//   5. Forwards x-user-id header downstream for API route convenience
//
// WHAT THIS DOES NOT DO (handled by AuthContext client-side route guard):
//   Role-based access control (e.g. preventing a conductor from accessing
//   /company/admin). The SQL profile is the source of truth for roles.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

// ─── Route definitions ────────────────────────────────────────────────────────

// Routes that require the user to be logged in
const PROTECTED_ROUTES = [
  '/bookings',
  '/book',
  '/profile',
  '/dashboard',
  '/company/admin',
  '/company/operator',
  '/company/conductor',
  '/admin',
];

// Routes that logged-in users should be bounced away from
const AUTH_ROUTES = ['/login', '/register'];

// ─── CSRF helper ──────────────────────────────────────────────────────────────

function isCsrfSafe(request: NextRequest): boolean {
  const { method } = request;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;
  const origin = request.headers.get('origin');
  const host   = request.headers.get('host');
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files, Next internals, and webhooks
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // CSRF guard for state-changing requests
  if (!isCsrfSafe(request)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // ── Refresh Supabase session & get the current user ────────────────────────
  // updateSession() MUST be called before any redirect logic to ensure
  // the session cookie is refreshed on every request.
  const { supabaseResponse, user } = await updateSession(request);

  const isAuth = !!user;

  console.log(
    `[middleware] ${pathname} | user=${user?.email ?? 'ANONYMOUS'} | auth=${isAuth}`
  );

  // ── Redirect authenticated users away from login/register ─────────────────
  if (isAuth && AUTH_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // ── Protect routes that require authentication ─────────────────────────────
  const needsAuth = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  if (needsAuth && !isAuth) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Forward user identity header to downstream API handlers ───────────────
  if (user) {
    supabaseResponse.headers.set('x-user-id', user.id);
    supabaseResponse.headers.set('x-user-email', user.email ?? '');
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - svg, png, jpg, jpeg, gif, webp images
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};