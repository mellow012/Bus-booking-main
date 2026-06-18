import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { setUserChiefOfGrowth } from '@/lib/actions/user.actions';
import { checkAdminLimit } from '@/lib/rateLimit';

export async function POST(req: Request, context: any) {
  const paramsObj = context?.params && typeof context.params.then === 'function' ? await context.params : context?.params;
  const current = await getCurrentUser(req as any);
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await checkAdminLimit(current.id).catch(() => true);
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const targetId = paramsObj?.id;
  try {
    const res = await setUserChiefOfGrowth(targetId, { id: current.id, name: `${current.firstName || ''} ${current.lastName || ''}`.trim(), role: current.role, companyId: current.companyId ?? undefined });
    if (!res.success) return NextResponse.json({ error: res.error || 'Failed' }, { status: 500 });
    const payload = { success: true, data: res.data, deprecated: true, alternative: 'PATCH /api/admin/users/:id' };
    return NextResponse.json(payload, { status: 200, headers: { Deprecation: 'true' } });
  } catch (err) {
    console.error('Error in set-chief-of-growth route:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
