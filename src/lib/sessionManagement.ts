/**
 * Session Management Utilities
 * Handles session timeouts, token refresh, and secure session handling
 */

import { adminAuth } from './firebaseAdmin';
import { logger } from './logger';

interface SessionConfig {
  idleTimeoutMinutes: number; // Logout after inactivity
  absoluteTimeoutMinutes: number; // Absolute session duration
  refreshThresholdMinutes: number; // Refresh token before expiry
}

const defaultConfig: SessionConfig = {
  idleTimeoutMinutes: 30, // 30 minutes
  absoluteTimeoutMinutes: 480, // 8 hours
  refreshThresholdMinutes: 5, // Refresh 5 min before expiry
};

/**
 * Session storage (in production, use database/Redis)
 */
interface SessionData {
  userId: string;
  email?: string;
  role?: string;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
}

const sessions = new Map<string, SessionData>();

/**
 * Create a new session
 */
export function createSession(
  sessionId: string,
  userId: string,
  email?: string,
  role?: string,
  config: SessionConfig = defaultConfig
): SessionData {
  const now = Date.now();
  const session: SessionData = {
    userId,
    email,
    role,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + config.absoluteTimeoutMinutes * 60 * 1000,
  };

  sessions.set(sessionId, session);
  return session;
}

/**
 * Get session data
 */
export function getSession(sessionId: string): SessionData | null {
  return sessions.get(sessionId) || null;
}

/**
 * Update last activity time
 */
export function updateSessionActivity(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  session.lastActivityAt = Date.now();
  sessions.set(sessionId, session);
  return true;
}

/**
 * Check if session is valid
 * Returns {valid: boolean, reason: string|null}
 */
export function validateSession(
  sessionId: string,
  config: SessionConfig = defaultConfig
): {
  valid: boolean;
  reason?: string;
  isExpiringSoon?: boolean;
} {
  const session = sessions.get(sessionId);
  if (!session) {
    return { valid: false, reason: 'Session not found' };
  }

  const now = Date.now();

  // Check absolute timeout
  if (now > session.expiresAt) {
    sessions.delete(sessionId);
    return { valid: false, reason: 'Session expired' };
  }

  // Check idle timeout
  const idleTimeMs = config.idleTimeoutMinutes * 60 * 1000;
  if (now - session.lastActivityAt > idleTimeMs) {
    sessions.delete(sessionId);
    return { valid: false, reason: 'Session idle timeout' };
  }

  // Check if expires soon (within refresh threshold)
  const refreshThresholdMs = config.refreshThresholdMinutes * 60 * 1000;
  const isExpiringSoon = session.expiresAt - now < refreshThresholdMs;

  return { valid: true, isExpiringSoon };
}

/**
 * End session (logout)
 */
export function endSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Extend session (refresh)
 */
export function refreshSession(
  sessionId: string,
  config: SessionConfig = defaultConfig
): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  session.expiresAt = Date.now() + config.absoluteTimeoutMinutes * 60 * 1000;
  session.lastActivityAt = Date.now();
  sessions.set(sessionId, session);
  return true;
}

/**
 * Get session expiry time in seconds from now
 */
export function getSessionExpiryIn(sessionId: string): number {
  const session = sessions.get(sessionId);
  if (!session) return 0;

  const secondsRemaining = Math.floor((session.expiresAt - Date.now()) / 1000);
  return Math.max(0, secondsRemaining);
}

/**
 * Get all sessions for a user (for multi-device management)
 */
export function getUserSessions(userId: string): SessionData[] {
  const userSessions: SessionData[] = [];
  for (const session of sessions.values()) {
    if (session.userId === userId) {
      userSessions.push(session);
    }
  }
  return userSessions;
}

/**
 * Logout all sessions for a user (security: password change, admin action)
 */
export async function logoutUserAllSessions(userId: string): Promise<void> {
  const toDelete: string[] = [];

  for (const [sessionId, session] of sessions.entries()) {
    if (session.userId === userId) {
      toDelete.push(sessionId);
    }
  }

  for (const sessionId of toDelete) {
    sessions.delete(sessionId);
  }

  await logger.logSecurityEvent(
    'All sessions terminated for user',
    undefined,
    {
      userId,
      action: 'all_sessions_logout',
      metadata: { sessionCount: toDelete.length },
    }
  );
}

/**
 * Revoke Firebase refresh token (security measure)
 * Useful for logout, password change, security breach
 */
export async function revokeRefreshTokens(userId: string): Promise<void> {
  try {
    await adminAuth.revokeRefreshTokens(userId);
    
    await logger.logSecurityEvent(
      'Refresh tokens revoked for user',
      undefined,
      {
        userId,
        action: 'tokens_revoked',
      }
    );
  } catch (error: any) {
    await logger.logError('security', 'Failed to revoke tokens', error, {
      userId,
      action: 'token_revoke_error',
    });
  }
}

/**
 * Clean up expired sessions periodically
 * Call this once on app startup
 */
export function initSessionCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [sessionId, session] of sessions.entries()) {
      if (now > session.expiresAt) {
        toDelete.push(sessionId);
      }
    }

    for (const sessionId of toDelete) {
      sessions.delete(sessionId);
    }

    if (toDelete.length > 0) {
      console.log(`[Session] Cleaned up ${toDelete.length} expired sessions`);
    }
  }, 60 * 1000); // Clean every minute
}

/**
 * Get session statistics (for monitoring)
 */
export function getSessionStats(): {
  totalSessions: number;
  sessionsByUser: { userId: string; count: number }[];
  oldestSession: number | null;
  newestSession: number | null;
} {
  const userSessions = new Map<string, number>();
  let oldest: number | null = null;
  let newest: number | null = null;

  for (const session of sessions.values()) {
    userSessions.set(session.userId, (userSessions.get(session.userId) || 0) + 1);
    
    if (oldest === null || session.createdAt < oldest) oldest = session.createdAt;
    if (newest === null || session.createdAt > newest) newest = session.createdAt;
  }

  return {
    totalSessions: sessions.size,
    sessionsByUser: Array.from(userSessions.entries()).map(([userId, count]) => ({
      userId,
      count,
    })),
    oldestSession: oldest,
    newestSession: newest,
  };
}
