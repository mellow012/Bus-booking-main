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
  details?: Record<string, any>;
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
  schedule: Schedule;
  bus: Bus;
  route: Route;
  company: Company;
}