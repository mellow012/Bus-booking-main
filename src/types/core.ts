import { Timestamp } from 'firebase/firestore';

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
  ownerId: string;
  contact: string;
  address?: string;
  description?: string;
  logo?: string;
  status: 'active' | 'pending' | 'inactive';
  paymentSettings?: {
    gateways?: {
      paychangu?: boolean;
      stripe?: boolean;
    };
  };
  metadata?: Record<string, any>;
}

export type BusType = 'AC' | 'Non-AC' | 'Sleeper' | 'Semi-Sleeper' | 'Luxury' | 'Economy' | 'Minibus';
export type BusStatus = 'active' | 'inactive' | 'maintenance';

export interface Bus extends FirestoreDocument {
  companyId: string;
  licensePlate: string;
  busType: BusType;
  capacity: number;
  amenities: string[];
  images?: string[];
  status: BusStatus;
  registrationDetails: {
    registrationNumber: string;
    registrationDate: Date;
    expiryDate: Date;
    authority: string;
  };
}

export interface RouteStop {
  id: string;
  name: string;
  distanceFromOrigin: number;
  order: number;
}

export interface Route extends FirestoreDocument {
  name: string;
  companyId: string;
  origin: string;
  destination: string;
  distance: number;
  duration: number;
  stops: RouteStop[];
  status: 'active' | 'inactive';
  isActive: boolean;
}

export interface Schedule {
  id: string;
  companyId: string;
  busId: string;
  routeId: string;
  departureLocation: string;
  arrivalLocation: string;
  departureDateTime: Date;
  arrivalDateTime: Date;
  price: number;
  availableSeats: number;
  bookedSeats: string[];
  status: 'active' | 'cancelled' | 'completed';
  isActive: boolean;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface PassengerDetails {
  id?: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  seatNumber: string;
  specialNeeds?: string;
  ticketType?: 'adult' | 'child' | 'senior' | 'infant';
  identification?: {
    type: 'passport' | 'national_id' | 'driver_license' | 'other';
    number: string;
  };
  contactNumber?: string;
  email?: string; 
}

export interface Booking {
  id: string;
  bookingReference: string;
  userId: string;
  scheduleId: string;
  companyId: string;
  passengerDetails: PassengerDetails[];
  seatNumbers: string[];
  totalAmount: number;
  bookingStatus: 'confirmed' | 'cancelled' | 'pending' | 'completed' | 'no-show';
  paymentStatus: 'paid' | 'pending' | 'failed' | 'refunded';
  contactEmail: string;
  contactPhone: string;
  bookingDate: Date;
  cancellationDate?: Date;
  refundDate?: Date;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  cancellationReason?: string;
  paymentInitiatedAt?: Date | Timestamp;
  paymentCompletedAt?: Date | Timestamp;
  metadata?: Record<string, any>;
  paymentProvider?: string;
  transactionId?: string;
  routeId: string;
  paymentGateway: string;
  transactionReference?: string;
  confirmedDate?: Date | Timestamp;
}

export interface UserProfile extends FirestoreDocument {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role: 'customer' | 'company_admin' | 'superadmin' | 'operator';
  companyId?: string;
  isActive: boolean;
  emailVerified: boolean;
  sex?: string;
  nationalId?: string;
  dateOfBirth?: Date;
  currentAddress?: string;
  profilePicture?: string;
  resetToken?: string;
  resetTokenExpiry?: Date;
  setupCompleted?: boolean;
  passwordSet?: boolean;
  lastLogin?: Date;
  metadata?: Record<string, any>;
}

export interface Location extends FirestoreDocument {
  name: string;
  city: string;
  region: string;
  country: string;
  isActive: boolean;
}

export interface Amenity extends FirestoreDocument {
  name: string;
  description?: string;
  icon?: string;
  isActive: boolean;
}