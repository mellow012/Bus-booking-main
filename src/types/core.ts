import { Timestamp } from 'firebase/firestore';
import { it } from 'node:test';

/**
 * Base interface for all Firestore documents to ensure consistency.
 */
export interface FirestoreDocument {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}


export interface OperatingHours {
  open: string;  // e.g., "08:00"
  close: string; // e.g., "18:00"
  closed: boolean;
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
  operatingHours?: Record<string, OperatingHours>; // Day of week as key
  socials?: {
    whatsapp?: string;
    website?: string;
  };
  metadata?: Record<string, any>;
}

export type BusType = 'AC' | 'Non-AC' | 'Sleeper' | 'Semi-Sleeper' | 'Luxury' | 'Economy' | 'Minibus';
export type BusStatus = 'active' | 'inactive' | 'maintenance';

export interface Bus extends FirestoreDocument {
  id: string;
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
    fuelType: "diesel" | "petrol" | "electric" | "hybrid",
  yearOfManufacture: number,
  insuranceDetails: {
    provider: string;
    policyNumber: string;
    expiryDate: Date;
  },
  insuranceExpiry: Date,
  lastMaintenanceDate: Date,
  nextMaintenanceDate: Date,
};


export interface RouteStop {
  id: string;
  name: string;
  distanceFromOrigin: number;
  order: number;
   address?: string;
  pickupPoint?: string; // Specific landmark/location
  estimatedArrival?: number; // minutes from origin
  contactPerson?: string;
  contactPhone?: string;
}

export interface Route extends FirestoreDocument {
  id: string;
  name: string;
  companyId: string;
  origin: string;
  destination: string;
  distance: number;
  duration: number;
  stops: RouteStop[];
  status: 'active' | 'inactive';
  isActive: boolean;
  baseFare: number; // Base ticket price in MWK
  pricePerKm?: number;
}

export interface Schedule {
  id: string;
  companyId: string;
  busId: string;
  routeId: string;
  departureLocation: string;
  arrivalLocation: string;
  departureDateTime: Date | string;
  arrivalDateTime: Date | string;
  price: number;
  availableSeats: number;
  bookedSeats: string[];
  status: 'active' | 'cancelled' | 'completed';
  isActive: boolean;
  createdBy: string;
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
  createdBy?: string;
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
export interface GroupRequest {
  id: string;
  userId: string;
  organizerName: string;
  organizerPhone: string;
  routeId: string;
  scheduleId: string;
  seatsRequested: number;
  seatsBooked: number[];
  totalPrice: number; // Base estimate
  customPrice?: number; // Negotiated price
  status: 'pending' | 'approved' | 'rejected' | 'confirmed' | 'cancelled';
  notes: string; // Group purpose (e.g., "School trip for 20 students")
  companyResponse?: string; // Company notes
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GroupBookingFormData {
  organizerName: string;
  organizerPhone: string;
  seatsRequested: number;
  notes: string;
}