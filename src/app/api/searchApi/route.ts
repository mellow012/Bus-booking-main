import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { NextResponse } from 'next/server';
import { Schedule, Route, Bus, Company, SearchResult } from '@/types';

export async function POST(request: Request) {
  try {
    const { origin, destination, date, passengers } = await request.json();

    if (!origin || !destination) {
      return NextResponse.json({ error: 'Missing origin or destination' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const schedulesQuery = query(
      collection(db, 'schedules'),
      where('date', '>=', date || today),
      where('availableSeats', '>=', passengers || 1),
      orderBy('date'),
      orderBy('departureTime')
    );
    const schedulesSnapshot = await getDocs(schedulesQuery);
    const schedules = schedulesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Schedule[];

    console.log('Schedules found:', schedules.length, schedules);

    const results: SearchResult[] = [];
    for (const schedule of schedules) {
      const routeDoc = await getDoc(doc(db, 'routes', schedule.routeId));
      if (!routeDoc.exists()) {
        console.log(`Route not found for schedule ${schedule.id}`);
        continue;
      }
      const route = { id: routeDoc.id, ...routeDoc.data() } as Route;

      if (
        route.origin.toLowerCase().includes(origin.toLowerCase()) &&
        route.destination.toLowerCase().includes(destination.toLowerCase())
      ) {
        const busDoc = await getDoc(doc(db, 'buses', schedule.busId));
        const companyDoc = await getDoc(doc(db, 'companies', schedule.companyId));
        if (!busDoc.exists() || !companyDoc.exists()) {
          console.log(`Bus or company not found for schedule ${schedule.id}`);
          continue;
        }

        results.push({
          schedule,
          route,
          bus: { id: busDoc.id, ...busDoc.data() } as Bus,
          company: { id: companyDoc.id, ...companyDoc.data() } as Company,
        });
      }
    }

    console.log('Filtered results:', results.length, results);
    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Failed to search buses' }, { status: 500 });
  }
}