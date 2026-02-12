'use client';

import React, { useMemo } from 'react';
import { SearchFilterss, SearchResult } from '@/types';

interface SearchFiltersProps {
  filters: SearchFilterss;
  onFiltersChange: (filters: SearchFilterss) => void;
  results: SearchResult[];
}

export default function SearchFilters({ filters, onFiltersChange, results }: SearchFiltersProps) {
  const busTypes = useMemo(() => Array.from(new Set(results.map(r => r.bus.busType))), [results]);
  const companies = useMemo(() => Array.from(new Set(results.map(r => r.company.name))), [results]);
  const amenities = useMemo(() => Array.from(new Set(results.flatMap(r => r.bus.amenities))), [results]);

  const handleFilterChange = (key: keyof SearchFilterss, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Filters</h2>
      <div className="space-y-6">
        {/* Bus Type Filter */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Bus Type</label>
          <select
            value={filters.busType || ''}
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

        {/* Company Filter */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Company</label>
          <select
            value={filters.company || ''}
            onChange={e => handleFilterChange('company', e.target.value || undefined)}
            className="w-full px-4 py-2 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200"
            aria-label="Filter by company"
          >
            <option value="">All Companies</option>
            {companies.map(company => (
              <option key={company} value={company}>{company}</option>
            ))}
          </select>
        </div>

        {/* Amenities Filter */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Amenities</label>
          {amenities.map(amenity => (
            <div key={amenity} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.amenities?.includes(amenity) || false}
                onChange={e => {
                  const newAmenities = e.target.checked
                    ? [...(filters.amenities || []), amenity]
                    : (filters.amenities || []).filter(a => a !== amenity);
                  handleFilterChange('amenities', newAmenities.length ? newAmenities : undefined);
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-200 rounded"
                aria-label={`Filter by ${amenity}`}
              />
              <span className="text-sm text-gray-600">{amenity}</span>
            </div>
          ))}
        </div>

        {/* Price Range Filter */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Price Range (MWK)</label>
          <input
            type="number"
            placeholder="Min"
            value={filters.priceRange?.min || ''}
            onChange={e => handleFilterChange('priceRange', { ...filters.priceRange, min: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-2 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200"
            aria-label="Minimum price"
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.priceRange?.max || ''}
            onChange={e => handleFilterChange('priceRange', { ...filters.priceRange, max: parseInt(e.target.value) || undefined })}
            className="w-full mt-2 px-4 py-2 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200"
            aria-label="Maximum price"
          />
        </div>

        {/* Departure Time Filter */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Departure Time</label>
          <select
            value={filters.departureTime?.start || ''}
            onChange={e => handleFilterChange('departureTime', { ...filters.departureTime, start: e.target.value })}
            className="w-full px-4 py-2 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200"
            aria-label="Filter by departure start time"
          >
            <option value="">Any</option>
            {['06:00', '09:00', '12:00', '15:00', '18:00'].map(time => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
          <select
            value={filters.departureTime?.end || ''}
            onChange={e => handleFilterChange('departureTime', { ...filters.departureTime, end: e.target.value })}
            className="w-full mt-2 px-4 py-2 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200"
            aria-label="Filter by departure end time"
          >
            <option value="">Any</option>
            {['09:00', '12:00', '15:00', '18:00', '23:59'].map(time => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}