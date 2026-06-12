import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';
import { logger } from '@/lib/logger';

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

type AppRole = 'superadmin' | 'company_admin' | 'operator' | 'conductor' | 'customer';

const ROLE_ROUTE_MAP: Array<{ prefix: string; allowed: AppRole[] }> = [
  { prefix: '/admin',             allowed: ['superadmin'] },
  { prefix: '/company/admin',     allowed: ['company_admin', 'superadmin'] },
  { prefix: '/company/operator',  allowed: ['operator', 'company_admin', 'superadmin'] },
  { prefix: '/company/conductor', allowed: ['conductor', 'company_admin', 'superadmin'] },
];

function isCsrfSafe(request: NextRequest): boolean {
  const { method } = request;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;
  const origin = request.headers.get('origin');
  const host   = request.headers.get('host');
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 💡 FIX: Explicitly ignore the auth callback engine pathing entirely 
  // to ensure server-side OTP token/code cookie generation routines complete without middleware interference.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/auth/supabase-email-hook') || 
    pathname.startsWith('/auth/callback') || 
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // CSRF guard for state-changing requests
  if (!isCsrfSafe(request)) {
    logger.logWarning('security', `CSRF violation blocked: ${request.method} ${pathname}`);
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Refresh Supabase session & get the current user
  const { supabaseResponse, user, role } = await updateSession(request);
  const isAuth = !!user;

  // ── Redirect authenticated users away from login/register ─────────────────
  if (isAuth && AUTH_ROUTES.some(r => pathname.startsWith(r))) {
    const redirectUrl = new URL('/', request.url);
    // 💡 FIX: Merge the cookie headers into the redirect response!
    const res = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach(cookie => {
      res.cookies.set(cookie.name, cookie.value, cookie);
    });
    return res;
  }

  // ── Protect routes that require authentication ─────────────────────────────
  const needsAuth = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  if (needsAuth && !isAuth) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    
    // Pass cookies downstream even on unauthenticated blocks to clear old corrupted tracking keys safely
    const res = NextResponse.redirect(loginUrl);
    supabaseResponse.cookies.getAll().forEach(cookie => {
      res.cookies.set(cookie.name, cookie.value, cookie);
    });
    return res;
  }

  // ── RBAC: Enforce role-based access for authenticated users ───────────────
  if (isAuth && role) {
    const matched = ROLE_ROUTE_MAP.find(entry => pathname.startsWith(entry.prefix));
    if (matched && !matched.allowed.includes(role as AppRole)) {
      logger.logWarning('security', `RBAC blocked: role="${role}" tried to access "${pathname}"`, { metadata: { role, pathname } });
      const res = NextResponse.redirect(new URL('/unauthorized', request.url));
      supabaseResponse.cookies.getAll().forEach(cookie => {
        res.cookies.set(cookie.name, cookie.value, cookie);
      });
      return res;
    }
  }

  // Forward user identity header to downstream API handlers
  if (user) {
    const u: any = user as any;
    supabaseResponse.headers.set('x-user-id', u.id);
    supabaseResponse.headers.set('x-user-email', u.email ?? '');
    if (role) supabaseResponse.headers.set('x-user-role', role);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};