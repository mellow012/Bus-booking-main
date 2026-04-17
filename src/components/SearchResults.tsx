import React from 'react';
import { Clock, DollarSign, Users, BusIcon, MapPin, Map, Factory } from 'lucide-react';

// --- Local Data Types (Defined here to replace external imports) ---

interface Company {
  name: string;
}

interface Route {
  origin: string;
  destination: string;
  duration: number; // in minutes
}

interface Bus {
  licensePlate: string;
  busType: string;
  capacity: number;
  amenities: string[];
}

interface Schedule {
  id: string;
  // FIX: Assuming these are passed as standard JavaScript Date objects
  departureDateTime: Date; 
  arrivalDateTime: Date;
  price: number;
  availableSeats: number;
}

interface SearchResult {
  company: Company;
  route: Route;
  bus: Bus;
  schedule: Schedule;
}

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

// --- Utility Functions ---

/**
 * FIX: Updated to accept a Date object and format the time.
 * @param dateTime The Date object representing the schedule time.
 * @returns Formatted time string (e.g., "2:30 PM").
 */
const formatTime = (dateTime: Date): string => {
  // Ensure the input is a valid Date object before formatting
  if (!(dateTime instanceof Date) || isNaN(dateTime.getTime())) {
    return 'N/A';
  }
  return dateTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

// --- Main Component ---

// Exporting as App for single-file convention
export default function App({ results: initialResults, loading, searchCriteria }: SearchResultsProps) {
  // Mock results for demonstration in the single-file environment
  // In a real application, you would use `initialResults`.
  const mockResults: SearchResult[] = [
    {
      company: { name: "Transit Pro" },
      route: { origin: "New York", destination: "Boston", duration: 250 },
      bus: { licensePlate: "BUS-1A", busType: "Luxury Coach", capacity: 50, amenities: ["WiFi", "Power Outlets", "Restroom", "Snacks"] },
      schedule: {
        id: "sch-101",
        departureDateTime: new Date(new Date().setHours(8, 0, 0, 0)),
        arrivalDateTime: new Date(new Date().setHours(12, 10, 0, 0)),
        price: 49.99,
        availableSeats: 35
      }
    },
    {
      company: { name: "City Hopper" },
      route: { origin: "New York", destination: "Boston", duration: 270 },
      bus: { licensePlate: "CH-2B", busType: "Standard", capacity: 40, amenities: ["Restroom"] },
      schedule: {
        id: "sch-102",
        departureDateTime: new Date(new Date().setHours(15, 30, 0, 0)),
        arrivalDateTime: new Date(new Date().setHours(20, 0, 0, 0)),
        price: 35.50,
        availableSeats: 12
      }
    },
  ];

  // Use mock data if actual results are empty for demonstration purposes
  const results = initialResults.length > 0 ? initialResults : mockResults;

  // Simulate SearchCriteria if not provided (for standalone use)
  const criteria = searchCriteria || {
    from: "New York",
    to: "Boston",
    date: new Date().toLocaleDateString(),
    passengers: 1
  };
  
  // Custom Link behavior simulation
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    console.log(`Simulating navigation to booking page: ${href}`);
  };


  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-xl p-8 max-w-4xl mx-auto my-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
          <span className="ml-4 text-lg font-medium text-gray-700">Searching for available buses...</span>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-xl p-10 text-center max-w-4xl mx-auto my-8 border border-gray-100">
        <BusIcon className="w-16 h-16 text-gray-400 mx-auto mb-5" />
        <h3 className="text-2xl font-bold text-gray-900 mb-3">No Buses Found</h3>
        <p className="text-gray-600 mb-6">
          Unfortunately, no buses are available for your selected route and date.
        </p>
        <div className="inline-block p-4 bg-gray-50 rounded-lg text-sm text-left shadow-inner">
          <p className="font-semibold text-gray-700 mb-1">Current Search:</p>
          <p>Route: <span className="font-medium text-blue-600">{criteria.from}</span> → <span className="font-medium text-blue-600">{criteria.to}</span></p>
          <p>Date: {criteria.date} | Passengers: {criteria.passengers}</p>
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Search Results" className="max-w-4xl mx-auto my-8">
      <div className="bg-white rounded-xl shadow-xl p-5 mb-6 border border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 sm:mb-0">
            {results.length} Trips Available
          </h2>
          <div className="text-sm text-gray-600 font-medium bg-blue-50 py-1 px-3 rounded-full">
            <span className="font-semibold">{criteria.from} → {criteria.to}</span> on {criteria.date}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {results.map((result) => (
          <article 
            key={result.schedule.id} 
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border-l-4 border-blue-500 hover:border-blue-700"
          >
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Column 1: Company & Bus Info */}
              <div className="lg:col-span-1 border-b lg:border-b-0 lg:border-r border-gray-100 pr-4 pb-4 lg:pb-0">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                    <Factory className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{result.company.name}</h3>
                    <p className="text-sm text-gray-600 font-mono">
                      <span className="text-gray-400">ID:</span> {result.bus.licensePlate}
                    </p>
                  </div>
                </div>
                <div className="space-y-1 text-sm pl-1">
                  <div className="flex items-center space-x-2 text-gray-700">
                    <BusIcon className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">{result.bus.busType}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-700">
                    <Users className="w-4 h-4 text-green-500" />
                    <span>{result.bus.capacity} seats total</span>
                  </div>
                </div>
              </div>
              
              {/* Column 2/3: Route & Schedule */}
              <div className="lg:col-span-2 py-2">
                <div className="flex items-center justify-between mb-4">
                  {/* Departure */}
                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-blue-600">
                      {formatTime(result.schedule.departureDateTime)}
                    </div>
                    <div className="text-sm text-gray-700 font-medium mt-1 flex items-center justify-center">
                        <MapPin className="w-4 h-4 mr-1 text-blue-400" />
                        {result.route.origin}
                    </div>
                  </div>
                  
                  {/* Duration Line */}
                  <div className="flex-1 mx-4">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t-2 border-dashed border-gray-300"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="bg-white px-3 py-1 rounded-full border border-gray-200 text-gray-600 font-semibold shadow-sm flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDuration(result.route.duration)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Arrival */}
                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-gray-900">
                      {formatTime(result.schedule.arrivalDateTime)}
                    </div>
                    <div className="text-sm text-gray-700 font-medium mt-1 flex items-center justify-center">
                        <MapPin className="w-4 h-4 mr-1 text-blue-400" />
                        {result.route.destination}
                    </div>
                  </div>
                </div>

                {/* Amenities */}
                {result.bus.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                    {result.bus.amenities.slice(0, 4).map((amenity, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-green-50 text-green-800 text-xs rounded-full font-medium"
                      >
                        {amenity}
                      </span>
                    ))}
                    {result.bus.amenities.length > 4 && (
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
                        +{result.bus.amenities.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Column 4: Price & Booking */}
              <div className="lg:col-span-1 flex flex-col justify-center items-end border-t lg:border-t-0 border-gray-100 pt-4 lg:pt-0">
                <div className="text-right mb-4">
                  <div className="text-4xl font-extrabold text-blue-700 flex items-center justify-end">
                    <DollarSign className="w-6 h-6 mr-1" />
                    {result.schedule.price.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">per person</div>
                  <div className={`text-sm font-semibold mt-1 ${result.schedule.availableSeats < 10 ? 'text-red-500' : 'text-green-600'}`}>
                    {result.schedule.availableSeats} seats available
                  </div>
                </div>
                {/* Simulated Link component */}
                <a
                  href={`/book/${result.schedule.id}?passengers=${criteria.passengers}`}
                  onClick={(e) => handleLinkClick(e, `/book/${result.schedule.id}?passengers=${criteria.passengers}`)}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl text-center font-bold hover:bg-blue-700 transition-colors shadow-lg transform hover:scale-[1.02] active:scale-95 duration-200"
                  aria-label={`Book ${result.company.name} bus trip`}
                >
                  Select Seats
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
