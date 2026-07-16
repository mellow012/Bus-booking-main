import { normalizeRole } from '@/lib/roles';
import type { UserRole } from '@/types/core';

export function resolveEffectiveProfileRole(
  profileRole?: string | null,
  authRole?: string | null,
): UserRole | null {
  const normalizedAuthRole = normalizeRole(authRole);
  if (normalizedAuthRole) {
    return normalizedAuthRole as UserRole;
  }

  const normalizedProfileRole = normalizeRole(profileRole);
  return (normalizedProfileRole as UserRole | null) ?? null;
}
