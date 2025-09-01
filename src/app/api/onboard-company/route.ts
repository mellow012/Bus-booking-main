import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseConfig';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';
import {admin} from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
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