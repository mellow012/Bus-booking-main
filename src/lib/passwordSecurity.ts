/**
 * Password Security Utilities
 *
 * FIX F-07: The previous implementation tracked failed login attempts in an
 * in-memory Map. This silently fails in production because:
 *   (a) All state wipes on every redeploy — lockouts reset.
 *   (b) Behind a load balancer, each pod has isolated state — lockouts
 *       are bypassed by hitting a different pod.
 *
 * Failed login attempts are now stored in a Firestore `loginAttempts`
 * collection with a TTL-based expiry. Firestore is used here (rather than
 * Redis) to avoid adding a new infrastructure dependency for this feature;
 * if Upstash Redis is already in use for the rate limiter, the Firestore
 * calls here can trivially be replaced with Redis SET/GET/DEL/EXPIRE calls.
 *
 * Collection structure: loginAttempts/{userId}
 *   { count: number, resetTime: number (ms epoch), lockedUntil?: number }
 */

import { adminDb } from './firebaseAdmin';
import { adminAuth } from './firebaseAdmin';
import { logger } from './logger';
import { FieldValue } from 'firebase-admin/firestore';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const COLLECTION = 'loginAttempts';

// ─── Password strength validation (unchanged — no in-memory state) ────────────

export function validatePasswordStrength(password: string): {
  isStrong: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  if (password.length < 8) {
    issues.push('Password must be at least 8 characters');
  } else {
    score++;
  }

  if (password.length >= 12) {
    score++;
  } else {
    suggestions.push('Use at least 12 characters for better security');
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_\-+=[\]{};:'",.<>?/\\|`~]/.test(password);

  if (!hasUppercase || !hasLowercase) {
    issues.push('Use both uppercase and lowercase letters');
  } else {
    score++;
  }

  if (!hasNumbers) {
    issues.push('Include at least one number');
  } else {
    score++;
  }

  if (!hasSpecial) {
    issues.push('Include at least one special character (!@#$%^&*)');
  } else {
    score++;
  }

  const commonPatterns = [/password/i, /123456/, /qwerty/i, /admin/i, /letmein/i, /welcome/i];
  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      issues.push('Password contains commonly used words or patterns');
      break;
    }
  }

  if (/(qwerty|asdfgh|zxcvbn|12345)/i.test(password)) {
    suggestions.push('Avoid keyboard patterns');
  }

  return {
    isStrong: issues.length === 0 && score >= 4,
    score: Math.min(score, 5),
    issues,
    suggestions,
  };
}

// ─── Failed login attempt tracking (Firestore-backed) ────────────────────────

/**
 * Record a failed login attempt for a user.
 * Returns true if the account should now be locked (>= MAX_ATTEMPTS).
 */
export async function recordFailedLoginAttempt(userId: string): Promise<boolean> {
  const ref = adminDb.collection(COLLECTION).doc(userId);
  const now = Date.now();

  const snap = await ref.get();
  const data = snap.data();

  // If no record or lockout window has passed, start a fresh counter
  if (!data || now - data.resetTime > LOCKOUT_DURATION_MS) {
    await ref.set({ count: 1, resetTime: now });
    return false;
  }

  const newCount = (data.count ?? 0) + 1;
  await ref.update({ count: newCount });
  return newCount >= MAX_ATTEMPTS;
}

/**
 * Clear failed login attempts for a user (call on successful login).
 */
export async function clearFailedLoginAttempts(userId: string): Promise<void> {
  await adminDb.collection(COLLECTION).doc(userId).delete();
}

/**
 * Check if an account is currently locked due to too many failed attempts.
 */
export async function isAccountLocked(userId: string): Promise<boolean> {
  const snap = await adminDb.collection(COLLECTION).doc(userId).get();
  if (!snap.exists) return false;

  const data = snap.data()!;
  const now = Date.now();

  if (data.count >= MAX_ATTEMPTS && now - data.resetTime < LOCKOUT_DURATION_MS) {
    return true;
  }

  // Auto-clean expired record
  if (now - data.resetTime >= LOCKOUT_DURATION_MS) {
    await snap.ref.delete();
  }

  return false;
}

/**
 * Get the number of seconds remaining in the current lockout.
 * Returns 0 if the account is not locked.
 */
export async function getLockoutTimeRemaining(userId: string): Promise<number> {
  const snap = await adminDb.collection(COLLECTION).doc(userId).get();
  if (!snap.exists) return 0;

  const data = snap.data()!;
  const now = Date.now();
  const elapsed = now - data.resetTime;

  if (elapsed >= LOCKOUT_DURATION_MS) {
    await snap.ref.delete();
    return 0;
  }

  return Math.ceil((LOCKOUT_DURATION_MS - elapsed) / 1000);
}

// ─── Password reset token validation ─────────────────────────────────────────

/**
 * Validate a Firebase oobCode reset token (basic sanity check).
 * Full validation is performed by Firebase on the server when the code is used.
 */
export function validateResetToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  if (token.length < 20) return false;
  return true;
}

// ─── Password update via Admin SDK ───────────────────────────────────────────

export async function updateUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const strength = validatePasswordStrength(newPassword);
    if (!strength.isStrong) {
      return {
        success: false,
        error: `Password not strong enough: ${strength.issues.join(', ')}`,
      };
    }

    await adminAuth.updateUser(userId, { password: newPassword });
    await clearFailedLoginAttempts(userId);

    await logger.logSuccess('auth', 'Password updated successfully', {
      userId,
      action: 'password_changed',
    });

    return { success: true };
  } catch (error: any) {
    await logger.logError('auth', 'Password update failed', error, {
      userId,
      action: 'password_update_error',
    });
    return {
      success: false,
      error: error.message || 'Failed to update password',
    };
  }
}

// ─── Account disable ─────────────────────────────────────────────────────────

export async function disableUserAccount(userId: string): Promise<void> {
  try {
    await adminAuth.updateUser(userId, { disabled: true });
    await logger.logSecurityEvent('User account disabled due to security policy', undefined, {
      userId,
      action: 'account_disabled',
    });
  } catch (error: any) {
    await logger.logError('security', 'Failed to disable account', error, {
      userId,
      action: 'account_disable_error',
    });
  }
}

// ─── Removed: initPasswordSecurityCleanup ────────────────────────────────────
// The old setInterval cleanup is no longer needed because Firestore documents
// are cleaned up lazily on read (isAccountLocked / getLockoutTimeRemaining).
// For a more thorough cleanup, set a Firestore TTL policy on the loginAttempts
// collection via the Firebase Console:
//   Collection: loginAttempts  |  TTL field: resetTime  |  Unit: milliseconds