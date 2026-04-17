'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import SearchForm from '@/components/SearchForm';
// ✅ Renamed component import to avoid clash with the `SearchFilters` type
import SearchFiltersComponent from '@/components/SearchFiltersComponent';
// ✅ `SearchFilters` is a type — must use `import type` when isolatedModules is enabled
import { Schedule, Company, Bus, Route } from '@/types';
import type { SearchFilters } from '@/types';
import { Bus as BusIcon, Map as MapIcon, Clock, DollarSign as Currency, Loader2, AlertCircle } from 'lucide-react';
import AlertMessage from '../../components/AlertMessage';
import { Button } from '@/components/ui/button';

// Interface for search criteria
interface SearchCriteria {
  from: string;
  to: string;
  date: string;
  passengers: number;
}

// Simplified search result (from API response)
interface SearchResult {
  id: string;
  companyId: string;
  busId: string;
  routeId: string;
  price: number;
  availableSeats: number;
  totalSeats: number;
  status: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  duration: number;
  distance: number;
  companyName: string;
  companyLogo?: string;
  origin: string;
  destination: string;
  busNumber: string;
  busType: string;
  amenities: string[];
}

// Interface for caching search results to reduce API reads
interface SearchCache {
  [key: string]: {
    results: SearchResult[];
    timestamp: number;
    page: number;
  };
}

export default function Search() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile } = useAuth();

  // Memoize initial search criteria from URL parameters
  const initialSearchCriteria = useMemo<SearchCriteria>(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      from: searchParams.get('from') ?? '',
      to: searchParams.get('to') ?? '',
      date: searchParams.get('date') ?? today,
      passengers: Math.max(1, parseInt(searchParams.get('passengers') ?? '1', 10)),
    };
  }, [searchParams]);

  // Centralized state for search results, loading, and pagination
  const [searchState, setSearchState] = useState<{
    results: SearchResult[];
    loading: boolean;
    error: string;
    page: number;
    hasMore: boolean;
    total: number;
  }>({
    results: [],
    loading: false,
    error: '',
    page: 1,
    hasMore: false,
    total: 0,
  });

  // State for user-selected filters
  const [filters, setFilters] = useState<SearchFilters>({
    busType: [],
    priceRange: { min: 0, max: 100000 },
    departureTime: { start: '00:00', end: '23:59' },
    amenities: [],
    companyId: '',
  });

  // State for caching search results to reduce API reads
  const [searchCache, setSearchCache] = useState<SearchCache>({});
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const RESULTS_PER_PAGE = 10;

  // Search handler - calls API endpoint
  const searchBuses = useCallback(async (loadMore = false) => {
    if (!initialSearchCriteria.from || !initialSearchCriteria.to || !initialSearchCriteria.date) {
      setSearchState(prev => ({
        ...prev,
        error: 'Please provide all search criteria.',
        loading: false,
      }));
      return;
    }

    const cacheKey = `${initialSearchCriteria.from}-${initialSearchCriteria.to}-${initialSearchCriteria.date}`;
    const cached = searchCache[cacheKey];
    const now = Date.now();

    // Return cached results if still valid
    if (!loadMore && cached && now - cached.timestamp < CACHE_DURATION) {
      setSearchState(prev => ({
        ...prev,
        results: cached.results,
        loading: false,
        error: '',
      }));
      return;
    }

    try {
      setSearchState(prev => ({
        ...prev,
        loading: true,
        error: '',
      }));

      const page = loadMore ? searchState.page + 1 : 1;
      const params = new URLSearchParams({
        origin: initialSearchCriteria.from,
        destination: initialSearchCriteria.to,
        date: initialSearchCriteria.date,
        passengers: initialSearchCriteria.passengers.toString(),
        page: page.toString(),
        limit: RESULTS_PER_PAGE.toString(),
      });

      const response = await fetch(`/api/search/schedules?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch search results');
      }

      const { data, total } = await response.json();

      if (data.length === 0 && !loadMore) {
        setSearchState(prev => ({
          ...prev,
          results: [],
          loading: false,
          error: 'No buses found for the selected criteria.',
          total: 0,
          hasMore: false,
        }));
        setSearchCache(prev => ({
          ...prev,
          [cacheKey]: { results: [], timestamp: now, page: 1 },
        }));
        return;
      }

      const combinedResults = loadMore ? [...searchState.results, ...data] : data;
      const hasMore = (page * RESULTS_PER_PAGE) < total;

      setSearchCache(prev => ({
        ...prev,
        [cacheKey]: { results: combinedResults, timestamp: now, page },
      }));

      setSearchState(prev => ({
        ...prev,
        results: combinedResults,
        loading: false,
        error: '',
        page,
        total,
        hasMore,
      }));

      console.log(`Search completed. Found ${data.length} results (Page ${page}/${Math.ceil(total / RESULTS_PER_PAGE)})`);

    } catch (err: any) {
      console.error('Search error:', err);
      const errorMessage = err.message || 'Failed to load search results. Please try again.';
      setSearchState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
    }
  }, [initialSearchCriteria, searchState.page, searchCache]);

  // Improved client-side filtering of results
  const filteredResults = useMemo(() => {
    let results = searchState.results;

    // busType is now string in the flat SearchResult
    if (filters.busType && filters.busType.length > 0) {
      results = results.filter(result =>
        filters.busType!.some(t => t.toLowerCase() === result.busType?.toLowerCase().trim())
      );
    }
    if (filters.companyId && filters.companyId.trim() !== '') {
      results = results.filter(result =>
        result.companyId === filters.companyId ||
        result.companyName?.toLowerCase().includes(filters.companyId!.toLowerCase())
      );
    }
    if (filters.amenities && filters.amenities.length > 0) {
      results = results.filter(result =>
        filters.amenities!.every((amenity: string) =>
          result.amenities?.some(busAmenity =>
            busAmenity.toLowerCase().includes(amenity.toLowerCase())
          ) || false
        )
      );
    }
    if (filters.priceRange) {
      const { min, max } = filters.priceRange;
      if (min > 0 || max < 100000) {
        results = results.filter(result => {
          return result.price >= min && result.price <= max;
        });
      }
    }
    if (filters.departureTime) {
      const { start, end } = filters.departureTime;
      if (start !== '00:00' || end !== '23:59') {
        results = results.filter(result => {
          return result.departureTime >= start && result.departureTime <= end;
        });
      }
    }

    return results;
  }, [searchState.results, filters]);

  // Memoized pagination for filtered results
  const paginatedResults = useMemo(() => {
    const start = (searchState.page - 1) * RESULTS_PER_PAGE;
    return filteredResults.slice(start, start + RESULTS_PER_PAGE);
  }, [filteredResults, searchState.page]);

  // Effect to trigger search when criteria or user profile changes
  useEffect(() => {
    if (initialSearchCriteria.date && userProfile) {
      searchBuses();
    }
  }, [searchBuses, userProfile, initialSearchCriteria.date]);

  // Handler for a new search
  const handleSearch = useCallback((newCriteria: SearchCriteria) => {
    setSearchState({ results: [], loading: false, error: '', page: 1, hasMore: false, total: 0 });
    setSearchCache({});
    const urlParams = new URLSearchParams(newCriteria as any);
    router.push(`/search?${urlParams.toString()}`, { scroll: false });
  }, [router]);

  // Handler for loading more results
  const handleLoadMore = useCallback(() => {
    if (searchState.hasMore && !searchState.loading) {
      searchBuses(true);
    }
  }, [searchBuses, searchState.hasMore, searchState.loading]);

  // Handler for filter changes
  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
    setSearchState(prev => ({ ...prev, page: 1 }));
  }, []);

  // Handler to clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      busType: [],
      priceRange: { min: 0, max: 100000 },
      departureTime: { start: '00:00', end: '23:59' },
      amenities: [],
      companyId: '',
    });
    setSearchState(prev => ({ ...prev, page: 1 }));
  }, []);

  const hasValidSearchCriteria = initialSearchCriteria.from && initialSearchCriteria.to && initialSearchCriteria.date;

  // Handler to navigate to the booking page
  const handleBook = (scheduleId: string, companyId: string, routeId: string) => {
    if (!userProfile) {
      router.push('/register');
      return;
    }
    router.push(`/book/${scheduleId}?companyId=${companyId}&routeId=${routeId}&passengers=${initialSearchCriteria.passengers}`);
  };

  // Utility to format time strings
  const formatTime = (time: string | any) => {
    if (typeof time === 'string') return time;
    // Fallback if it's a date or timestamp
    const date = time?.toDate ? time.toDate() : new Date(time);
    return date instanceof Date && !isNaN(date.getTime()) 
      ? date.toTimeString().slice(0, 5) 
      : '00:00';
  };

  // Utility to format price
  const formatPrice = (result: SearchResult) => {
    const price = result.price || 0;
    return price.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 font-outfit">Available Routes</h1>
          <p className="text-gray-600">
            {initialSearchCriteria.from || initialSearchCriteria.to 
              ? `Showing buses ${initialSearchCriteria.from ? `from ${initialSearchCriteria.from}` : ''} ${initialSearchCriteria.to ? `to ${initialSearchCriteria.to}` : ''}`
              : 'Showing all available bus routes for today'}
          </p>
        </header>

        <section aria-label="Bus Search Form" className="mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <SearchForm
              initialValues={initialSearchCriteria}
              onSearch={handleSearch}
              loading={searchState.loading}
            />
          </div>
        </section>

        {hasValidSearchCriteria && (
          <section aria-label="Search Results" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <aside className="lg:col-span-1" aria-label="Search Filters">
              <div className="sticky top-4">
                {/* ✅ Using renamed component import */}
                <SearchFiltersComponent
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                  results={searchState.results}
                />
                <Button
                  onClick={handleClearFilters}
                  className="mt-4 w-full bg-gray-500 text-white hover:bg-gray-600 px-4 py-2 rounded-lg transition"
                >
                  Clear Filters
                </Button>
              </div>
            </aside>

            <main className="lg:col-span-3" aria-live="polite" aria-label="Bus Search Results">
              {searchState.error && (
                <AlertMessage
                  type="error"
                  message={searchState.error}
                  onClose={() => setSearchState(prev => ({ ...prev, error: '' }))}
                />
              )}

              {!searchState.loading && !searchState.error && searchState.results.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Found <span className="font-semibold">{searchState.results.length}</span> buses
                    {filteredResults.length !== searchState.results.length && (
                      <span>, showing <span className="font-semibold">{filteredResults.length}</span> after filters</span>
                    )}
                    {searchState.hasMore && <span className="ml-2 text-blue-600">• Load more available</span>}
                  </p>
                </div>
              )}

              {searchState.loading && searchState.results.length === 0 ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <span className="ml-2 text-gray-600">Searching for buses...</span>
                </div>
              ) : paginatedResults.length === 0 && !searchState.error && searchState.results.length === 0 ? (
                <div className="text-center py-12">
                  <BusIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No buses found</h3>
                  <p className="text-sm text-gray-600 mb-4">No buses found for this route and date. Try:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Checking your departure and destination cities</li>
                    <li>• Selecting a different date</li>
                    <li>• Reducing the number of passengers</li>
                  </ul>
                </div>
              ) : paginatedResults.length === 0 && filteredResults.length === 0 && searchState.results.length > 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No results match your filters</h3>
                  <p className="text-sm text-gray-600 mb-4">Try adjusting or clearing your filters to see more options.</p>
                  <Button
                    onClick={handleClearFilters}
                    className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg"
                  >
                    Clear All Filters
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                    {paginatedResults.map(result => (
                      <article
                        key={result.id}
                        className="group bg-white rounded-lg shadow-md p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border border-gray-200"
                      >
                        <div className="flex items-center space-x-4 mb-4">
                          <img
                            src={result.companyLogo || `https://placehold.co/100x100/e2e8f0/64748b?text=${result.companyName?.charAt(0) || 'B'}`}
                            alt={`${result.companyName || 'Bus Company'} Logo`}
                            className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm"
                            onError={(e) => {
                              e.currentTarget.src = `https://placehold.co/100x100/e2e8f0/64748b?text=${result.companyName?.charAt(0) || 'B'}`;
                            }}
                          />
                          <div>
                            <h3 className="text-lg font-semibold text-gray-800 group-hover:text-blue-800">
                              {result.companyName || 'Bus Company'}
                            </h3>
                            <p className="text-sm text-gray-600">{result.busType} ({result.busNumber})</p>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <MapIcon className="w-5 h-5 text-blue-600" />
                            <p>{result.origin} to {result.destination}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="w-5 h-5 text-blue-600" />
                            <p>
                              Departs: {result.departureTime} | 
                              Arrives: {result.arrivalTime}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Currency className="w-5 h-5 text-blue-600" />
                            <p>Price: MWK {result.price.toLocaleString()} per seat</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <BusIcon className="w-5 h-5 text-blue-600" />
                            <p>Seats Available: {result.availableSeats}</p>
                          </div>
                          {result.amenities && result.amenities.length > 0 && (
                            <div className="flex items-start space-x-2">
                              <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <p className="flex-1">{result.amenities.slice(0, 3).join(', ')}</p>
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={() => handleBook(result.id, result.companyId, result.routeId)}
                          className="mt-4 w-full bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                        >
                          Book Now
                        </Button>
                      </article>
                    ))}
                  </div>

                  {/* Load More Button */}
                  {searchState.hasMore && (
                    <div className="flex justify-center mt-8">
                      <Button
                        onClick={handleLoadMore}
                        disabled={searchState.loading}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center"
                      >
                        {searchState.loading && searchState.results.length > 0 ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          'Load More'
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Pagination for filtered results */}
                  {filteredResults.length > RESULTS_PER_PAGE && (
                    <div className="mt-8 flex justify-between items-center">
                      <Button
                        onClick={() => setSearchState(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={searchState.page === 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600">
                        Page {searchState.page} of {Math.ceil(filteredResults.length / RESULTS_PER_PAGE)}
                      </span>
                      <Button
                        onClick={() => setSearchState(prev => ({ ...prev, page: prev.page + 1 }))}
                        disabled={searchState.page >= Math.ceil(filteredResults.length / RESULTS_PER_PAGE)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </main>
          </section>
        )}

        {!searchState.loading && !searchState.error && searchState.results.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
            <BusIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No buses available for this selection</h3>
            <p className="text-sm text-gray-600">Try selecting a different date or clearing your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
