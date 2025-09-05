/**
 * Base interface for all Firestore documents to ensure consistency.
 */
export interface FirestoreDocument {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Company extends FirestoreDocument {
  name: string;
  email: string;
  ownerId: string; // Firebase Auth UID of company admin
  contact: string;
  address?: string;
  description?: string;
  logo?: string;
  status: 'active' | 'pending' | 'inactive';
  paymentSettings?: { // Merged payment settings from your other example
    gateways?: {
      paychangu?: boolean;
      stripe?: boolean;
    };
  };
}

export interface Bus extends FirestoreDocument {
  companyId: string;
  licensePlate: string;
  busType: 'AC' | 'Non-AC' | 'Sleeper' | 'Semi-Sleeper' | 'Luxury' | 'Economy' | 'Minibus';
  capacity: number;
  amenities: string[];
  images?: string[];
  status: 'active' | 'inactive' | 'maintenance';
}

export interface RouteStop {
  id: string;
  name: string;
  distanceFromOrigin: number;
  order: number;
}

export interface Route extends FirestoreDocument {
  companyId: string;
  origin: string;
  destination: string;
  distance: number; // in kilometers
  duration: number; // in minutes
  stops: RouteStop[];
  status: 'active' | 'inactive';
}

export interface Schedule extends FirestoreDocument {
  companyId: string;
  busId: string;
  routeId: string;
  departureDateTime: Date; // Normalized to Date
  arrivalDateTime: Date;   // Normalized to Date
  price: number;
  availableSeats: number;
  bookedSeats: string[];
  status: 'active' | 'cancelled' | 'completed';
  isActive: boolean; // Retaining from your original component code
}

export interface PassengerDetail {
  id?: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  seatNumber: string;
}

export interface Booking extends FirestoreDocument {
  bookingReference: string;
  userId: string;
  scheduleId: string;
  companyId: string;
  passengerDetails: PassengerDetail[];
  seatNumbers: string[];
  totalAmount: number;
  bookingStatus: 'confirmed' | 'cancelled' | 'pending' | 'completed' | 'no-show';
  paymentStatus: 'paid' | 'pending' | 'failed' | 'refunded';
  contactEmail: string;
  contactPhone: string;
  bookingDate: Date;
  cancellationDate?: Date;
  refundDate?: Date;
}

export interface UserProfile extends FirestoreDocument {
  name: string;
  email: string;
  phone?: string;
  role: 'customer' | 'company_admin' | 'superadmin' | 'operator'; // Added operator
  companyId?: string;
  isActive: boolean;
  emailVerified: boolean;
}

export interface Location extends FirestoreDocument {
  name: string;
  city: string;
  region: string;
  country: string;
  isActive: boolean;
}