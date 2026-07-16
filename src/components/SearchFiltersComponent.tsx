'use client';

import React, { useMemo } from 'react';
import { SearchResult } from '@/types';
import type { SearchFilters } from '@/types';

interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  results: SearchResult[];
}

export default function SearchFilters({ filters, onFiltersChange, results }: SearchFiltersProps) {
  const busTypes  = useMemo(() => Array.from(new Set(results.map(r => r.busType))), [results]);
  const companies = useMemo(() => Array.from(new Set(results.map(r => r.companyName))), [results]);
  const amenities = useMemo(() => Array.from(new Set(results.flatMap(r => r.amenities))), [results]);

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Coerce potentially non-scalar values to strings for <select> value props.
  // If the parent passes an array (e.g. busType: string[]) React warns:
  // "value prop supplied to <select> must be a scalar value if multiple is false"
  const busTypeValue  = Array.isArray(filters.busType)  ? (filters.busType[0]  ?? '') : (filters.busType  ?? '');
  const companyValue  = Array.isArray(filters.companyId) ? (filters.companyId[0] ?? '') : (filters.companyId ?? '');
  const deptStart     = filters.departureTime?.start ?? '';
  const deptEnd       = filters.departureTime?.end   ?? '';

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Filters</h2>
      <div className="space-y-6">

        {/* Bus Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Bus Type</label>
          <select
            value={busTypeValue}
            onChange={e => handleFilterChange('busType', e.target.value || undefined)}
            className="w-full px-4 py-2 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200"
            aria-label="Filter by bus type"
          >
            <option value="">All Types</option>
            {busTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Company */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Company</label>
          <select
            value={companyValue}
            onChange={e => handleFilterChange('companyId', e.target.value || undefined)}
            className="w-full px-4 py-2 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200"
            aria-label="Filter by company"
          >
            <option value="">All Companies</option>
            {companies.map(company => (
              <option key={company} value={company}>{company}</option>
            ))}
          </select>
        </div>

        {/* Amenities */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Amenities</label>
          {amenities.map(amenity => (
            <div key={amenity} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.amenities?.includes(amenity) ?? false}
                onChange={e => {
                  const current = filters.amenities ?? [];
                  const next = e.target.checked
                    ? [...current, amenity]
                    : current.filter(a => a !== amenity);
                  handleFilterChange('amenities', next.length ? next : undefined);
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-200 rounded"
                aria-label={`Filter by ${amenity}`}
              />
              <span className="text-sm text-gray-600">{amenity}</span>
            </div>
          ))}
        </div>

        {/* Price Range */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Price Range (MWK)</label>
          <input
            type="number"
            placeholder="Min"
            value={filters.priceRange?.min ?? ''}
            onChange={e => handleFilterChange('priceRange', {
              ...filters.priceRange,
              min: parseInt(e.target.value) || 0,
            })}
            className="w-full px-4 py-2 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200"
            aria-label="Minimum price"
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.priceRange?.max ?? ''}
            onChange={e => handleFilterChange('priceRange', {
              ...filters.priceRange,
              max: parseInt(e.target.value) || undefined,
            })}
            className="w-full mt-2 px-4 py-2 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200"
            aria-label="Maximum price"
          />
        </div>

        {/* Departure Time */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Departure Time</label>
          <select
            value={deptStart}
            onChange={e => handleFilterChange('departureTime', {
              ...filters.departureTime,
              start: e.target.value || undefined,
            })}
            className="w-full px-4 py-2 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200"
            aria-label="Filter by departure start time"
          >
            <option value="">Any time</option>
            {['06:00', '09:00', '12:00', '15:00', '18:00'].map(time => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
          <select
            value={deptEnd}
            onChange={e => handleFilterChange('departureTime', {
              ...filters.departureTime,
              end: e.target.value || undefined,
            })}
            className="w-full mt-2 px-4 py-2 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200"
            aria-label="Filter by departure end time"
          >
            <option value="">Any time</option>
            {['09:00', '12:00', '15:00', '18:00', '23:59'].map(time => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
        </div>

      </div>
    </div>
  );
}
