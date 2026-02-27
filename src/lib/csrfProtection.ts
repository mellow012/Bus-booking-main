/**
 * CSRF Protection Utility
 * Generates and validates CSRF tokens for API requests
 */

import { randomBytes } from 'crypto';

interface CSRFTokenPayload {
  token: string;
  timestamp: number;
  maxAge: number; // in seconds
}

/**
 * Generate a secure CSRF token
 * Token format: random_bytes + timestamp
 */
export function generateCSRFToken(): string {
  const randomPart = randomBytes(32).toString('hex');
  const timestamp = Date.now().toString(36);
  return `${randomPart}.${timestamp}`;
}

/**
 * Validate CSRF token
 * Ensures token hasn't expired (max 24 hours)
 */
export function validateCSRFToken(token: string, maxAgeSeconds: number = 86400): boolean {
  try {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return false;
    }

    const randomPart = parts[0];
    const timestampPart = parts[1];

    // Validate random part (should be hex string, 64 chars)
    if (!/^[a-f0-9]{64}$/.test(randomPart)) {
      return false;
    }

    // Validate timestamp part and check expiration
    const timestamp = parseInt(timestampPart, 36);
    if (isNaN(timestamp)) {
      return false;
    }

    const now = Date.now();
    const age = (now - timestamp) / 1000; // in seconds

    if (age < 0 || age > maxAgeSeconds) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('[CSRF] Token validation error:', error);
    return false;
  }
}

/**
 * Extract CSRF token from request
 * Checks headers first, then body
 */
export function extractCSRFToken(
  headers: Record<string, string | string[] | undefined>,
  body?: Record<string, any>
): string | null {
  // Check X-CSRF-Token header (recommended)
  const headerToken = headers['x-csrf-token'];
  if (headerToken && typeof headerToken === 'string') {
    return headerToken;
  }

  // Check X-CSRF-Token in array form (alternate)
  const headerTokenArray = headers['x-csrf-token'];
  if (Array.isArray(headerTokenArray) && headerTokenArray.length > 0) {
    return headerTokenArray[0];
  }

  // Fallback: check body (for form submissions)
  if (body && body._csrf) {
    return body._csrf;
  }

  return null;
}

/**
 * Check if request method requires CSRF protection
 */
export function requiresCSRFProtection(method?: string): boolean {
  const methodsRequiringCSRF = ['POST', 'PUT', 'PATCH', 'DELETE'];
  return methodsRequiringCSRF.includes(method?.toUpperCase() || '');
}
