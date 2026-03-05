import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { apiRateLimiter, getClientIp } from '@/lib/rateLimiter';
import { z } from 'zod';

// ─── Validation schemas ──────────────────────────────────────────────────────

const companySchema = z.object({
  name:    z.string().min(1).max(100).trim(),
  email:   z.string().email().trim(),
  phone:   z.string().max(20).trim().optional(),
  address: z.string().max(200).trim().optional(),
});

const busSchema = z.object({
  licensePlate: z.string().min(1).max(20).trim(),
  busType:      z.string().min(1).max(50).trim(),
  capacity:     z.number().int().min(1).max(200),
});

const routeSchema = z.object({
  origin:      z.string().min(1).max(100).trim(),
  destination: z.string().min(1).max(100).trim(),
  price:       z.number().min(0),
});

const scheduleSchema = z.object({
  routeId:           z.string().min(1),
  busId:             z.string().min(1),
  departureDateTime: z.string().datetime(),
  arrivalDateTime:   z.string().datetime(),
  availableSeats:    z.number().int().min(0),
  price:             z.number().min(0),
});

const onboardingSchema = z.object({
  company:   companySchema,
  buses:     z.array(busSchema).min(1).max(50),
  routes:    z.array(routeSchema).min(1).max(100),
  schedules: z.array(scheduleSchema).min(1).max(500),
});

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {

  // ─── Rate limiting ──────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  // ✅ Fix 2: await the async rate limiter
  const rateLimitResult = await apiRateLimiter.limit(ip);

  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
    console.warn(`[RATE LIMIT] Too many onboarding requests from ${ip}`);
    return NextResponse.json(
      { error: 'Too many requests', message: `Please try again in ${retryAfter} seconds.` },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  // ─── Authorization ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  let decodedToken: any;
  try {
    // ✅ Fix 1: use adminAuth directly (Admin SDK only in API routes)
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (decodedToken.role !== 'company_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ─── Parse & validate body ──────────────────────────────────────────────────
  // ✅ Fix 3: try/catch around req.json() + Zod validation (Fix 4)
  let parsed: z.infer<typeof onboardingSchema>;
  try {
    const body = await req.json();
    parsed = onboardingSchema.parse(body);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', issues: error.issues.map(i => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Malformed request body' }, { status: 400 });
  }

  const { company, buses, routes, schedules } = parsed;

  // ─── Write to Firestore ─────────────────────────────────────────────────────
  // ✅ Fix 1: use adminDb (Admin SDK) instead of client-side db
  // ✅ Fix 5: add createdAt/updatedAt to all documents
  try {
    const batch = adminDb.batch();

    const companyRef = adminDb.collection('bus_companies').doc();

    batch.set(companyRef, {
      ...company,
      adminUserId: decodedToken.uid,
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    buses.forEach(bus => {
      const busRef = adminDb.collection('buses').doc();
      batch.set(busRef, {
        ...bus,
        companyId: companyRef.id,
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    routes.forEach(route => {
      const routeRef = adminDb.collection('routes').doc();
      batch.set(routeRef, {
        ...route,
        companyId: companyRef.id,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    schedules.forEach(schedule => {
      const scheduleRef = adminDb.collection('schedules').doc();
      batch.set(scheduleRef, {
        ...schedule,
        companyId: companyRef.id,
        bookedSeats: [],
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    return NextResponse.json({ companyId: companyRef.id }, { status: 201 });

  } catch (error: any) {
    // ✅ Fix 3: handle batch commit failures gracefully
    console.error('[ONBOARDING] Batch commit failed:', error);
    return NextResponse.json(
      { error: 'Failed to save onboarding data', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function PUT()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }