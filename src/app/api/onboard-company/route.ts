import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseConfig';
import { doc, setDoc, collection, serverTimestamp,writeBatch } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';
import {admin} from '@/lib/firebaseAdmin';
import { apiRateLimiter, getClientIp } from '@/lib/rateLimiter';

export async function POST(req: NextRequest) {
  // ─── Rate Limiting ──────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const rateLimitResult = apiRateLimiter.check(ip);

  if (!rateLimitResult.allowed) {
    console.warn(`[RATE LIMIT] Too many company onboarding requests from ${ip}`);
    return new NextResponse(
      JSON.stringify({
        error: 'Too many requests',
        message: `Please try again in ${rateLimitResult.retryAfter} seconds.`,
      }),
      {
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // ─── Authorization ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  let decodedToken;
  try {
    decodedToken = await getAuth(admin).verifyIdToken(token);
    if (decodedToken.role !== 'company_admin') {
      return new NextResponse('Forbidden', { status: 403 });
    }
  } catch (error) {
    return new NextResponse('Invalid token', { status: 401 });
  }

  const { company, buses, routes, schedules } = await req.json();

  // Validate input
  if (!company || !buses || !routes || !schedules) {
    return new NextResponse('Missing required fields', { status: 400 });
  }

  const batch = writeBatch(db);
  const companyRef = doc(collection(db, 'bus_companies'));
  batch.set(companyRef, {
    ...company,
    createdAt: serverTimestamp(),
    uid: decodedToken.uid,
  });

  buses.forEach((bus: any) => {
    const busRef = doc(collection(db, 'buses'));
    batch.set(busRef, { ...bus, companyId: companyRef.id });
  });

  routes.forEach((route: any) => {
    const routeRef = doc(collection(db, 'routes'));
    batch.set(routeRef, { ...route, companyId: companyRef.id });
  });

  schedules.forEach((schedule: any) => {
    const scheduleRef = doc(collection(db, 'schedules'));
    batch.set(scheduleRef, { ...schedule, companyId: companyRef.id });
  });

  await batch.commit();
  return new NextResponse(JSON.stringify({ companyId: companyRef.id }), { status: 201 });
}