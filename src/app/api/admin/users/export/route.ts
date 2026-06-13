import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { createAdminClient } from '@/utils/supabase/admin';
import { logAudit } from '@/utils/AuditLogs';
import { v4 as uuidv4 } from 'uuid';
import { checkExportLimit } from '@/lib/rateLimit';

const MAX_EXPORT_ROWS = 10000;
const EXPORT_BUCKET = 'exports';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['superadmin', 'company_admin', 'chief_of_growth'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const q = body.q || null;
    const role = body.role || null;
    const companyId = body.companyId || null;

    // Rate limit exports via Redis + fallback DB check
    const allowed = await checkExportLimit(user.id).catch(() => true);
    if (!allowed) return NextResponse.json({ error: 'Too many export requests. Try again later.' }, { status: 429 });

    // Simple DB throttling fallback: limit 1 export per 60s per user
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recent = await prisma.activityLog.count({ where: { userId: user.id, action: 'export_data', createdAt: { gte: oneMinuteAgo } } });
    if (recent > 0) return NextResponse.json({ error: 'Too many export requests. Try again later.' }, { status: 429 });

    // Build where clause (same scoping as getAdminUsers)
    const where: any = {};
    if (role) where.role = role;
    if (q) where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
    ];
    if (user.role === 'company_admin') where.companyId = user.companyId;
    else if (companyId) where.companyId = companyId;

    const count = await prisma.user.count({ where });
    if (count > MAX_EXPORT_ROWS) {
      return NextResponse.json({ error: `Too many rows to export (${count}). Please refine your filters.` }, { status: 400 });
    }

    const rows = await prisma.user.findMany({ where, select: { id: true, email: true, firstName: true, lastName: true, role: true, companyId: true, createdAt: true, updatedAt: true, setupCompleted: true }, orderBy: { updatedAt: 'desc' } });

    // Build CSV
    const headers = ['id','email','firstName','lastName','role','companyId','createdAt','updatedAt','setupCompleted'];
    const escape = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => escape((r as any)[h])).join(','))).join('\n');

    // Upload to Supabase storage (requires bucket 'exports')
    const admin = createAdminClient();
    const filePath = `admin-exports/${user.id}/${Date.now()}-${uuidv4()}.csv`;
    const uploadResult = await admin.storage.from(EXPORT_BUCKET).upload(filePath, Buffer.from(csv), { cacheControl: '3600', upsert: false });
    if (uploadResult.error) {
      console.error('Export upload error:', uploadResult.error);
      return NextResponse.json({ error: 'Failed to upload export' }, { status: 500 });
    }

    const signed = await admin.storage.from(EXPORT_BUCKET).createSignedUrl(filePath, 60 * 60);
    if (signed.error) {
      console.error('Create signed url failed:', signed.error);
      return NextResponse.json({ error: 'Failed to create signed url' }, { status: 500 });
    }

    // Audit
    try {
      await logAudit({
        action: 'export_data',
        userId: user.id,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        userRole: user.role || 'unknown',
        companyId: user.companyId || '',
        resourceType: 'users',
        resourceId: filePath,
        resourceName: 'Admin Users Export',
        description: `Exported ${rows.length} users`,
        status: 'success',
        metadata: { rows: rows.length },
      });
    } catch (e) {
      console.error('Audit write failed for export', e);
    }

    return NextResponse.json({ url: signed.data?.signedUrl });
  } catch (error: any) {
    console.error('/api/admin/users/export error:', error);
    return NextResponse.json({ error: error.message || 'Failed to export users' }, { status: 500 });
  }
}

export async function GET() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
