import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { getAdminUsers } from '@/lib/admin/users';
import { logAudit } from '@/utils/AuditLogs';
import { checkAdminLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only privileged roles can access this endpoint
    if (!['superadmin', 'company_admin'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const url = req.nextUrl;
    const cursor = url.searchParams.get('cursor') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '25', 10) || 25;
    const q = url.searchParams.get('q') || undefined;
    const role = url.searchParams.get('role') || undefined;
    const companyId = url.searchParams.get('companyId') || undefined;

    // Rate limit admin listing per admin user
    const allowed = await checkAdminLimit(user.id).catch(() => true);
    if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const result = await getAdminUsers({ currentUser: user as any, cursor, limit, q, role, companyId });

    // Audit the admin list access
    try {
      await logAudit({
        action: 'access_dashboard',
        userId: user.id,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        userRole: user.role || 'unknown',
        companyId: user.companyId || '',
        resourceType: 'users',
        resourceId: `list_cursor_${cursor || 'start'}`,
        resourceName: 'Admin Users List',
        description: `Fetched admin users list (cursor ${cursor || 'start'})`,
        status: 'success',
        metadata: { query: q || null, limit },
      });
    } catch {
      /* swallow audit errors */
    }

    return NextResponse.json({ data: result.data, meta: result.meta });
  } catch (error: any) {
    console.error('/api/admin/users error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
