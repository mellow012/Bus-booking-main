import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/utils/AuditLogs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await logAudit(body);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API /audit/log] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

