// app/api/health/route.ts
//
// FIX F-17 + F-28:
//   - SMTP transporter verification moved here from email-service.ts module scope.
//   - Provides the /api/health endpoint required by load balancers, Cloud Run,
//     and container orchestration platforms to determine pod readiness.
//
// Load balancers should be configured to probe GET /api/health.
// Returns 200 when healthy, 503 when a critical dependency is degraded.

import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailTransporter } from '@/lib/email-service';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!['superadmin', 'super_admin'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const checks: Record<string, 'ok' | 'degraded' | 'error'> = {};

  // ── PostgreSQL/Prisma connectivity ────────────────────────────────────────
  try {
    // Lightweight query to confirm database connection
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (err: any) {
    console.error('[health] Database check failed:', err.message);
    checks.database = 'error';
  }

  // ── Email delivery check ──────────────────────────────────────────────────
  // verifyEmailTransporter() is now only called here, not at module load time.
  try {
    const emailOk = await verifyEmailTransporter();
    checks.email = emailOk ? 'ok' : 'degraded';
  } catch (err: any) {
    console.error('[health] Email check failed:', err.message);
    checks.email = 'degraded'; // degraded, not error — app can run without email
  }

  // ── Overall status ─────────────────────────────────────────────────────────
  const hasError    = Object.values(checks).includes('error');
  const hasDegraded = Object.values(checks).includes('degraded');

  const status = hasError ? 503 : 200;
  const overall = hasError ? 'unhealthy' : hasDegraded ? 'degraded' : 'ok';

  return NextResponse.json(
    {
      status: overall,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}
