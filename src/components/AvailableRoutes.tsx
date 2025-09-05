// AvailableRoutes.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Schedule, Route, Bus, Company } from '@/types';

interface OpenRoute {
  schedule: Schedule;
  route: Route;
  bus: Bus;
  company: Company;
}

interface AvailableRoutesProps {
  limit?: number;
}

export default function AvailableRoutes({ limit }: AvailableRoutesProps) {
  const router = useRouter();
  const [openRoutes, setOpenRoutes] = useState<OpenRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOpenRoutes = async () => {
      try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        const schedulesQuery = query(
          collection(db, 'schedules'),
          where('status', '==', 'active'), // Replaced 'isActive' with 'status' based on your data
          where('departureDateTime', '>=', today), // Use Timestamp comparison
          where('departureDateTime', '<=', nextWeek), // Use Timestamp comparison
          where('availableSeats', '>', 0),
          orderBy('departureDateTime'),
          limit(limit || 10) // Default limit if not provided
        );
        const schedulesSnapshot = await getDocs(schedulesQuery);
        let schedules = schedulesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Schedule[];

        console.log('AvailableRoutes schedules:', schedules.length, schedules);

        if (limit) {
          schedules = schedules.slice(0, limit);
        }

        const results: OpenRoute[] = [];
        for (const schedule of schedules) {
          const routeDoc = await getDoc(doc(db, 'routes', schedule.routeId));
          const busDoc = await getDoc(doc(db, 'buses', schedule.busId));
          const companyDoc = await getDoc(doc(db, 'companies', schedule.companyId));

          if (routeDoc.exists() && busDoc.exists() && companyDoc.exists()) {
            // Convert Timestamp to Date for processing
            const departureDateTime = schedule.departureDateTime.toDate();
            const arrivalDateTime = schedule.arrivalDateTime.toDate();
            const departureTime = departureDateTime.toTimeString().slice(0, 5); // HH:MM
            const arrivalTime = arrivalDateTime.toTimeString().slice(0, 5); // HH:MM

            results.push({
              schedule: {
                ...schedule,
                departureTime, // Add transformed time for rendering
                arrivalTime,  // Add transformed time for rendering
              },
              route: { id: routeDoc.id, ...routeDoc.data() } as Route,
              bus: { id: busDoc.id, ...busDoc.data() } as Bus,
              company: { id: companyDoc.id, ...companyDoc.data() } as Company,
            });
          } else {
            console.log(`Missing data for schedule ${schedule.id}`);
          }
        }

        console.log('AvailableRoutes results:', results.length, results);
        setOpenRoutes(results);
      } catch (err) {
        setError('Failed to load available routes');
        console.error('AvailableRoutes error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOpenRoutes();
  }, [limit]);

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <section aria-label="Available Bus Schedules">
      {error && <p className="text-red-500 mb-4 text-center" role="alert">{error}</p>}
      {openRoutes.length > 0 ? (
        <div className="space-y-4">
          {openRoutes.map((result) => (
            <article key={result.schedule.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-lg" aria-hidden="true">
                        {result.company.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{result.company.name}</h3>
                      <p className="text-sm text-gray-600">{result.bus.busNumber}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full" aria-hidden="true"></span>
                      <span className="text-gray-600">{result.bus.busType}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full" aria-hidden="true"></span>
                      <span className="text-gray-600">{result.bus.totalSeats} seats</span>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {formatTime(result.schedule.departureTime)}
                      </div>
                      <div className="text-sm text-gray-600">{result.route.origin}</div>
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="bg-white px-2 text-gray-500">
                            {formatDuration(result.route.duration)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {formatTime(result.schedule.arrivalTime)}
                      </div>
                      <div className="text-sm text-gray-600">{result.route.destination}</div>
                    </div>
                  </div>
                  {result.bus.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {result.bus.amenities.slice(0, 4).map((amenity, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                        >
                          {amenity}
                        </span>
                      ))}
                      {result.bus.amenities.length > 4 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                          +{result.bus.amenities.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="lg:col-span-1 flex flex-col justify-between">
                  <div className="text-right mb-4">
                    <div className="text-3xl font-bold text-blue-600">
                      ${result.schedule.price}
                    </div>
                    <div className="text-sm text-gray-600">per person</div>
                    <div className="text-sm text-green-600 font-medium">
                      {result.schedule.availableSeats} seats available
                    </div>
                  </div>
                  <button
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg text-center font-semibold hover:bg-blue-700 transition-colors"
                    onClick={() => router.push(`/book/${result.schedule.id}?passengers=1`)}
                    aria-label={`Book ${result.company.name} bus from ${result.route.origin} to ${result.route.destination}`}
                  >
                    Select Seats
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-6xl mb-4" aria-hidden="true">🚌</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No buses found</h3>
          <p className="text-gray-600">No available schedules found for this week.</p>
        </div>
      )}
    </section>
  );
}