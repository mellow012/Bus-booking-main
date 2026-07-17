import { Schedule, Bus, Route, Company } from './core';

export interface CreateCompanyRequest {
  name: string;
  email: string;
  contact: string;
  status: 'active' | 'pending' | 'inactive';
  address?: string;
  description?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SearchFilters {
  busType?: string[];
  priceRange?: { min: number; max: number };
  departureTime?: { start: string; end: string };
  amenities?: string[];
  companyId?: string;
}

export interface SearchQuery {
  origin: string;
  destination: string;
  date: string;
  passengers?: number;
  filters?: SearchFilters;
}

export interface SearchResult {
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
  // Optional legacy fields to avoid immediate breakage in some components
  schedule?: Schedule;
  bus?: Bus;
  route?: Route;
  company?: Company;
}