/**
 * Password Security Utilities
 * Handles password validation, strength checking, and security policies
 */

import { adminAuth } from './firebaseAdmin';
import { logger } from './logger';

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isStrong: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Length requirements
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

  // Character variety
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

  // Check for common patterns to avoid
  const commonPatterns = [
    /password/i,
    /123456/,
    /qwerty/i,
    /admin/i,
    /letmein/i,
    /welcome/i,
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      issues.push('Password contains commonly used words or patterns');
      break;
    }
  }

  // Check for keyboard patterns (simple check)
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

/**
 * Track failed login attempts per user
 * Returns true if account should be locked
 */
const failedAttempts = new Map<string, { count: number; resetTime: number }>();

export function recordFailedLoginAttempt(userId: string): boolean {
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  const now = Date.now();
  const attempt = failedAttempts.get(userId) || { count: 0, resetTime: now };

  // Reset if lockout duration has passed
  if (now - attempt.resetTime > LOCKOUT_DURATION_MS) {
    failedAttempts.set(userId, { count: 1, resetTime: now });
    return false;
  }

  // Increment attempt counter
  attempt.count++;
  failedAttempts.set(userId, attempt);

  return attempt.count >= MAX_ATTEMPTS;
}

/**
 * Clear failed login attempts for user (successful login)
 */
export function clearFailedLoginAttempts(userId: string): void {
  failedAttempts.delete(userId);
}

/**
 * Check if account is locked due to failed attempts
 */
export function isAccountLocked(userId: string): boolean {
  const attempt = failedAttempts.get(userId);
  if (!attempt) return false;

  const now = Date.now();
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

  // Account is locked if attempts >= 5 and lockout time hasn't passed
  if (attempt.count >= 5 && now - attempt.resetTime < LOCKOUT_DURATION_MS) {
    return true;
  }

  return false;
}

/**
 * Get lockout time remaining in seconds
 */
export function getLockoutTimeRemaining(userId: string): number {
  const attempt = failedAttempts.get(userId);
  if (!attempt) return 0;

  const now = Date.now();
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
  const elapsed = now - attempt.resetTime;

  if (elapsed >= LOCKOUT_DURATION_MS) {
    failedAttempts.delete(userId);
    return 0;
  }

  return Math.ceil((LOCKOUT_DURATION_MS - elapsed) / 1000);
}

/**
 * Validate password reset token (basic check)
 * In production, use Firebase's built-in oobCode validation
 */
export function validateResetToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Firebase oobCode tokens are typically long strings
  if (token.length < 20) {
    return false;
  }

  return true;
}

/**
 * Update user password via Firebase Admin SDK
 */
export async function updateUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate password strength
    const strength = validatePasswordStrength(newPassword);
    if (!strength.isStrong) {
      return {
        success: false,
        error: `Password not strong enough: ${strength.issues.join(', ')}`,
      };
    }

    // Update password via Firebase Admin SDK
    await adminAuth.updateUser(userId, {
      password: newPassword,
    });

    // Clear failed attempts on successful password change
    clearFailedLoginAttempts(userId);

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

/**
 * Disable user account (for security)
 */
export async function disableUserAccount(userId: string): Promise<void> {
  try {
    await adminAuth.updateUser(userId, {
      disabled: true,
    });

    await logger.logSecurityEvent(
      'User account disabled due to security policy',
      undefined,
      {
        userId,
        action: 'account_disabled',
      }
    );
  } catch (error: any) {
    await logger.logError('security', 'Failed to disable account', error, {
      userId,
      action: 'account_disable_error',
    });
  }
}

/**
 * Clean up old failed attempt records periodically
 * Call this once on app startup
 */
export function initPasswordSecurityCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

    for (const [userId, attempt] of failedAttempts.entries()) {
      if (now - attempt.resetTime > LOCKOUT_DURATION_MS * 2) {
        failedAttempts.delete(userId);
      }
    }
  }, 60 * 1000); // Clean every minute
}
