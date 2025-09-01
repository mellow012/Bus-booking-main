'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, limit, orderBy, startAfter, QueryDocumentSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import SearchForm from '@/components/SearchForm';
import SearchFilters from '@/components/SearchFiltersComponent';
import { Schedule, Company, Bus, Route, SearchFilterss } from '@/types';
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

// Interface for a single search result item
interface SearchResult {
  schedule: Schedule;
  company: Company;
  bus: Bus;
  route: Route;
}

// Interface for the search cache
interface SearchCache {
  [key: string]: {
    results: SearchResult[];
    timestamp: number;
    lastDoc?: QueryDocumentSnapshot;
  };
}

export default function Search() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile } = useAuth();

  // Memoize initial search criteria from URL parameters
  const initialSearchCriteria = useMemo<SearchCriteria>(() => ({
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
    date: searchParams.get('date') ?? '',
    passengers: Math.max(1, parseInt(searchParams.get('passengers') ?? '1', 10)),
  }), [searchParams]);

  // Centralized state for search results, loading, and pagination
  const [searchState, setSearchState] = useState<{
    results: SearchResult[];
    loading: boolean;
    error: string;
    page: number;
    hasMore: boolean;
    lastDoc?: QueryDocumentSnapshot;
  }>({
    results: [],
    loading: false,
    error: '',
    page: 1,
    hasMore: false,
  });

  // State for user-selected filters with more reasonable defaults
  const [filters, setFilters] = useState<SearchFilterss>({
    busType: '',
    priceRange: { min: 0, max: 100000 },
    departureTime: { start: '00:00', end: '23:59' },
    amenities: [],
    company: '',
  });

  // State for caching search results to reduce Firestore reads
  const [searchCache, setSearchCache] = useState<SearchCache>({});
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const RESULTS_PER_PAGE = 10;

  // Utility function to create date range for timestamp queries
  const createDateRange = (dateString: string) => {
    const date = new Date(dateString);
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    return {
      start: Timestamp.fromDate(startOfDay),
      end: Timestamp.fromDate(endOfDay),
    };
  };

  // Utility function to extract time from timestamp
  const extractTimeFromTimestamp = (timestamp: any): string => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
      return date.toTimeString().slice(0, 5); // HH:MM format
    } catch (error) {
      console.error('Error extracting time from timestamp:', error);
      return '';
    }
  };

  // Main function to fetch bus schedules
  const searchBuses = useCallback(async (loadMore = false) => {
    if (!userProfile) {
      console.log('User profile not loaded yet, waiting...');
      return;
    }

    const { from, to, date, passengers } = initialSearchCriteria;
    if (!from || !to || !date || passengers < 1) {
      setSearchState(prev => ({ ...prev, error: 'Please provide valid search criteria.', loading: false }));
      return;
    }

    const cacheKey = `${from}-${to}-${date}-${passengers}`;
    const cached = searchCache[cacheKey];

    if (!loadMore && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setSearchState(prev => ({
        ...prev,
        results: cached.results,
        loading: false,
        hasMore: cached.results.length >= RESULTS_PER_PAGE,
        lastDoc: cached.lastDoc,
      }));
      return;
    }

    setSearchState(prev => ({ ...prev, loading: true, error: '' }));

    try {
      const dateRange = createDateRange(date);

      const routesQuery = query(
        collection(db, 'routes'),
        where('origin', '==', from),
        where('destination', '==', to),
        limit(50)
      );

      const routesSnapshot = await getDocs(routesQuery);
      console.log('Routes found:', routesSnapshot.docs.length);

      if (routesSnapshot.empty) {
        setSearchState(prev => ({
          ...prev,
          results: [],
          loading: false,
          hasMore: false,
          error: 'No routes found for this journey.',
        }));
        return;
      }

      const routeIds = routesSnapshot.docs.map(doc => doc.id);
      const routesMap = new Map(routesSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Route]));

      const batchSize = 10;
      const scheduleBatches: QueryDocumentSnapshot[][] = [];

      for (let i = 0; i < routeIds.length; i += batchSize) {
        const batchRouteIds = routeIds.slice(i, i + batchSize);

        let schedulesQuery = query(
          collection(db, 'schedules'),
          where('departureDateTime', '>=', dateRange.start),
          where('departureDateTime', '<=', dateRange.end),
          where('isActive', '==', true),
          where('availableSeats', '>=', passengers),
          where('routeId', 'in', batchRouteIds),
          orderBy('departureDateTime'),
          limit(RESULTS_PER_PAGE)
        );

        if (loadMore && searchState.lastDoc && i === 0) {
          schedulesQuery = query(schedulesQuery, startAfter(searchState.lastDoc));
        }

        const batchSnapshot = await getDocs(schedulesQuery);
        if (!batchSnapshot.empty) {
          scheduleBatches.push(batchSnapshot.docs);
        }
      }

      const allScheduleDocs = scheduleBatches.flat();
      console.log('Schedules found:', allScheduleDocs.length);

      if (allScheduleDocs.length === 0 && !loadMore) {
        setSearchState(prev => ({
          ...prev,
          results: [],
          loading: false,
          hasMore: false,
          error: 'No buses found for the selected criteria.',
        }));
        return;
      }

      const companyIds = new Set<string>();
      const busIds = new Set<string>();

      allScheduleDocs.forEach(doc => {
        const schedule = doc.data() as Schedule;
        if (schedule.companyId) companyIds.add(schedule.companyId);
        if (schedule.busId) busIds.add(schedule.busId);
      });

      const [companyDocs, busDocs] = await Promise.all([
        Array.from(companyIds).length > 0 ? fetchInBatches('companies', Array.from(companyIds)) : [],
        Array.from(busIds).length > 0 ? fetchInBatches('buses', Array.from(busIds)) : [],
      ]);

      const companiesMap = new Map(companyDocs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Company]));
      const busesMap = new Map(busDocs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Bus]));

      const newResults: SearchResult[] = [];
      allScheduleDocs.forEach(doc => {
        const scheduleData = doc.data();
        const schedule = {
          id: doc.id,
          ...scheduleData,
          date: scheduleData.departureDateTime?.toDate().toISOString().split('T')[0] || '',
          departureTime: extractTimeFromTimestamp(scheduleData.departureDateTime),
          arrivalTime: extractTimeFromTimestamp(scheduleData.arrivalDateTime),
        } as Schedule;

        const route = routesMap.get(schedule.routeId);
        const company = companiesMap.get(schedule.companyId);
        const bus = busesMap.get(schedule.busId);

        if (route && company && bus) {
          newResults.push({ schedule, company, bus, route });
        } else {
          console.warn('Missing data for schedule:', schedule.id, {
            hasRoute: !!route,
            hasCompany: !!company,
            hasBus: !!bus,
          });
        }
      });

      const lastVisibleDoc = allScheduleDocs[allScheduleDocs.length - 1];
      const hasMoreResults = allScheduleDocs.length === RESULTS_PER_PAGE;
      const combinedResults = loadMore ? [...searchState.results, ...newResults] : newResults;

      setSearchCache(prev => ({
        ...prev,
        [cacheKey]: { results: combinedResults, timestamp: Date.now(), lastDoc: lastVisibleDoc },
      }));

      setSearchState(prev => ({
        ...prev,
        results: combinedResults,
        loading: false,
        hasMore: hasMoreResults,
        lastDoc: lastVisibleDoc,
      }));

      console.log('Search completed successfully. Results:', combinedResults.length);

    } catch (err: any) {
      console.error('Search error:', err);
      let errorMessage = 'Failed to load search results. Please try again.';
      if (err.code === 'unavailable') errorMessage = 'Network error. Check your connection.';
      else if (err.code === 'permission-denied') errorMessage = 'Permission denied. Ensure you’re logged in.';
      else if (err.code === 'failed-precondition') errorMessage = 'Database index required. Contact support.';
      setSearchState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false,
        hasMore: false,
      }));
    }
  }, [initialSearchCriteria, userProfile, searchState.lastDoc, searchCache]);

  // Improved client-side filtering of results
  const filteredResults = useMemo(() => {
    let results = searchState.results;

    if (filters.busType && filters.busType.trim() !== '') {
      results = results.filter(result => result.bus?.busType?.toLowerCase().trim() === filters.busType.toLowerCase().trim());
    }
    if (filters.company && filters.company.trim() !== '') {
      results = results.filter(result => result.company?.name?.toLowerCase().trim()?.includes(filters.company.toLowerCase().trim()) || false);
    }
    if (filters.amenities && filters.amenities.length > 0) {
      results = results.filter(result => filters.amenities.every(amenity => result.bus?.amenities?.some(busAmenity => busAmenity.toLowerCase().includes(amenity.toLowerCase())) || false));
    }
    if (filters.priceRange) {
      const { min, max } = filters.priceRange;
      if (min > 0 || max < 100000) {
        results = results.filter(result => {
          const price = result.schedule?.price || 0;
          return price >= min && price <= max;
        });
      }
    }
    if (filters.departureTime) {
      const { start, end } = filters.departureTime;
      if (start !== '00:00' || end !== '23:59') {
        results = results.filter(result => {
          const depTime = extractTimeFromTimestamp(result.schedule.departureDateTime);
          return depTime >= start && depTime <= end;
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
    if (initialSearchCriteria.from && initialSearchCriteria.to && initialSearchCriteria.date && userProfile) {
      searchBuses();
    }
  }, [searchBuses, userProfile]);

  // Handler for a new search
  const handleSearch = useCallback((newCriteria: SearchCriteria) => {
    setSearchState({ results: [], loading: false, error: '', page: 1, hasMore: false });
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
  const handleFiltersChange = useCallback((newFilters: SearchFilterss) => {
    setFilters(newFilters);
    setSearchState(prev => ({ ...prev, page: 1 }));
  }, []);

  // Handler to clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      busType: '',
      priceRange: { min: 0, max: 100000 },
      departureTime: { start: '00:00', end: '23:59' },
      amenities: [],
      company: '',
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
  const formatTime = (timestamp: any, date?: string) => {
    return extractTimeFromTimestamp(timestamp);
  };

  // Utility to format price
  const formatPrice = (result: SearchResult) => {
    const price = result.schedule?.price || 0;
    return price.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Find Your Bus</h1>
          <p className="text-gray-600">Search and compare bus routes to find the best option for your journey</p>
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
                <SearchFilters
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
                        key={result.schedule.id}
                        className="group bg-white rounded-lg shadow-md p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border border-gray-200"
                      >
                        <div className="flex items-center space-x-4 mb-4">
                          <img
                            src={result.company.logoUrl || `https://placehold.co/100x100/e2e8f0/64748b?text=${result.company.name?.charAt(0) || 'B'}`}
                            alt={`${result.company.name || 'Bus Company'} Logo`}
                            className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm"
                            onError={(e) => {
                              e.currentTarget.src = `https://placehold.co/100x100/e2e8f0/64748b?text=${result.company.name?.charAt(0) || 'B'}`;
                            }}
                          />
                          <div>
                            <h3 className="text-lg font-semibold text-gray-800 group-hover:text-blue-800">
                              {result.company.name || 'Bus Company'}
                            </h3>
                            <p className="text-sm text-gray-600">{result.bus.busType} ({result.bus.licensePlate})</p>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <MapIcon className="w-5 h-5 text-blue-600" />
                            <p>{result.route.origin} to {result.route.destination}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="w-5 h-5 text-blue-600" />
                            <p>
                              Departs: {formatTime(result.schedule.departureDateTime)} | 
                              Arrives: {formatTime(result.schedule.arrivalDateTime)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Currency className="w-5 h-5 text-blue-600" />
                            <p>Price: MWK {formatPrice(result)} per seat</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <BusIcon className="w-5 h-5 text-blue-600" />
                            <p>Seats Available: {result.schedule.availableSeats}</p>
                          </div>
                          {result.bus.amenities && result.bus.amenities.length > 0 && (
                            <div className="flex items-start space-x-2">
                              <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <p className="flex-1">{result.bus.amenities.slice(0, 3).join(', ')}</p>
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={() => handleBook(result.schedule.id, result.company.id, result.route.id)}
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

        {!hasValidSearchCriteria && !searchState.loading && (
          <div className="text-center py-12">
            <BusIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to find your bus?</h3>
            <p className="text-sm text-gray-600">Enter your travel details above to start searching for available buses.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function for batching 'in' queries
async function fetchInBatches(collectionName: string, ids: string[]) {
  const batches = [];
  for (let i = 0; i < ids.length; i += 10) {
    const batchIds = ids.slice(i, i + 10);
    const batchQuery = query(collection(db, collectionName), where('__name__', 'in', batchIds));
    batches.push(getDocs(batchQuery));
  }
  const results = await Promise.all(batches);
  return results.flatMap(result => result.docs);
}