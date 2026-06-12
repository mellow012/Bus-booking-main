import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { logAudit } from '@/utils/AuditLogs';
import { checkShareLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const allowed = await checkShareLimit(user.id).catch(() => true);
    if (!allowed) return NextResponse.json({ error: 'Too many shares. Try later.' }, { status: 429 });

    const { url } = await req.json();
    try {
      await logAudit({
        action: 'access_dashboard',
        userId: user.id,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        userRole: user.role || 'unknown',
        companyId: user.companyId || '',
        resourceType: 'dashboard_share',
        resourceId: url || '',
        resourceName: 'Shared dashboard link',
        description: 'Shared dashboard link',
        status: 'success',
        metadata: { url },
      });
    } catch (e) {
      console.error('Failed to write share audit', e);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('/api/admin/users/share error:', err);
    return NextResponse.json({ error: err.message || 'Failed to share' }, { status: 500 });
  }
}

export async function GET() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
