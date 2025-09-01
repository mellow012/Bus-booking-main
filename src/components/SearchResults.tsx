'use client';

import React from 'react';
import Link from 'next/link';
import { SearchResult } from '@/types';

interface SearchResultsProps {
  results: SearchResult[];
  loading: boolean;
  searchCriteria: {
    from: string;
    to: string;
    date: string;
    passengers: number;
  };
}

export default function SearchResults({ results, loading, searchCriteria }: SearchResultsProps) {
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
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-4 text-lg text-gray-600">Searching for buses...</span>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="text-6xl mb-4" aria-hidden="true">🚌</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No buses found</h3>
        <p className="text-gray-600 mb-4">
          No buses available for your selected route and date. Try adjusting your search criteria.
        </p>
        <div className="text-sm text-gray-500">
          <p>Route: {searchCriteria.from} → {searchCriteria.to}</p>
          <p>Date: {searchCriteria.date}</p>
          <p>Passengers: {searchCriteria.passengers}</p>
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Search Results">
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {results.length} buses found
          </h2>
          <div className="text-sm text-gray-600">
            {searchCriteria.from} → {searchCriteria.to} • {searchCriteria.date}
          </div>
        </div>
      </div>
      <div className="space-y-4 mt-4">
        {results.map((result) => (
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
                    <p className="text-sm text-gray-600">{result.bus.licensePlate}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full" aria-hidden="true"></span>
                    <span className="text-gray-600">{result.bus.busType}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full" aria-hidden="true"></span>
                    <span className="text-gray-600">{result.bus.capacity} seats</span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {formatTime(result.schedule.departureDateTime)}
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
                      {formatTime(result.schedule.arrivalDateTime)}
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
                <Link
                  href={`/book/${result.schedule.id}?passengers=${searchCriteria.passengers}`}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg text-center font-semibold hover:bg-blue-700 transition-colors"
                  aria-label={`Book ${result.company.name} bus from ${result.route.origin} to ${result.route.destination}`}
                >
                  Select Seats
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}