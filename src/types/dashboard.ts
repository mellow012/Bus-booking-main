import { Schedule, Company, Route, Bus, Booking } from './core';

export type TabType = "overview" | "schedules" | "routes" | "buses" | "bookings" | "profile" | "settings" | "payments" | "operators";

/**
 * Defines the shape of the data needed for the entire admin dashboard.
 */
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

/**
 * A transformed Schedule type for easier display on search result pages.
 */
export interface EnhancedSchedule extends Omit<Schedule, "departureDateTime" | "arrivalDateTime"> {

date: string;
departureTime: string;
arrivalDate: string;
arrivalTime: string;
companyName: string;
origin: string;
destination: string;
lincesPlate: string;
busType: string;
companyId: string
busId: string
routeId: string
price: number
availableSeats: number
duration: number
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
  departureTime?: { start: string; end:string };
  amenities?: string[];
}