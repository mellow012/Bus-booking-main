'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Company, Route, Bus } from '@/types';
import { Loader2, AlertCircle, Building, Map, Bus as BusIcon } from 'lucide-react';
import AlertMessage from './AlertMessage';

interface SearchResult {
  type: 'company' | 'route' | 'bus';
  data: Company | Route | Bus;
}

export default function GlobalSearchForm() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [entities, setEntities] = useState<{
    companies: Company[];
    routes: Route[];
    buses: Bus[];
  }>({ companies: [], routes: [], buses: [] });

  useEffect(() => {
    let isMounted = true;

    const fetchEntities = async () => {
      setLoading(true);
      setError('');
      try {
        const [companiesSnapshot, routesSnapshot, busesSnapshot] = await Promise.all([
          getDocs(collection(db, 'companies')),
          getDocs(collection(db, 'routes')),
          getDocs(collection(db, 'buses')),
        ]);

        if (!isMounted) return;

        const companies = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
        const routes = routesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route));
        const buses = busesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bus));

        setEntities({ companies, routes, buses });
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.code === 'unavailable' ? 'Network error. Please check your connection.' : 'Failed to load search data. Please try again.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchEntities();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setError('');
    const lowercaseQuery = query.trim().toLowerCase();
    const searchResults: SearchResult[] = [];

    entities.companies.forEach(company => {
      if (
        company.name.toLowerCase().includes(lowercaseQuery) ||
        company.description?.toLowerCase().includes(lowercaseQuery)
      ) {
        searchResults.push({ type: 'company', data: company });
      }
    });

    entities.routes.forEach(route => {
      if (
        route.origin.toLowerCase().includes(lowercaseQuery) ||
        route.destination.toLowerCase().includes(lowercaseQuery) ||
        route.stops.some(stop => stop.toLowerCase().includes(lowercaseQuery))
      ) {
        searchResults.push({ type: 'route', data: route });
      }
    });

    entities.buses.forEach(bus => {
      if (
        bus.busNumber.toLowerCase().includes(lowercaseQuery) ||
        bus.busType.toLowerCase().includes(lowercaseQuery) ||
        bus.amenities.some(amenity => amenity.toLowerCase().includes(lowercaseQuery))
      ) {
        searchResults.push({ type: 'bus', data: bus });
      }
    });

    setResults(searchResults);
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'company') {
      router.push(`/company/${result.data.id}`);
    } else if (result.type === 'route') {
      router.push(`/routes?origin=${encodeURIComponent(result.data.origin)}&destination=${encodeURIComponent(result.data.destination)}`);
    } else if (result.type === 'bus') {
      router.push(`/bus/${result.data.id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-6">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      {error && <AlertMessage type="error" message={error} onClose={() => setError('')} />}
      <form onSubmit={handleSearch} className="space-y-4" aria-label="Global Search Form">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies, routes, or buses..."
            className="w-full pl-10 pr-4 py-3 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200 font-medium"
            aria-label="Search companies, routes, or buses"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-md hover:shadow-lg"
          aria-label="Search platform"
        >
          <span className="flex items-center justify-center">
            {loading ? (
              <Loader2 className="animate-spin mr-3 h-5 w-5 text-white" />
            ) : (
              <svg className="mr-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            {loading ? 'Searching...' : 'Search'}
          </span>
        </button>
      </form>

      {results.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Search Results</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((result, index) => (
              <article
                key={index}
                className="group bg-white rounded-lg shadow-md p-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border border-gray-200 cursor-pointer"
                onClick={() => handleResultClick(result)}
              >
                <div className="flex items-center space-x-4">
                  {result.type === 'company' && (
                    <>
                      <Building className="w-6 h-6 text-blue-600" />
                      <div>
                        <h3 className="text-md font-semibold text-gray-800 group-hover:text-blue-800">
                          {result.data.name}
                        </h3>
                        <p className="text-sm text-gray-600">{result.data.description || 'Bus Company'}</p>
                      </div>
                    </>
                  )}
                  {result.type === 'route' && (
                    <>
                      <Map className="w-6 h-6 text-blue-600" />
                      <div>
                        <h3 className="text-md font-semibold text-gray-800 group-hover:text-blue-800">
                          {result.data.origin} → {result.data.destination}
                        </h3>
                        <p className="text-sm text-gray-600">Stops: {result.data.stops.join(', ') || 'None'}</p>
                      </div>
                    </>
                  )}
                  {result.type === 'bus' && (
                    <>
                      <BusIcon className="w-6 h-6 text-blue-600" />
                      <div>
                        <h3 className="text-md font-semibold text-gray-800 group-hover:text-blue-800">
                          {result.data.busType} ({result.data.busNumber})
                        </h3>
                        <p className="text-sm text-gray-600">Amenities: {result.data.amenities.join(', ') || 'None'}</p>
                      </div>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {query && results.length === 0 && !loading && (
        <div className="text-center py-6">
          <BusIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">No results found for "{query}". Try a different search term.</p>
        </div>
      )}
    </div>
  );
}