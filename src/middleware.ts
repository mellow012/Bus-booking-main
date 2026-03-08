// middleware.ts
// ─────────────────────────────────────────────────────────────────────────────
// Edge Runtime middleware — verifies the __session cookie (Firebase ID token)
// on every request.
//
// WHAT THIS DOES:
//   1. Skips static assets, webhooks, and file requests
//   2. Blocks cross-origin state-changing requests (CSRF)
//   3. Verifies the __session ID token with jose
//   4. Redirects unauthenticated users away from protected routes → /login
//   5. Redirects authenticated users away from /login and /register
//   6. Blocks unverified email users from accessing the app → /verify-email
//   7. Forwards x-user-id / x-user-role / x-company-id headers downstream
//
// WHAT THIS DOES NOT DO (handled by AuthContext route guard instead):
//   Role-based access control — e.g. preventing an operator from hitting a
//   company_admin URL. AuthContext reads the Firestore profile (which has the
//   correct role) and redirects accordingly. Middleware cannot safely read
//   Firestore from Edge Runtime, and custom claims in the JWT are only
//   populated if you explicitly call setCustomUserClaims() server-side.
//   If you add custom claim population later, you can re-add role guards here.
//
// ID TOKEN NOTE:
//   Firebase session cookies use a non-standard JWKS format that jose can't
//   parse. We store the raw ID token in __session and verify it as an ID token.
//   Tokens expire in 1 hour; AuthContext's onIdTokenChanged handler refreshes
//   the cookie automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;

if (!FIREBASE_PROJECT_ID) {
  throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set');
}

const ID_TOKEN_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const ID_TOKEN_ISSUER   = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const JWKS = jose.createRemoteJWKSet(new URL(ID_TOKEN_JWKS_URL));

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

// Routes that bypass the email-verification gate
const VERIFICATION_EXEMPT_ROUTES = [
  '/verify-email',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

// ─── Token verification ───────────────────────────────────────────────────────

interface TokenClaims {
  uid:            string;
  role?:          string;
  companyId?:     string;
  email_verified?: boolean;
}

async function verifyToken(token: string): Promise<TokenClaims | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer:   ID_TOKEN_ISSUER,
      audience: FIREBASE_PROJECT_ID,
    });
    return {
      uid:            payload.sub               as string,
      role:           payload['role']           as string  | undefined,
      companyId:      payload['companyId']      as string  | undefined,
      email_verified: payload['email_verified'] as boolean | undefined,
    };
  } catch {
    return null;
  }
}

function getTokens(request: NextRequest) {
  const authHeader  = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = request.cookies.get('__session')?.value ?? null;
  return { cookieToken, bearerToken };
}

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

  // Verify identity — try cookie first, then Bearer header
  const { cookieToken, bearerToken } = getTokens(request);
  let claims: TokenClaims | null = null;
  if (cookieToken)  claims = await verifyToken(cookieToken);
  if (!claims && bearerToken) claims = await verifyToken(bearerToken);

  const isAuth = !!claims;

  console.log(
    `[middleware] ${pathname} | cookie=${cookieToken ? 'present' : 'MISSING'} | auth=${isAuth} | verified=${claims?.email_verified ?? 'n/a'}`
  );

  // ── Redirect authenticated users away from login/register ─────────────────
  if (isAuth && AUTH_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // ── Email verification gate ────────────────────────────────────────────────
  // If the user is authenticated but email not verified, send them to
  // /verify-email unless the route is explicitly exempt.
  if (isAuth && !(claims!.email_verified ?? false)) {
    const isExempt = VERIFICATION_EXEMPT_ROUTES.some(r => pathname.startsWith(r));
    if (!isExempt) {
      return NextResponse.redirect(new URL('/verify-email', request.url));
    }
  }

  // ── Protect routes that require authentication ─────────────────────────────
  const needsAuth = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  if (needsAuth && !isAuth) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // NOTE: Role-based access control (e.g. company_admin vs operator) is
  // intentionally NOT checked here. AuthContext reads the Firestore user
  // profile (which is always accurate) and handles all role redirects
  // client-side. Adding role guards here requires custom JWT claims to be
  // explicitly set via Admin SDK setCustomUserClaims() — if you add that,
  // you can restore the ROLE_ROUTES block.

  // ── Forward identity headers to downstream handlers ────────────────────────
  const response = NextResponse.next();
  if (claims) {
    response.headers.set('x-user-id',   claims.uid);
    response.headers.set('x-user-role', claims.role ?? '');
    if (claims.companyId) response.headers.set('x-company-id', claims.companyId);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};