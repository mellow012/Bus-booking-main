// middleware.ts
// ─────────────────────────────────────────────────────────────────────────────
// Runs on Edge Runtime — must NOT import firebase-admin (uses Node.js APIs).
// We verify Firebase ID tokens using `jose`, which is Edge-compatible.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const PROTECTED_ROUTES = ['/bookings', '/book', '/profile', '/dashboard'];

const ROLE_ROUTES: { path: string; roles: string[] }[] = [
  { path: '/company/admin',               roles: ['company_admin', 'superadmin'] },
  { path: '/company/operator/dashboard',  roles: ['operator', 'company_admin', 'superadmin'] },
  { path: '/company/conductor/dashboard', roles: ['conductor', 'company_admin', 'superadmin'] },
  { path: '/admin',                       roles: ['superadmin'] },
];

const AUTH_ROUTES = ['/login', '/register'];

// JWKS client — jose fetches & caches Firebase's public keys automatically
const JWKS = jose.createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

async function verifyFirebaseToken(token: string): Promise<{ uid: string; role?: string; companyId?: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer:   `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    return {
      uid:       payload.sub as string,
      role:      payload['role']      as string | undefined,
      companyId: payload['companyId'] as string | undefined,
    };
  } catch {
    return null;
  }
}

function getToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  const sessionCookie = request.cookies.get('__session')?.value;
  if (sessionCookie) return sessionCookie;
  return null;
}

function isCsrfSafe(request: NextRequest): boolean {
  const method = request.method;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;
  const origin = request.headers.get('origin');
  const host   = request.headers.get('host');
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api/webhooks') || pathname.includes('.')) {
    return NextResponse.next();
  }

  if (!isCsrfSafe(request)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const token  = getToken(request);
  const claims = token ? await verifyFirebaseToken(token) : null;
  const isAuth = !!claims;

  if (isAuth && AUTH_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const needsAuth = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  if (needsAuth && !isAuth) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuth && claims) {
    const roleRoute = ROLE_ROUTES.find(r => pathname.startsWith(r.path));
    if (roleRoute && !roleRoute.roles.includes(claims.role ?? '')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

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