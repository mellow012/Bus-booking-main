// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { validateCSRFRequest, requiresCSRFProtection } from '@/lib/csrfProtection';

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
  { prefix: '/company/admin',                   roles: ['company_admin'] },
  { prefix: '/company/operator/dashboard',      roles: ['operator']      },
  { prefix: '/company/conductor/dashboard',     roles: ['conductor']     },
  { prefix: '/admin',                           roles: ['superadmin']    },
];

// ─── Public routes (no token required) ───────────────────────────────────────

const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/company/setup',
  '/conductor/setup',
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
  if (pathname.startsWith('/api') && requiresCSRFProtection(method)) {
    const csrfExemptPaths = [
      '/api/csrf-token',
      '/api/auth/login',
      '/api/auth/send-verification-email',
    ];

    const isExempt = csrfExemptPaths.some(path =>
      pathname === path || pathname.startsWith(path + '/')
    );

    if (!isExempt) {
      // ✅ Use validateCSRFRequest() — handles header + cookie comparison internally
      const { valid, error } = validateCSRFRequest(req);
      if (!valid) {
        console.warn(`[CSRF] Rejected ${method} ${pathname}: ${error}`);
        return NextResponse.json(
          { error: error ?? 'CSRF validation failed', success: false },
          { status: 403 }
        );
      }
    }
  }

  // ─── Auth token check ─────────────────────────────────────────────────────
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
    '/conductor/:path*',
    '/admin/:path*',
    '/dashboard/:path*',
  ],
};