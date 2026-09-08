import { NextRequest, NextResponse } from 'next/server';
import { logAudit, type AuditAction } from '@/utils/AuditLogs';
import { getCurrentUserFromServer } from '@/lib/auth-utils';

const AUDIT_ACTIONS: AuditAction[] = [
  'create_schedule',
  'update_schedule',
  'delete_schedule',
  'archive_schedule',
  'create_booking',
  'update_booking',
  'mark_boarded',
  'mark_no_show',
  'collect_payment',
  'generate_report',
  'update_payment_status',
  'login',
  'logout',
  'access_dashboard',
  'update_user_role',
  'delete_user',
  'export_data',
];

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromServer();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as Record<string, any>;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Invalid audit payload' }, { status: 400 });
    }

    const platformRoles = ['super_admin', 'superadmin', 'chief_of_growth', 'chief_of_operations'];
    const isPlatformUser = platformRoles.includes(user.role ?? '');
    const requestedCompanyId = typeof body.companyId === 'string' && body.companyId.trim()
      ? body.companyId.trim()
      : undefined;

    if (!isPlatformUser && !user.companyId) {
      return NextResponse.json({ success: false, error: 'Company scope is required' }, { status: 403 });
    }
    if (user.companyId && requestedCompanyId && user.companyId !== requestedCompanyId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const companyId = user.companyId ?? (isPlatformUser ? requestedCompanyId : undefined);
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Company scope is required' }, { status: 400 });
    }
    if (
      !AUDIT_ACTIONS.includes(body.action) ||
      typeof body.resourceType !== 'string' ||
      typeof body.resourceId !== 'string' ||
      typeof body.description !== 'string' ||
      !['success', 'failed'].includes(body.status)
    ) {
      return NextResponse.json({ success: false, error: 'Invalid audit fields' }, { status: 400 });
    }

    const {
      userId: _userId,
      userName: _userName,
      userRole: _userRole,
      companyId: _companyId,
      ipAddress: _ipAddress,
      userAgent: _userAgent,
      metadata,
      ...auditFields
    } = body;
    const safeMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? Object.fromEntries(
          Object.entries(metadata).filter(([key]) => ![
            'action',
            'userId',
            'userName',
            'userRole',
            'companyId',
            'resourceType',
            'resourceId',
            'resourceName',
            'ipAddress',
            'userAgent',
            'status',
            'errorMessage',
            'changes',
          ].includes(key))
        )
      : undefined;

    await logAudit({
      ...auditFields,
      action: body.action as AuditAction,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      description: body.description,
      status: body.status,
      userId: user.id,
      userName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.id,
      userRole: user.role || 'unknown',
      companyId,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
      metadata: safeMetadata,
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API /audit/log] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
