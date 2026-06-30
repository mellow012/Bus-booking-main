import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { logAudit, logFailedAction } from '@/utils/AuditLogs';
import { checkAdminLimit } from '@/lib/rateLimit';

export async function PATCH(req: NextRequest, context: any) {
  const paramsObj = context?.params && typeof context.params.then === 'function' ? await context.params : context?.params;
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const targetId = paramsObj?.id;
    if (!['superadmin', 'company_admin'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const newRole = body.role;
    if (!newRole) return NextResponse.json({ error: 'Missing role' }, { status: 400 });

    const target = await prisma.user.findFirst({
      where: {
        OR: [
          { id: targetId },
          { uid: targetId }
        ]
      }
    });
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Rate limit role-change actions
    const allowed = await checkAdminLimit(user.id).catch(() => true);
    if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    // company_admin can only change users within their company
    if (user.role === 'company_admin' && user.companyId && target.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update role and increment sessionVersion to invalidate cached sessions
    const updated = await prisma.user.update({
      where: { id: target.id },
      data: ( { role: newRole, sessionVersion: { increment: 1 }, updatedAt: new Date() } as any ),
      select: { id: true, email: true, firstName: true, lastName: true, role: true, companyId: true }
    });

    try {
      await logAudit({
        action: 'update_schedule', // reuse action type; consider adding 'update_user_role'
        userId: user.id,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        userRole: user.role || 'unknown',
        companyId: user.companyId || '',
        resourceType: 'user',
        resourceId: targetId,
        resourceName: `${updated.firstName || ''} ${updated.lastName || ''}`.trim(),
        description: `Changed role of ${targetId} to ${newRole}`,
        status: 'success',
        metadata: { before: target.role, after: newRole },
      });
    } catch (e) {
      console.error('Audit write failed for role change', e);
    }

    return NextResponse.json({ data: updated });
  } catch (err: any) {
    console.error('/api/admin/users/[id] PATCH error:', err);
    try {
      const user = await getCurrentUser(req);
      if (user) {
        await logFailedAction(user.id, `${user.firstName || ''} ${user.lastName || ''}`.trim(), user.role || '', user.companyId || '', 'update_schedule', 'user', paramsObj?.id, err.message || 'error');
      }
    } catch {}
    return NextResponse.json({ error: err.message || 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: any) {
  const paramsObj = context?.params && typeof context.params.then === 'function' ? await context.params : context?.params;
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const targetId = paramsObj?.id;
    if (!['superadmin', 'company_admin'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const target = await prisma.user.findFirst({
      where: {
        OR: [
          { id: targetId },
          { uid: targetId }
        ]
      }
    });
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (user.role === 'company_admin' && user.companyId && target.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.operator.deleteMany({ where: { id: target.id } });
      await tx.user.delete({ where: { id: target.id } });
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('/api/admin/users/[id] DELETE error:', err);
    try {
      const user = await getCurrentUser(req);
      if (user) {
        await logFailedAction(user.id, `${user.firstName || ''} ${user.lastName || ''}`.trim(), user.role || '', user.companyId || '', 'delete_user', 'user', paramsObj?.id, err.message || 'error');
      }
    } catch {}
    return NextResponse.json({ error: err.message || 'Failed to delete user' }, { status: 500 });
  }
}

export async function GET() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
