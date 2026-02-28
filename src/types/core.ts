import { Timestamp } from 'firebase/firestore';
import { it } from 'node:test';
import { PaymentMethod, PaymentProvider } from './payment';

/**
 * Base interface for all Firestore documents to ensure consistency.
 */

export interface FirestoreDocument {
  id: string;
  companyId?: string; 
  createdAt: Date;
  updatedAt: Date;
  
}


export interface Company extends FirestoreDocument {
  id: string;
  name: string;
  email: string;
  ownerId: string;
  contact: string;
  
  // Details
  address?: string;
  description?: string;
  logo?: string;
  
  // Status
  status: 'active' | 'pending' | 'inactive';
  
  // Settings
  paymentSettings?: {
    gateways?: {
      paychangu?: boolean;
      stripe?: boolean;
    };
  };
  
  // Operating info
  operatingHours?: Record<string, OperatingHours>;
  branches?: string[];
  
  // Social/contact
  socials?: {
    whatsapp?: string;
    website?: string;
  };
  
  // Metadata
  metadata?: Record<string, any>;
}
export type UserRole = 'customer' | 'company_admin' | 'operator' | 'conductor' | 'superadmin';
export type CompanyRole = 'company_admin' | 'operator' | 'conductor';
export type TeamRole = 'operator' | 'conductor';

/**
 * Base user profile - common fields for all roles
 */
export interface UserProfileBase extends FirestoreDocument {
  id: string;
  email: string;
  name?: string;  // Optional full name (for backward compatibility)
  firstName: string;
  lastName: string;
  phone?: string;
  
  // Profile status
  isActive: boolean;
  emailVerified: boolean;
  passwordSet: boolean;
  setupCompleted?: boolean;
  
  // Personal info
  sex?: string;
  nationalId?: string;
  dateOfBirth?: Date;
  currentAddress?: string;
  profilePicture?: string;
  
  // Security
  resetToken?: string;
  resetTokenExpiry?: Date;
  lastLogin?: Date;
  
  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Customer profile (no companyId needed)
 */
export interface CustomerProfile extends UserProfileBase {
  role: 'customer';
  companyId?: never;  // Explicitly not needed
}

/**
 * Company admin profile (companyId required)
 */
export interface CompanyAdminProfile extends UserProfileBase {
  role: 'company_admin';
  companyId: string;  // REQUIRED
}

/**
 * Operator profile (companyId required)
 */
export interface OperatorProfile extends UserProfileBase {
  role: 'operator';
  companyId: string;  // REQUIRED
  region?: string;    // Primary location
  branch?: string[];  // Backup location list
}

/**
 * Conductor profile (companyId required)
 */
export interface ConductorProfile extends UserProfileBase {
  role: 'conductor';
  companyId: string;  // REQUIRED
  name?: string;      // From Admin SDK
}

/**
 * SuperAdmin profile (no companyId needed)
 */
export interface SuperAdminProfile extends UserProfileBase {
  role: 'superadmin';
  companyId?: never;  // Explicitly not needed
}

/**
 * Union type for all user profiles
 * 
 * Usage:
 *   const profile: UserProfile = {...}
 *   if (profile.role === 'company_admin') {
 *     // TypeScript knows profile.companyId is string (required)
 *     console.log(profile.companyId);
 *   }
 */
export type UserProfile = 
  | CustomerProfile 
  | CompanyAdminProfile 
  | OperatorProfile 
  | ConductorProfile 
  | SuperAdminProfile;


export type BusType = 'AC' | 'Non-AC' | 'Sleeper' | 'Semi-Sleeper' | 'Luxury' | 'Economy' | 'Minibus';
export type BusStatus = 'active' | 'inactive' | 'maintenance';
export type FuelType = 'diesel' | 'petrol' | 'electric' | 'hybrid';

export interface InsuranceDetails {
  provider: string;
  policyNumber: string;
  expiryDate: Date;
}

export interface RegistrationDetails {
  registrationNumber: string;
  registrationDate: Date;
  expiryDate: Date;
  authority: string;
}

export interface Bus extends FirestoreDocument {
  id: string;
  companyId: string;
  
  // Basic info
  licensePlate: string;
  busType: BusType;
  capacity: number;
  amenities: string[];
  images?: string[];
  status: BusStatus;
  
  // Registration & legal
  registrationDetails: RegistrationDetails;
  insuranceDetails: InsuranceDetails;  // ← Single source of truth
  
  // Vehicle specs
  fuelType: FuelType;
  yearOfManufacture: number;
  
  // Maintenance
  lastMaintenanceDate: Date;
  nextMaintenanceDate: Date;
  
  // Crew assignments
  conductorIds?: string[];
  
  // Metadata
  metadata?: Record<string, any>;
}

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
  
  // Route details
  origin: string;
  destination: string;
  distance: number;
  duration: number;
  stops: RouteStop[];
  
  // Status
  status: 'active' | 'inactive';
  isActive: boolean;
  
  // Pricing
  baseFare: number;
  pricePerKm?: number;
  
  // Assignments
  assignedOperators?: RouteOperator[];
  assignedOperatorIds?: string[];
  associatedBusIds?: string[];
  
  // Metadata
  metadata?: Record<string, any>;
}

interface RouteOperator {
  operatorId: string;
  operatorName: string;
  operatorEmail: string;
  region: string;
  assignedAt: Date;
}

export type ScheduleStatus = 'pending' | 'published' | 'active' | 'completed' | 'cancelled' | 'archived';

/**
 * Trip lifecycle status for live trip tracking.
 * 
 * scheduled  — default, conductor has not started the trip yet
 * boarding   — conductor tapped "Start Trip" or "Arrived at [stop]"; walk-ons allowed
 * in_transit — conductor tapped "Depart [stop]"; bus is moving, no new walk-ons at departed stop
 * completed  — conductor tapped "Complete Trip" at final destination
 */
export type TripStatus = 'scheduled' | 'boarding' | 'in_transit' | 'completed';

/**
 * A stop as it appears in the full ordered sequence during a live trip.
 * The conductor dashboard builds this from route.stops + sentinel origin/destination.
 */
export interface TripStop {
  id: string;        // '__origin__' | 'stop-0' | 'stop-1' | '__destination__'
  name: string;
  order: number;     // -1 for origin, 999 for destination, route stop order otherwise
}

export interface Schedule extends FirestoreDocument {
  id: string;
  companyId: string;
  busId: string;
  routeId: string;
  
  // Route details — copied from route on materialisation so conductor doesn't need extra fetches
  departureLocation: string;
  arrivalLocation: string;
  
  // Intermediate stops — snapshot copied from route.stops on materialisation
  stops?: RouteStop[];
  
  // Timing
  departureDateTime: Date;
  arrivalDateTime: Date;
  
  // Pricing & availability
  price: number;
  availableSeats: number;
  bookedSeats: string[];  // Seat numbers
  
  // Status
  status: ScheduleStatus;
  isActive: boolean;
  
  // Completion tracking
  completed?: boolean;
  completedAt?: Date;
  
  // Cancellation info
  cancellationReason?: string;

  // For schedules created from templates, this links back to the source template
  templateId?: string;  
  
  // ── Trip lifecycle (set by conductor during live trip) ─────────────────────
  
  /**
   * Current live status of the trip.
   * Defaults to 'scheduled' if not set (trip hasn't started).
   */
  tripStatus?: TripStatus;
  
  /**
   * Index into the full stop sequence (origin + intermediate stops + destination).
   * 0 = at origin, 1 = first intermediate stop, etc.
   * Only meaningful when tripStatus is 'boarding' or 'in_transit'.
   */
  currentStopIndex?: number;
  
  /**
   * Stop IDs that the bus has already DEPARTED from.
   * Used by the booking flow to block new bookings from these stops.
   * e.g. ['__origin__', 'stop-0'] means bus has left origin and Ekwendeni.
   */
  departedStops?: string[];
  
  /**
   * When the conductor tapped "Start Trip". Immutable once set.
   */
  tripStartedAt?: Date;
  
  /**
   * When the conductor tapped "Complete Trip". Immutable once set.
   */
  tripCompletedAt?: Date;
  
  /**
   * UID of the conductor who started and is managing this trip.
   */
  conductorUid?: string;

  // ── Operator assignments ───────────────────────────────────────────────────
  createdBy: string;  // Operator who created schedule
  assignedOperatorIds?: string[];
  assignedConductorIds?: string[];
  
  // Metadata
  metadata?: Record<string, any>;
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday … 6 = Saturday

/**
 * A ScheduleTemplate defines a RECURRING service pattern.
 *
 * One template covers an entire route+time combination.
 * Real `schedules` documents are "materialised" from templates inside a
 * rolling 14-day window via the "Generate Schedules" action in the UI
 * (or optionally a Cloud Function cron).
 *
 * Materialised schedule docs carry a `templateId` field so they can be
 * traced back to the source template.  Bookings still reference the real
 * `scheduleId`, so nothing in the booking flow changes.
 */
export interface ScheduleTemplate {
  id: string;
  companyId: string;

  // What ─────────────────────────────────────────────────────────────────────
  routeId: string;
  busId:   string;

  // When (stored as "HH:MM" 24-hour strings; date is computed on materialise)
  departureTime: string; // e.g. "07:00"
  arrivalTime:   string; // e.g. "14:00"

  // Recurrence ───────────────────────────────────────────────────────────────
  daysOfWeek: DayOfWeek[]; // empty array = every day
  validFrom:  Date;         // first date this template applies
  validUntil: Date | null;  // null = indefinite

  // Pricing & capacity ───────────────────────────────────────────────────────
  price:          number;
  availableSeats: number;

  // Status ───────────────────────────────────────────────────────────────────
  status:   'active' | 'inactive';
  isActive: boolean;

  // Audit ────────────────────────────────────────────────────────────────────
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;

  metadata?: Record<string, unknown>;
}

// ──────

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

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';

export interface Booking extends FirestoreDocument {
  id: string;
  bookingReference: string;
  userId: string;
  scheduleId: string;
  companyId: string;
  routeId: string;
  
  // Passenger information
  passengerDetails: PassengerDetails[];
  seatNumbers: string[];
  
  // Booking details
  totalAmount: number;
  bookingStatus: BookingStatus;
  paymentStatus: 'paid' | 'pending' | 'failed' | 'refunded';
  paidAt?: string;
  
  // Contact information
  contactEmail: string;
  contactPhone: string;
  
  // Dates
  bookingDate: Date;
  confirmedDate?: Date;
  boardedAt?: Date;
  noShowAt?: Date;
  cancellationDate?: Date;
  refundDate?: Date;
  
  // Cancellation/Refund
  cancellationReason?: string;
  refundAmount?: number;
  
  // Payment tracking (reference to Payment document)
  paymentId?: string;
  paymentInitiatedAt?: Date;
  paymentCompletedAt?: Date;
  paymentMethod?: PaymentMethod;
  paymentProvider?: PaymentProvider;
  transactionId?: string;
  transactionReference?: string;
  
  // Audit
  createdBy?: string;
  updatedBy?: string;
  
  // Metadata
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
export interface GroupRequest extends FirestoreDocument {
  id: string;
  userId: string;
  companyId: string;
  
  // Organizer details
  organizerName: string;
  organizerPhone: string;
  
  // Request details
  routeId: string;
  scheduleId: string;
  seatsRequested: number;
  seatsBooked: string[];  // Seat numbers
  
  // Pricing
  totalPrice: number;
  customPrice?: number;
  
  // Status & communication
  status: 'pending' | 'approved' | 'rejected' | 'confirmed' | 'cancelled';
  notes: string;
  companyResponse?: string;
}

export interface GroupBookingFormData {
  organizerName: string;
  organizerPhone: string;
  seatsRequested: number;
  notes: string;
}

export interface Operator {
  id: string;
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'operator';
  companyId: string;
  region: string;
  branch?: string[];
  phoneNumber?: string;
  createdAt: Date;
  updatedAt: Date;
  passwordSet: boolean;
}

export interface OperatingHours {
  open: string;
  close: string;
  closed: boolean;
}

export function isCompanyRole(role: UserRole): role is CompanyRole {
  return ['company_admin', 'operator', 'conductor'].includes(role);
}

/**
 * Type guard to check if profile is company role type
 */
export function isCompanyRoleProfile(profile: UserProfile): profile is CompanyAdminProfile | OperatorProfile | ConductorProfile {
  return isCompanyRole(profile.role);
}

/**
 * Get companyId from any user profile with proper type safety
 */
export function getCompanyId(profile: UserProfile): string | undefined {
  if (isCompanyRoleProfile(profile)) {
    return profile.companyId;
  }
  return undefined;
}

// ── Trip lifecycle helpers ─────────────────────────────────────────────────────

/**
 * Build the full ordered stop sequence for a schedule.
 * Combines sentinel origin/destination with intermediate route stops.
 * 
 * Result: [__origin__, ...intermediate stops by order..., __destination__]
 */
export function buildTripStopSequence(schedule: Schedule): TripStop[] {
  const intermediate = (schedule.stops || [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(s => ({ id: s.id, name: s.name, order: s.order }));

  return [
    { id: '__origin__',      name: schedule.departureLocation, order: -1 },
    ...intermediate,
    { id: '__destination__', name: schedule.arrivalLocation,   order: 999 },
  ];
}

/**
 * Returns true if new bookings from a given stop are still allowed.
 * A stop is blocked once the bus has departed from it.
 */
export function isStopOpenForBooking(stopId: string, schedule: Schedule): boolean {
  const departedStops = schedule.departedStops || [];
  return !departedStops.includes(stopId);
}

/**
 * Get the current stop the bus is at (or about to depart from).
 * Returns null if trip hasn't started or has completed.
 */
export function getCurrentTripStop(schedule: Schedule): TripStop | null {
  if (!schedule.tripStatus || schedule.tripStatus === 'scheduled' || schedule.tripStatus === 'completed') {
    return null;
  }
  const stops = buildTripStopSequence(schedule);
  const idx = schedule.currentStopIndex ?? 0;
  return stops[idx] ?? null;
}

/**
 * Get the next stop the bus will arrive at.
 * Returns null if at final stop or trip not started.
 */
export function getNextTripStop(schedule: Schedule): TripStop | null {
  const stops = buildTripStopSequence(schedule);
  const idx = (schedule.currentStopIndex ?? 0);
  
  if (schedule.tripStatus === 'in_transit') {
    return stops[idx + 1] ?? null;
  }
  if (schedule.tripStatus === 'boarding') {
    return stops[idx + 1] ?? null;
  }
  return null;
}