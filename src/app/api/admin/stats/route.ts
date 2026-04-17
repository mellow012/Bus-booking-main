import { NextRequest, NextResponse } from 'next/server';
import { getAdminDashboardStats } from '@/lib/actions/db.actions';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const result = await getAdminDashboardStats();
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json(result.data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
