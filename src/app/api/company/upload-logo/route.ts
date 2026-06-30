import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'superadmin' && user.role !== 'company_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const formData = await req.formData();
    const companyId = String(formData.get('companyId') || '').trim();
    const logoFile = formData.get('logo') as File | null;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    if (!logoFile || typeof logoFile.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Logo file is required' }, { status: 400 });
    }

    if (user.role === 'company_admin' && user.companyId !== companyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const admin = createAdminClient();
    const fileExt = logoFile.name.split('.').pop() || 'jpg';
    const filePath = `${companyId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await admin.storage
      .from('logos')
      .upload(filePath, logoFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: logoFile.type || undefined,
      });

    if (uploadError) {
      console.error('[api/company/upload-logo] Supabase upload error:', uploadError, { filePath, companyId });
      return NextResponse.json({ error: uploadError.message || 'Logo upload failed' }, { status: 500 });
    }

    const { data: publicData, error: publicError } = await admin.storage
      .from('logos')
      .getPublicUrl(filePath);

    if (publicError || !publicData?.publicUrl) {
      console.error('[api/company/upload-logo] Failed to build public URL', publicError, { filePath, companyId });
      return NextResponse.json({ error: 'Failed to retrieve logo URL' }, { status: 500 });
    }

    return NextResponse.json({ publicUrl: publicData.publicUrl });
  } catch (error: any) {
    console.error('[api/company/upload-logo] Unexpected error:', error);
    return NextResponse.json({ error: error?.message || 'Unexpected upload error' }, { status: 500 });
  }
}
