export function normalizeRole(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (s === 'super_admin' || s === 'superadmin' || s === 'super-admin') return 'superadmin';
  if (s === 'company_admin' || s === 'companyadmin' || s === 'company-admin' || s === 'admin') return 'company_admin';
  if (s === 'chief_of_growth' || s === 'chiefofgrowth' || s === 'chief-of-growth' || (s.includes('chief') && s.includes('growth'))) return 'chief_of_growth';
  if (s === 'chief_of_operations' || s === 'chiefofoperations' || s === 'chief-of-operations' || (s.includes('chief') && s.includes('operation'))) return 'chief_of_operations';
  if (s === 'finance' || s === 'financial' || s === 'chief_finance' || s === 'chief-of-finance') return 'finance';
  if (s === 'conductor' || s === 'driver' || s === 'bus driver' || s === 'bus conductor') return 'conductor';
  if (s === 'operator') return 'operator';
  if (s === 'customer' || s === 'user') return 'customer';
  return s;
}

export const CanonicalRoles = ['superadmin', 'company_admin', 'chief_of_growth', 'chief_of_operations', 'finance', 'operator', 'conductor', 'customer'] as const;
