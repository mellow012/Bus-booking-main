/**
 * Session Management — Firebase Admin Session Cookies
 *
 * FIX F-08: The previous implementation stored session state in an in-memory
 * JavaScript Map. This silently fails in production because:
 *   (a) All sessions are wiped on every redeploy — users are silently logged out.
 *   (b) Behind a load balancer, each pod has isolated state, so a session
 *       created on pod A is invisible to pod B.
 *
 * This implementation uses Firebase Admin SDK session cookies:
 *   - Sessions are stored as signed, HttpOnly cookies that Firebase verifies.
 *   - Cookie validity is checked against Firebase's servers (revocation-aware).
 *   - Revocation is instant via adminAuth.revokeRefreshTokens().
 *   - No external Redis or database is required.
 *
 * FLOW:
 *   1. Client signs in with Firebase Auth and gets an ID token.
 *   2. Client POSTs the ID token to POST /api/auth/session.
 *   3. Server calls createSessionCookie(), sets the result as an HttpOnly cookie.
 *   4. On subsequent requests, server calls verifySessionCookie() to authenticate.
 *   5. On logout, server calls revokeAndClearSession() to invalidate everywhere.
 *
 * EXAMPLE API ROUTE (App Router):
 *
 *   // POST /api/auth/session
 *   import { createSessionCookie, SESSION_COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/sessionManagement';
 *   import { cookies } from 'next/headers';
 *
 *   export async function POST(request: Request) {
 *     const { idToken } = await request.json();
 *     const sessionCookie = await createSessionCookie(idToken);
 *     if (!sessionCookie) {
 *       return Response.json({ error: 'Invalid token' }, { status: 401 });
 *     }
 *     cookies().set(SESSION_COOKIE_NAME, sessionCookie, COOKIE_OPTIONS);
 *     return Response.json({ status: 'ok' });
 *   }
 *
 *   // DELETE /api/auth/session (logout)
 *   import { revokeAndClearSession } from '@/lib/sessionManagement';
 *   export async function DELETE(request: Request) {
 *     await revokeAndClearSession(request);
 *     return Response.json({ status: 'ok' });
 *   }
 */

import { adminAuth } from './firebaseAdmin';
import { logger } from './logger';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

// ─── Constants ────────────────────────────────────────────────────────────────

export const SESSION_COOKIE_NAME = '__session';

/** Session lifetime: 5 days. Firebase supports up to 14 days. */
const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const COOKIE_OPTIONS = {
  name: SESSION_COOKIE_NAME,
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: 'lax' as const, // 'lax' allows redirect-based OAuth flows
  path: '/',
  maxAge: SESSION_DURATION_MS / 1000,
};

// ─── Session data returned after verification ─────────────────────────────────

export interface VerifiedSession {
  uid: string;
  email?: string;
  /** Role from Firebase Auth custom claims — set by Cloud Functions only. */
  role?: string;
  /** Company ID from Firebase Auth custom claims. */
  companyId?: string;
  /** Seconds until the session cookie expires. */
  expiresIn: number;
}

// ─── Cookie creation ──────────────────────────────────────────────────────────

/**
 * Exchange a Firebase ID token for a long-lived session cookie.
 * Returns the cookie value string, or null if the ID token is invalid.
 *
 * Call this server-side immediately after the client signs in and sends
 * the ID token to your POST /api/auth/session endpoint.
 */
export async function createSessionCookie(idToken: string): Promise<string | null> {
  try {
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
    return sessionCookie;
  } catch (error: any) {
    await logger.logError('auth', 'Failed to create session cookie', error, {
      action: 'session_cookie_create_error',
    });
    return null;
  }
}

// ─── Cookie verification ──────────────────────────────────────────────────────

/**
 * Verify a session cookie and return the decoded claims.
 *
 * Pass checkRevoked = true (default) to detect revoked sessions immediately.
 * This makes one network call to Firebase; pass false for latency-sensitive
 * paths where you are willing to accept up to 1-hour stale sessions.
 *
 * Returns null if the cookie is missing, expired, or revoked.
 */
export async function verifySessionCookie(
  sessionCookie: string,
  checkRevoked = true
): Promise<VerifiedSession | null> {
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, checkRevoked);
    return {
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role as string | undefined,
      companyId: decoded.companyId as string | undefined,
      expiresIn: Math.floor((decoded.exp * 1000 - Date.now()) / 1000),
    };
  } catch {
    // Cookie expired, revoked, or tampered — treat as unauthenticated
    return null;
  }
}

/**
 * Verify the session cookie from an incoming Next.js request.
 * Reads the cookie from the request automatically.
 */
export async function verifyRequestSession(
  request: NextRequest,
  checkRevoked = true
): Promise<VerifiedSession | null> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;
  return verifySessionCookie(sessionCookie, checkRevoked);
}

// ─── Logout / revocation ──────────────────────────────────────────────────────

/**
 * Revoke all Firebase refresh tokens for a user and clear the session cookie.
 *
 * This immediately invalidates the session on all devices. Firebase session
 * cookies are verified against the revocation timestamp on the next check.
 */
export async function revokeAndClearSession(request: NextRequest): Promise<void> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    try {
      // Verify without checking revocation so we can get the UID even for
      // an already-revoked cookie (idempotent logout).
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, false);
      await adminAuth.revokeRefreshTokens(decoded.uid);

      await logger.logSecurityEvent('Session revoked and refresh tokens cleared', undefined, {
        userId: decoded.uid,
        action: 'session_revoked',
      });
    } catch {
      // Cookie was already invalid — nothing to revoke
    }
  }

  // Clear the cookie from the client regardless
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
}

/**
 * Revoke all refresh tokens for a user by UID (admin action — no cookie needed).
 * Use this for password changes, security incidents, or admin-forced logouts.
 */
export async function revokeRefreshTokens(userId: string): Promise<void> {
  try {
    await adminAuth.revokeRefreshTokens(userId);
    await logger.logSecurityEvent('Refresh tokens revoked for user', undefined, {
      userId,
      action: 'tokens_revoked',
    });
  } catch (error: any) {
    await logger.logError('security', 'Failed to revoke tokens', error, {
      userId,
      action: 'token_revoke_error',
    });
  }
}

// ─── Session statistics (for monitoring dashboards) ───────────────────────────
// NOTE: Firebase does not provide a list of active session cookies.
// For monitoring active sessions, write session metadata to Firestore
// when creating a session cookie and clean it up on revocation.
// This is optional and outside the scope of this security fix.