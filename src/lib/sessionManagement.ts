// lib/sessionManagement.ts
// ─────────────────────────────────────────────────────────────────────────────
// Firebase Admin SDK session cookie management.
//
// FLOW:
//   1. Client calls signInWithEmailAndPassword → gets a Firebase User.
//   2. Client calls user.getIdToken() → sends to POST /api/auth/session.
//   3. Server calls createSessionCookie() → sets __session HttpOnly cookie.
//   4. Edge middleware verifies __session on every request via jose.
//   5. On logout, client calls DELETE /api/auth/session.
//   6. Server calls revokeAndClearSession() → clears the cookie only.
//
// IMPORTANT — we do NOT revoke refresh tokens on normal logout.
//   revokeRefreshTokens() is a nuclear option that breaks token refresh
//   (securetoken 400 errors) across all devices. Use revokeRefreshTokensByUid()
//   only for security incidents, password changes, or account suspension.
// ─────────────────────────────────────────────────────────────────────────────

import { adminAuth } from './firebaseAdmin';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

// ─── Constants ────────────────────────────────────────────────────────────────

export const SESSION_COOKIE_NAME = '__session';

/** Session lifetime: 5 days. Firebase supports 1 hour – 14 days. */
const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const COOKIE_OPTIONS = {
  name:     SESSION_COOKIE_NAME,
  httpOnly: true,
  secure:   IS_PRODUCTION,
  sameSite: 'lax' as const,
  path:     '/',
  maxAge:   SESSION_DURATION_MS / 1000,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerifiedSession {
  uid: string;
  email?: string;
  role?: string;
  companyId?: string;
  emailVerified: boolean;
  expiresIn: number;
}

// ─── Cookie creation ──────────────────────────────────────────────────────────

/**
 * Exchange a Firebase ID token for a long-lived session cookie string.
 * Returns null if the ID token is invalid or expired.
 */
export async function createSessionCookie(idToken: string): Promise<string | null> {
  if (!idToken) return null;

  try {
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
    return sessionCookie;
  } catch (error: any) {
    console.error('[sessionManagement] createSessionCookie failed:', error.code, error.message);
    return null;
  }
}

// ─── Cookie verification ──────────────────────────────────────────────────────

/**
 * Verify a session cookie string and return decoded claims.
 * Returns null if cookie is absent, expired, tampered, or revoked.
 *
 * @param checkRevoked  When true (default), makes a network call to Firebase
 *                      to detect revoked sessions. Pass false only for
 *                      latency-sensitive read-only endpoints.
 */
export async function verifySessionCookie(
  sessionCookie: string,
  checkRevoked = true
): Promise<VerifiedSession | null> {
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, checkRevoked);

    return {
      uid:           decoded.uid,
      email:         decoded.email,
      role:          decoded['role']      as string | undefined,
      companyId:     decoded['companyId'] as string | undefined,
      emailVerified: decoded.email_verified ?? false,
      expiresIn:     Math.floor((decoded.exp * 1000 - Date.now()) / 1000),
    };
  } catch {
    return null;
  }
}

/**
 * Verify the __session cookie from an incoming Next.js request.
 */
export async function verifyRequestSession(
  request: NextRequest,
  checkRevoked = true
): Promise<VerifiedSession | null> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;
  return verifySessionCookie(sessionCookie, checkRevoked);
}

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * Clear the __session cookie on normal logout.
 *
 * We intentionally do NOT call revokeRefreshTokens() here.
 *
 * Why: revokeRefreshTokens() invalidates ALL sessions across ALL devices and
 * prevents the user from obtaining new ID tokens until they sign in again.
 * This causes securetoken.googleapis.com 400 errors on any subsequent
 * token refresh attempt — including the session cookie refresh we do after
 * email verification. Clearing the cookie alone is sufficient for logout:
 * the middleware finds no valid __session and treats the user as signed out.
 *
 * Use revokeRefreshTokensByUid() only for:
 *   - Compromised account / security incident
 *   - Admin-forced logout
 *   - Password change (force re-auth everywhere)
 */
export async function revokeAndClearSession(request: NextRequest): Promise<void> {
  // We still accept the request parameter for API compatibility but no
  // longer read the cookie to extract a UID for revocation.
  void request;

  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, '', {
      ...COOKIE_OPTIONS,
      maxAge: 0,
    });
  } catch (error: any) {
    console.error('[sessionManagement] Failed to clear session cookie:', error.message);
  }
}

/**
 * Revoke all refresh tokens for a user by UID (security/admin action only).
 *
 * Use this for: password changes, compromised accounts, admin-forced logouts.
 * Do NOT call this on normal user logout — see revokeAndClearSession().
 */
export async function revokeRefreshTokensByUid(userId: string): Promise<void> {
  if (!userId) throw new Error('userId is required');

  try {
    await adminAuth.revokeRefreshTokens(userId);
    console.info(`[sessionManagement] Revoked all refresh tokens for user ${userId}`);
  } catch (error: any) {
    console.error('[sessionManagement] revokeRefreshTokensByUid failed:', error.code, error.message);
    throw error;
  }
}