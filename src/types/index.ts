import { Timestamp } from "firebase/firestore";

export interface CreateCompanyRequest {
  name: string;
  email: string;
  contact: string;
  status: 'active' | 'pending' | 'inactive';
  address?: string;
  description?: string;
}
export interface EnhancedSchedule extends Omit<Schedule, "departureDateTime" | "arrivalDateTime"> {
  date: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  companyName: string;
  companyPhone?: string;
  origin: string;
  destination: string;
  duration: number;
  distance: number;
  busNumber: string;
  busType: string;
  totalSeats: number;
  amenities: string[];
}


export interface Company {
  id: string;
  name: string;
  email: string;
  ownerId: string; // Firebase Auth UID of company admin
  contact: string;
  address?: string;
  description?: string;
  logo?: string;
  status: 'active' | 'pending' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // Super admin who created this company
  
  // Analytics fields for dashboard
  totalBuses?: number;
  totalRoutes?: number;
  monthlyRevenue?: number;
  totalBookings?: number;
  
  // Payment settings
  paymentService?: string; // e.g., "PayChangu"
  merchantId?: string;
  apiKey?: string; // Encrypted
}

export interface Bus {
  id: string;
  companyId: string;
  licensePlate: string; // Changed from busNumber, required and unique per Firestore rules
  busType: 'AC' | 'Non-AC' | 'Sleeper' | 'Semi-Sleeper' | 'Luxury' | 'Economy';
  capacity: number; // Changed from totalSeats, must be 10-100 per Firestore rules
  seatLayout?: {
    rows: number;
    seatsPerRow: number;
    seatMap: string[][]; // 2D array representing seat layout
  };
  amenities: string[];
  features?: string[]; // WiFi, Charging ports, etc.
  images?: string[];
  status: 'active' | 'inactive' | 'maintenance';
  model?: string;
  year?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Route {
  id: string;
  companyId: string;
  routeCode: string; // e.g., "BT-LL-001"
  origin: string;
  destination: string;
  distance: number; // in kilometers, must be positive
  duration: number; // in minutes, must be positive
  stops: RouteStop[];
  basePrice: number;
  status: 'active' | 'inactive';
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RouteStop {
  id: string;
  name: string;
  arrivalTime?: string;
  departureTime?: string;
  distanceFromOrigin: number;
  order: number;
}

export interface Schedule {
  id: string;
  companyId: string;
  busId: string;
  routeId: string;
  departureDateTime: Timestamp; // Combined date and time, must be in the future
  arrivalDateTime: Timestamp;
  price: number;
  availableSeats: number;
  bookedSeats: string[]; // Seat numbers or IDs
  reservedSeats?: string[]; // Temporarily reserved during booking process
  status: 'active' | 'cancelled' | 'completed';
  recurringDays?: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  validFrom?: Date;
  validTo?: Date;
  createdAt: Date;
  updatedAt: Date;
 
}

export interface Booking {
  id: string;
  bookingReference: string; // User-friendly booking reference
  userId: string;
  scheduleId: string;
  companyId: string;
  busId: string;
  routeId: string;
  
  // Passenger information
  passengerDetails: PassengerDetail[];
  seatNumbers: string[];
  
  // Pricing
  baseAmount: number;
  taxes: number;
  fees: number;
  discountAmount?: number;
  totalAmount: number;
  
  // Status tracking
  bookingStatus: 'confirmed' | 'cancelled' | 'pending' | 'completed' | 'no-show';
  paymentStatus: 'paid' | 'pending' | 'failed' | 'refunded' | 'partial-refund';
  
  // Payment details
  paymentId?: string;
  paymentService?: string; // e.g., "PayChangu"
  transactionId?: string;
  paymentMethod?: 'mobile_money' | 'bank_transfer' | 'cash' | 'card';
  
  // Contact information
  contactEmail: string;
  contactPhone: string;
  
  // Trip details
  departureDateTime: Date;
  arrivalDateTime: Date;
  origin: string;
  destination: string;
  
  // Timestamps
  bookingDate: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Cancellation details
  cancellationReason?: string;
  cancellationDate?: Date;
  refundAmount?: number;
  refundStatus?: 'pending' | 'processed' | 'failed';
}

export interface PassengerDetail {
  id?: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  seatNumber: string;
  idType?: 'national_id' | 'passport' | 'drivers_license';
  idNumber?: string;
  phone?: string;
  email?: string;
  contactNumber?: string;
}

export interface SearchFilters {
  busType?: ('AC' | 'Non-AC' | 'Sleeper' | 'Semi-Sleeper' | 'Luxury' | 'Economy')[];
  priceRange?: {
    min: number;
    max: number;
  };
  departureTime?: {
    start: string;
    end: string;
  };
  amenities?: string[];
  company?: string;
  features?: string[];
  seatAvailability?: number; // Minimum seats required
}

export interface SearchResult {
  schedule: Schedule;
  bus: Bus;
  route: Route;
  company: Company;
  availableSeats: number;
  lowestPrice: number;
  estimatedDuration: number;
}

export interface UserProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string; // For backward compatibility
  email: string;
  phone?: string;
  role: 'customer' | 'company_admin' | 'superadmin';
  companyId?: string;
  
  // Additional profile fields
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  address?: {
    street?: string;
    city?: string;
    region?: string;
    country?: string;
    postalCode?: string;
  };
  
  // Preferences
  preferences?: {
    language: string;
    currency: string;
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
  };
  
  // Account status
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// Dashboard specific types
export interface DashboardStats {
  totalCompanies: number;
  activeCompanies: number;
  pendingCompanies: number;
  inactiveCompanies: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalBookings: number;
  monthlyBookings: number;
  monthlyGrowth: number;
  revenueGrowth: number;
}

export interface CompanyStats {
  totalBuses: number;
  activeBuses: number;
  totalRoutes: number;
  activeRoutes: number;
  totalBookings: number;
  monthlyBookings: number;
  revenue: {
    total: number;
    monthly: number;
    daily: number;
  };
  performance: {
    onTimePercentage: number;
    cancellationRate: number;
    customerRating: number;
  };
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: { [key: string]: string[] };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Search and filter types
export interface SearchQuery {
  origin: string;
  destination: string;
  date: string;
  passengers?: number;
  filters?: SearchFilters;
}

export interface Location {
  id: string;
  name: string;
  code: string;
  city: string;
  region: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Payment related types
export interface PaymentIntent {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  clientSecret?: string;
  metadata?: { [key: string]: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentProvider {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  supportedMethods: string[];
  config: { [key: string]: any };
}

// Notification types
export interface Notification {
  id: string;
  userId: string;
  type: 'booking_confirmed' | 'payment_received' | 'trip_reminder' | 'cancellation' | 'system';
  title: string;
  message: string;
  data?: { [key: string]: any };
  isRead: boolean;
  createdAt: Date;
}

// System settings
export interface SystemSettings {
  id: string;
  key: string;
  value: any;
  category: 'general' | 'payment' | 'notification' | 'booking';
  description?: string;
  isPublic: boolean;
  updatedBy: string;
  updatedAt: Date;
}

// Audit log
export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: { [key: string]: { old: any; new: any } };
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}