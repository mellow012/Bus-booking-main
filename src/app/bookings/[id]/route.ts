import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// This route is intentionally lightweight: it traps accidental POSTs to
// `/bookings/:id` (missing the `/api` prefix) so we can log the request
// and return a helpful message. It should help diagnose clients that are
// posting to the wrong URL.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const bodyText = await req.text();
    const headers: Record<string,string> = {};
    req.headers.forEach((v,k) => { headers[k] = v; });

    // Control verbose logging: enabled in development or when DEBUG_TRAP=true
    const VERBOSE = process.env.DEBUG_TRAP === 'true' || process.env.NODE_ENV === 'development';
    if (VERBOSE) {
      try {
        const referer = req.headers.get('referer') || req.headers.get('referrer') || '';
        const cookie = req.headers.get('cookie') || '';
        console.warn('[ROUTING DEBUG] Unexpected POST to /bookings/%s', id);
        console.warn('[ROUTING DEBUG] headers:', headers);
        if (referer) console.warn('[ROUTING DEBUG] referer:', referer);
        if (cookie) console.warn('[ROUTING DEBUG] cookie:', cookie.slice(0, 200));
        console.warn('[ROUTING DEBUG] bodyPreview:', bodyText?.slice?.(0, 2000));
      } catch (e) {
        // swallow
      }
    }

    // Structured log (keeps size reasonable)
    await logger.logWarning('api', `Unexpected POST to /bookings/${id}`, { metadata: { id, bodyPreview: bodyText?.slice?.(0, 200) } });

    return NextResponse.json({
      error: 'Invalid endpoint',
      message: 'POST to /bookings/:id is not supported. Use /api/bookings/:id or /api/bookings/:id/cancel as appropriate.',
    }, { status: 405 });
  } catch (err: any) {
    try { await logger.logError('api', 'Error handling unexpected POST /bookings/:id', err); } catch {}
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
