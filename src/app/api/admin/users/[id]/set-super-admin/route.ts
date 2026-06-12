import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { setUserSuperAdmin } from '@/lib/actions/user.actions';
import { checkAdminLimit } from '@/lib/rateLimit';
import prisma from '@/lib/prisma';

export async function POST(req: Request, context: any) {
  const paramsObj = context?.params && typeof context.params.then === 'function' ? await context.params : context?.params;
  const current = await getCurrentUser(req as any);
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await checkAdminLimit(current.id).catch(() => true);
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  let targetId = paramsObj?.id;
  // If no target specified or target is 'me', operate on the current user
  if (!targetId || targetId === 'me') {
    targetId = current.id;
  }
  // If targetId looks like an email (or client sent email in body), resolve to DB id
  try {
    const body = await req.json().catch(() => ({} as any));
    const emailFromBody = body?.email;
    if (emailFromBody && typeof emailFromBody === 'string') {
      const found = await prisma.user.findUnique({ where: { email: emailFromBody } });
      if (!found) return NextResponse.json({ error: 'User not found for provided email' }, { status: 404 });
      targetId = found.id;
    } else if (typeof targetId === 'string' && targetId.includes('@')) {
      // param contains an email
      const found = await prisma.user.findUnique({ where: { email: targetId } });
      if (!found) return NextResponse.json({ error: 'User not found for provided email' }, { status: 404 });
      targetId = found.id;
    }
    const res = await setUserSuperAdmin(targetId, { id: current.id, name: `${current.firstName || ''} ${current.lastName || ''}`.trim(), role: current.role, companyId: current.companyId ?? undefined });
    if (!res.success) return NextResponse.json({ error: res.error || 'Failed' }, { status: 500 });
    return NextResponse.json({ success: true, data: res.data });
  } catch (err) {
    console.error('Error in set-super-admin route:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
