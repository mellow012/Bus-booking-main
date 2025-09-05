import { Schedule, Bus, Route, Company } from './core';
import { SearchFilters } from './dashboard';

export interface CreateCompanyRequest {
  name: string;
  email: string;
  contact: string;
  status: 'active' | 'pending' | 'inactive';
  address?: string;
  description?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
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