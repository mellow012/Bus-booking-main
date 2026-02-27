// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { validateCSRFToken, requiresCSRFProtection } from '@/lib/csrfProtection';

if (!getApps().length) {
  const sanitizePrivateKey = (key?: string) =>
    key ? key.replace(/\\n/g, '\n').replace(/\r/g, '').replace(/^"|"$/g, '').trim() : undefined;

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
  });
}

// ─── Route → allowed roles ────────────────────────────────────────────────────
// Add new protected prefixes here — no changes needed elsewhere.

const ROLE_PROTECTED_ROUTES: { prefix: string; roles: string[] }[] = [
  { prefix: '/company/admin',          roles: ['company_admin'] },
  { prefix: '/company/operator/dashboard',     roles: ['operator'] },
  { prefix: '/company/conductor/dashboard',    roles: ['conductor'] },           // NEW
  { prefix: '/admin',            roles: ['superadmin'] },
];

// ─── Public routes (no token required) ───────────────────────────────────────

const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/company/setup',
  '/conductor/setup',           // NEW — password-reset landing for conductors
  '/operator/signup',
  '/',
  '/about',
  '/contact',
];

const isPublicRoute = (pathname: string): boolean =>
  PUBLIC_PREFIXES.some(prefix =>
    prefix === '/' ? pathname === '/' : pathname.startsWith(prefix)
  );

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // Always allow public routes through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // ─── CSRF Protection for API routes ───────────────────────────────────────

  // Only check CSRF for state-changing requests on API endpoints
  if (pathname.startsWith('/api') && requiresCSRFProtection(method)) {
    // Whitelist endpoints that don't need CSRF (e.g., public APIs, auth endpoints)
    const csrfExemptPaths = [
      '/api/csrf-token', // token endpoint itself
      '/api/auth/login',
      '/api/auth/send-verification-email', // public endpoint
    ];

    const isExempt = csrfExemptPaths.some(path =>
      pathname === path || pathname.startsWith(path + '/')
    );

    if (!isExempt) {
      // Get CSRF token from header or cookie
      const headerToken = req.headers.get('x-csrf-token');
      const cookieToken = req.cookies.get('csrf_token')?.value;

      if (!headerToken) {
        console.warn(`[CSRF] Missing token on ${method} ${pathname}`);
        return NextResponse.json(
          { error: 'CSRF token required', success: false },
          { status: 403 }
        );
      }

      // Validate both header token and cookie token are present and match
      if (!cookieToken || !validateCSRFToken(headerToken)) {
        console.warn(`[CSRF] Invalid token on ${method} ${pathname}`);
        return NextResponse.json(
          { error: 'Invalid CSRF token', success: false },
          { status: 403 }
        );
      }
    }
  }

  const token = req.cookies.get('token')?.value;

  if (!token) {
    console.log(`[middleware] No token on ${pathname} — redirecting to /login`);
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    const userRole = decodedToken.role as string | undefined;

    // Check each role-protected prefix
    for (const { prefix, roles } of ROLE_PROTECTED_ROUTES) {
      if (pathname.startsWith(prefix)) {
        if (!userRole || !roles.includes(userRole)) {
          console.log(
            `[middleware] Role "${userRole}" not allowed on ${pathname} — redirecting`
          );
          return NextResponse.redirect(new URL('/login', req.url));
        }
        break; // matched — no need to check further prefixes
      }
    }

    return NextResponse.next();
  } catch (error) {
    console.error('[middleware] Token verification error:', error);
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

// ─── Matcher ──────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    '/company/:path*',
    '/operator/:path*',
    '/conductor/:path*',         // NEW
    '/admin/:path*',
    '/dashboard/:path*',
  ],
};