// middleware.ts
// ─────────────────────────────────────────────────────────────────────────────
// Next.js middleware — validates the Supabase session on every request.
//
// WHAT THIS DOES:
//   1. Skips static assets, webhooks, and file requests
//   2. Delegates session refresh to the Supabase SSR helper
//   3. Redirects unauthenticated users away from protected routes → /login
//   4. Redirects authenticated users away from /login and /register → /
//   5. Enforces role-based access control (RBAC) on dashboard routes
//   6. Forwards x-user-id, x-user-email, x-user-role headers downstream
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

// ─── Route definitions ────────────────────────────────────────────────────────

// Routes that require the user to be logged in
const PROTECTED_ROUTES = [
  '/bookings',
  '/book',
  '/profile',
  '/company/admin',
  '/company/operator',
  '/company/conductor',
  '/admin',
];

// Routes that logged-in users should be bounced away from
const AUTH_ROUTES = ['/login', '/register'];

// ─── RBAC: which roles may access which route prefixes ────────────────────────
//
// If a user is authenticated but their role is NOT in the allowed list,
// they are redirected to /unauthorized.
//
// The role is read from the Supabase JWT user_metadata.role field, which is
// synced from our Postgres User table on login and staff invitation.
// If the metadata has not been synced yet the RBAC check is skipped gracefully
// (the client-side AuthContext guard acts as a secondary safety layer).
//
type AppRole = 'superadmin' | 'company_admin' | 'operator' | 'conductor' | 'customer';

const ROLE_ROUTE_MAP: Array<{ prefix: string; allowed: AppRole[] }> = [
  { prefix: '/admin',             allowed: ['superadmin'] },
  { prefix: '/company/admin',     allowed: ['company_admin', 'superadmin'] },
  { prefix: '/company/operator',  allowed: ['operator', 'company_admin', 'superadmin'] },
  { prefix: '/company/conductor', allowed: ['conductor', 'company_admin', 'superadmin'] },
];

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
    pathname.startsWith('/api/auth/supabase-email-hook') || 
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // CSRF guard for state-changing requests
  if (!isCsrfSafe(request)) {
    console.warn(`[middleware] CSRF violation blocked: ${request.method} ${pathname}`);
    return new NextResponse('Forbidden', { status: 403 });
  }

  // ── Refresh Supabase session & get the current user ────────────────────────
  // updateSession() MUST be called before any redirect logic to ensure
  // the session cookie is refreshed on every request.
  const { supabaseResponse, user, role } = await updateSession(request);

  const isAuth = !!user;

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

  // ── RBAC: Enforce role-based access for authenticated users ───────────────
  // Only enforce when the role is present in JWT metadata.
  // If role is missing (metadata not yet synced), skip and let client-side guard handle it.
  if (isAuth && role) {
    const matched = ROLE_ROUTE_MAP.find(entry => pathname.startsWith(entry.prefix));
    if (matched && !matched.allowed.includes(role as AppRole)) {
      console.warn(
        `[middleware] RBAC blocked: role="${role}" tried to access "${pathname}" ` +
        `(allowed: ${matched.allowed.join(', ')})`
      );
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // ── Forward user identity header to downstream API handlers ───────────────
  if (user) {
    supabaseResponse.headers.set('x-user-id', user.id);
    supabaseResponse.headers.set('x-user-email', user.email ?? '');
    if (role) supabaseResponse.headers.set('x-user-role', role);
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