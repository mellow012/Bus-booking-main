"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompanyAdminFilterStore } from '@/lib/stores/companyAdminFilterStore';
import { ChevronRight, Home } from 'lucide-react';

async function fetchEntity(path: string, id?: string | null) {
  if (!id) return null;
  const res = await fetch(`/api/admin/coo/${path}?id=${id}`, { credentials: 'same-origin' });
  if (!res.ok) return null;
  return res.json();
}

export default function CompanyAdminBreadcrumb() {
  const { regionId, routeId, scheduleId, bookingId, clearAll, clearFromRegion, clearFromRoute, clearFromSchedule } = useCompanyAdminFilterStore();

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

  const parts = [];

  // Home segment
  parts.push({
    label: 'All Operations',
    icon: <Home className="w-3.5 h-3.5" />,
    onClick: clearAll,
    active: !regionId
  });

  if (regionData?.regions?.[0]?.name) {
    parts.push({
      label: regionData.regions[0].name,
      onClick: clearFromRegion,
      active: !!regionId && !routeId
    });
  }

  if (routeData?.routes?.[0]) {
    parts.push({
      label: `${routeData.routes[0].origin} → ${routeData.routes[0].destination}`,
      onClick: clearFromRoute,
      active: !!routeId && !scheduleId
    });
  }

  if (scheduleData?.schedules?.[0]) {
    parts.push({
      label: `Schedule #${scheduleData.schedules[0].id?.substring(0, 8)}`,
      onClick: clearFromSchedule,
      active: !!scheduleId && !bookingId
    });
  }

  if (bookingData?.bookings?.[0]) {
    parts.push({
      label: `Booking ${bookingData.bookings[0].bookingReference}`,
      onClick: () => {}, // No downstream to clear yet
      active: !!bookingId
    });
  }

  // Hide if no specific filters are applied
  if (parts.length <= 1) return null;

  return (
    <div className="mb-6 flex items-center flex-wrap gap-2 text-sm bg-white p-3 px-4 rounded-xl border border-gray-100 shadow-sm w-fit">
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          <button
            onClick={p.onClick}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-colors ${
              p.active 
                ? 'bg-indigo-50 text-indigo-700' 
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {p.icon}
            {p.label}
          </button>
          {i < parts.length - 1 && (
            <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
