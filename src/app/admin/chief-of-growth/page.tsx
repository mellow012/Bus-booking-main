import React from 'react';
import { getCurrentUser } from '@/lib/auth-utils';
import { getAdminUsers } from '@/lib/admin/users';
import DashboardClient from './DashboardClient';
import { logAudit } from '@/utils/AuditLogs';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser({ cookies: undefined } as any);
  if (!user || !['superadmin', 'company_admin'].includes(user.role ?? '')) {
    return <div className="p-8">Access denied</div>;
  }

  // Server-side fetch first page (cursor-based)
  const result = await getAdminUsers({ currentUser: user as any, limit: 25 });

  // Log access to the dashboard for audit
  try {
    await logAudit({
      action: 'access_dashboard',
      userId: user.id,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      userRole: user.role || 'unknown',
      companyId: user.companyId || '',
      resourceType: 'dashboard',
      resourceId: 'chief_of_growth',
      resourceName: 'Chief of Growth Dashboard',
      description: 'Accessed Chief of Growth dashboard',
      status: 'success',
      metadata: {},
    });
  } catch {
    // swallow audit errors
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Chief of Growth Dashboard</h1>
      <DashboardClient initialData={result.data} initialMeta={result.meta} />
    </div>
  );
}
