/**
 * Password Security Utilities
 *
 * NOTE: Failed login attempt tracking (lockout) is now handled automatically
 * by Supabase Auth (Brute force protection).
 */

import { createAdminClient } from '@/utils/supabase/admin';
import { logger } from './logger';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// ─── Password strength validation (No state) ──────────────────────────────────

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

// ─── Failed login attempt tracking (Placeholder for Supabase) ───────────────

/**
 * Record a failed login attempt for a user.
 * Supabase handles this automatically, but we keep the stub for compatibility.
 */
export async function recordFailedLoginAttempt(userId: string): Promise<boolean> {
  // Supabase Auth has built-in brute force protection.
  return false;
}

/**
 * Clear failed login attempts for a user.
 */
export async function clearFailedLoginAttempts(userId: string): Promise<void> {
  // Handled by Supabase.
}

/**
 * Check if an account is currently locked.
 */
export async function isAccountLocked(userId: string): Promise<boolean> {
  // Supabase manages this state.
  return false;
}

/**
 * Get the number of seconds remaining in the current lockout.
 */
export async function getLockoutTimeRemaining(userId: string): Promise<number> {
  return 0;
}

// ─── Password update via Supabase Admin ───────────────────────────────────────

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

    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) throw error;

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
    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      ban_duration: '876000h', // Effectively forever (100 years)
    });

    if (error) throw error;

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