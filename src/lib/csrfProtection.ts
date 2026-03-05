/**
 * CSRF Protection Utility
 *
 * FIX F-05: The previous implementation validated only the token's format and
 * timestamp. Any attacker who could observe or construct a validly-formatted
 * token string could bypass CSRF protection on all state-mutating endpoints.
 *
 * This implementation:
 *   1. Generates a cryptographically random per-session token.
 *   2. Stores the canonical token in an HttpOnly, SameSite=Strict cookie so
 *      client-side JavaScript cannot read or tamper with it.
 *   3. Sends the same token to the client in a separate readable cookie /
 *      response header so it can be attached to API request headers.
 *   4. On each state-mutating request, compares the submitted header token
 *      against the HttpOnly cookie value using crypto.timingSafeEqual() to
 *      prevent timing-based side-channel attacks.
 *
 * Usage in an API route (App Router):
 *
 *   // Generate and set cookie (call from a GET /api/csrf-token endpoint or
 *   // from your session-creation route):
 *   import { setCSRFCookies } from '@/lib/csrfProtection';
 *   const token = setCSRFCookies();          // sets both cookies, returns the token
 *
 *   // Validate on POST / PUT / PATCH / DELETE:
 *   import { validateCSRFRequest } from '@/lib/csrfProtection';
 *   const { valid, error } = validateCSRFRequest(request);
 *   if (!valid) return NextResponse.json({ error }, { status: 403 });
 */

import { randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

// ─── Constants ────────────────────────────────────────────────────────────────

/** HttpOnly cookie — stores the canonical server-side token. Never readable by JS. */
const CSRF_SECRET_COOKIE = '__csrf_secret';

/** Readable cookie — client reads this value and attaches it to X-CSRF-Token header. */
const CSRF_TOKEN_COOKIE = '__csrf_token';

/** Expected request header name. */
const CSRF_HEADER = 'x-csrf-token';

/** Token lifetime: 24 hours in seconds. */
const CSRF_MAX_AGE_SECONDS = 86_400;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ─── Token generation ─────────────────────────────────────────────────────────

/** Generate a cryptographically secure random CSRF token. */
export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex'); // 256-bit token
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

/**
 * Set both CSRF cookies on the current response.
 * Call this when creating a new session (e.g. after successful login).
 *
 * Returns the token so you can embed it in the HTML/JSON response if needed,
 * but clients should prefer reading it from the __csrf_token cookie.
 */
export async function setCSRFCookies(): Promise<string> {
  const token = generateCSRFToken();
  const cookieStore = await cookies();

  // Canonical secret — HttpOnly so JS cannot read it
  cookieStore.set(CSRF_SECRET_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PRODUCTION,
    path: '/',
    maxAge: CSRF_MAX_AGE_SECONDS,
  });

  // Readable token — same value, readable by JS so it can be put in the header
  cookieStore.set(CSRF_TOKEN_COOKIE, token, {
    httpOnly: false,
    sameSite: 'strict',
    secure: IS_PRODUCTION,
    path: '/',
    maxAge: CSRF_MAX_AGE_SECONDS,
  });

  return token;
}

/** Clear both CSRF cookies (call on logout). */
export async function clearCSRFCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CSRF_SECRET_COOKIE);
  cookieStore.delete(CSRF_TOKEN_COOKIE);
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Compare two CSRF token strings in constant time.
 * Returns false if tokens differ in length or content.
 */
export function compareTokens(submitted: string, stored: string): boolean {
  if (!submitted || !stored) return false;
  try {
    const a = Buffer.from(submitted, 'utf8');
    const b = Buffer.from(stored, 'utf8');
    // timingSafeEqual requires equal-length buffers
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Validate a CSRF token on an incoming Next.js API request.
 *
 * Reads the canonical token from the HttpOnly cookie and compares it against
 * the value submitted in the X-CSRF-Token request header using timingSafeEqual.
 *
 * Returns { valid: true } or { valid: false, error: string }.
 */
export function validateCSRFRequest(request: NextRequest): {
  valid: boolean;
  error?: string;
} {
  // Only state-mutating methods require CSRF protection
  const method = request.method?.toUpperCase() ?? '';
  if (!requiresCSRFProtection(method)) {
    return { valid: true };
  }

  // Read the canonical server-side secret from the HttpOnly cookie
  const storedToken = request.cookies.get(CSRF_SECRET_COOKIE)?.value;
  if (!storedToken) {
    return { valid: false, error: 'CSRF cookie missing or expired. Please refresh and try again.' };
  }

  // Read the submitted token from the request header
  const submittedToken = request.headers.get(CSRF_HEADER);
  if (!submittedToken) {
    return { valid: false, error: `Missing ${CSRF_HEADER} request header.` };
  }

  if (!compareTokens(submittedToken, storedToken)) {
    return { valid: false, error: 'CSRF token mismatch. Request rejected.' };
  }

  return { valid: true };
}

/**
 * Check if a request method requires CSRF protection.
 * GET, HEAD, and OPTIONS are safe methods per RFC 7231.
 */
export function requiresCSRFProtection(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

/**
 * Extract a CSRF token from request headers or body.
 * Prefer validateCSRFRequest() for full validation with cookie comparison.
 */
export function extractCSRFToken(
  headers: Record<string, string | string[] | undefined>,
  body?: Record<string, any>
): string | null {
  const headerToken = headers[CSRF_HEADER];
  if (typeof headerToken === 'string') return headerToken;
  if (Array.isArray(headerToken) && headerToken.length > 0) return headerToken[0];
  if (body?._csrf) return body._csrf;
  return null;
}