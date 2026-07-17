"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import useFilterStore from '@/lib/stores/filterStore';

async function fetchEntity(path: string, id?: string | null) {
  if (!id) return null;
  const res = await fetch(`/api/admin/coo/${path}?id=${id}`, { credentials: 'same-origin' });
  if (!res.ok) return null;
  return res.json();
}

export default function Breadcrumbs() {
  const { regionId, routeId, scheduleId, bookingId } = useFilterStore();

  const { data: regionData } = useQuery({
    queryKey: ['cooRegion', regionId],
    queryFn: () => fetchEntity('regions', regionId),
    enabled: !!regionId,
  });
  const { data: routeData } = useQuery({
    queryKey: ['cooRoute', routeId],
    queryFn: () => fetchEntity('routes', routeId),
    enabled: !!routeId,
  });
  const { data: scheduleData } = useQuery({
    queryKey: ['cooSchedule', scheduleId],
    queryFn: () => fetchEntity('schedules', scheduleId),
    enabled: !!scheduleId,
  });
  const { data: bookingData } = useQuery({
    queryKey: ['cooBooking', bookingId],
    queryFn: () => fetchEntity('bookings', bookingId),
    enabled: !!bookingId,
  });

  const parts = [] as string[];
  if (regionData?.regions?.[0]?.name) parts.push(regionData.regions[0].name);
  if (routeData?.routes?.[0]) parts.push(routeData.routes[0].origin + ' → ' + routeData.routes[0].destination);
  if (scheduleData?.schedules?.[0]) parts.push('Schedule ' + scheduleData.schedules[0].id?.substring(0, 8));
  if (bookingData?.bookings?.[0]) parts.push('Booking ' + bookingData.bookings[0].bookingReference);

  if (parts.length === 0) return null;

  return (
    <div className="mb-4 text-sm text-gray-600">
      {parts.map((p, i) => (
        <span key={i} className="inline-block mr-2">{p}{i < parts.length - 1 && <span className="mx-2 text-gray-300">/</span>}</span>
      ))}
    </div>
  );
}
