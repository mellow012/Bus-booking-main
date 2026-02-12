import { Schedule, Company, Route, Bus, Booking } from './core';

export type TabType =
  | 'overview'
  | 'schedules'
  | 'routes'
  | 'buses'
  | 'bookings'
  | 'operators'
  | 'profile'
  | 'settings'
  | 'payments';

export interface DashboardData {
  company: Company | null;
  schedules: Schedule[];
  routes: Route[];
  buses: Bus[];
  bookings: Booking[];
  totalCompanies: number;
  activeCompanies: number;
  pendingCompanies: number;
  totalBuses: number;
  totalRoutes: number;
  totalBookings: number;
  revenue: {
    total: number;
    monthly: number;
  };
  recentBookings: Booking[];
  topRoutes: { routeId: string; bookings: number }[];
  inactiveCompanies: number;
  monthlyRevenue: number;
}

export interface EnhancedSchedule extends Omit<Schedule, 'departureDateTime' | 'arrivalDateTime'> {
  date: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  companyName: string;
  origin: string;
  destination: string;
  lincesPlate: string;
  busType: string;
  companyId: string;
  busId: string;
  routeId: string;
  price: number;
  availableSeats: number;
  duration: number;
  /** Resolved conductor display name (optional, for admin views) */
  conductorName?: string;
}

export interface CompanyStats {
  totalBuses: number;
  totalRoutes: number;
  totalBookings: number;
  revenue: {
    total: number;
    monthly: number;
  };
}

export interface SearchFilters {
  busType?: string[];
  priceRange?: { min: number; max: number };
  departureTime?: { start: string; end: string };
  amenities?: string[];
}