// types/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central type definitions for TibhukeBus.
//
// TIMESTAMP STRATEGY:
//   Firestore timestamps go through three states:
//     1. Write:  serverTimestamp() returns FieldValue — a sentinel instruction.
//     2. Pending: before the write resolves, onSnapshot may return null.
//     3. Read:   Firestore SDK returns a Timestamp object (not a JS Date).
//
//   The FirestoreTimestamp union covers all three states. Use the toDate()
//   helper in lib/utils.ts to safely convert to a JS Date for display.
//
//   NEVER cast serverTimestamp() as unknown as Date — TypeScript will accept
//   it but the runtime value is wrong and will crash any Date method call.
// ─────────────────────────────────────────────────────────────────────────────

import { Timestamp, FieldValue } from 'firebase/firestore';
import { PaymentMethod, PaymentProvider } from './payment';

// ─── Timestamp union ──────────────────────────────────────────────────────────

/**
 * The type of any timestamp field on a Firestore document.
 *
 *   Date      — plain JS Date (e.g. from manual construction or test fixtures)
 *   Timestamp — Firestore Timestamp returned when reading a document
 *   FieldValue — serverTimestamp() sentinel used when writing
 *   null      — onSnapshot may return null before the server value resolves
 */
export type FirestoreTimestamp = Date | Timestamp | FieldValue | null;

// ─── Base document ────────────────────────────────────────────────────────────

/**
 * Base interface for all Firestore documents.
 * All timestamp fields use FirestoreTimestamp to correctly represent the full
 * write → pending → read lifecycle.
 */
export interface FirestoreDocument {
  id: string;
  companyId?: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// ─── Payment settings ─────────────────────────────────────────────────────────

/**
 * Payment settings for a company.
 * Secret keys are stored encrypted (AES-256-GCM) — never plaintext.
 */
export interface CompanyPaymentSettings {
  // ── PayChangu (single-merchant mobile money) ───────────────────────────────
  paychanguEnabled?: boolean;
  /** Merchant receive number (Airtel/TNM mobile money number) */
  paychanguReceiveNumber?: string;
  /** Public key (pub-...) — safe to store plaintext */
  paychanguPublicKey?: string;
  /**
   * AES-256-GCM encrypted secret key (sec-...).
   * Format: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
   * Decrypted server-side only using PAYCHANGU_ENCRYPTION_KEY env var.
   * Never sent to the browser.
   */
  paychanguSecretKeyEnc?: string;
  paychanguUpdatedAt?: FirestoreTimestamp;

  // ── Stripe (cards & bank transfers) ───────────────────────────────────────
  stripeEnabled?: boolean;
  /** Connected account ID (acct_...) from Stripe OAuth or manual entry */
  stripeAccountId?: string;
  /** True once KYC / onboarding is complete in the Stripe dashboard */
  stripeOnboardingComplete?: boolean;
}

// ─── Company ──────────────────────────────────────────────────────────────────

export interface Company extends FirestoreDocument {
  id: string;
  name: string;
  email: string;
  ownerId: string;
  contact: string;

  address?: string;
  description?: string;
  logo?: string;

  status: 'active' | 'pending' | 'inactive';

  paymentSettings?: CompanyPaymentSettings;

  operatingHours?: Record<string, OperatingHours>;
  branches?: string[];

  socials?: {
    whatsapp?: string;
    website?: string;
  };

  metadata?: Record<string, any>;
}

// ─── User roles ───────────────────────────────────────────────────────────────

export type UserRole     = 'customer' | 'company_admin' | 'operator' | 'conductor' | 'superadmin';
export type CompanyRole  = 'company_admin' | 'operator' | 'conductor';
export type TeamRole     = 'operator' | 'conductor';

// ─── User profile base ────────────────────────────────────────────────────────

/**
 * Fields common to all user roles.
 * Date-like fields that are only ever set by the application (not Firestore)
 * stay as `Date`. Fields written via serverTimestamp() use FirestoreTimestamp.
 */
export interface UserProfileBase extends FirestoreDocument {
  id: string;
  uid: string;
  email: string;
  name?: string;
  firstName: string;
  lastName: string;
  phone?: string;

  isActive?: boolean;
  emailVerified?: boolean;
  passwordSet?: boolean;
  setupCompleted?: boolean;

  sex?: string;
  nationalId?: string;
  dateOfBirth?: Date;
  currentAddress?: string;
  profilePicture?: string;

  resetToken?: string;
  resetTokenExpiry?: Date;
  lastLogin?: FirestoreTimestamp;

  metadata?: Record<string, any>;
}

// ─── Role-specific profiles ───────────────────────────────────────────────────

export interface CustomerProfile extends UserProfileBase {
  role: 'customer';
  companyId?: never;
}

export interface CompanyAdminProfile extends UserProfileBase {
  role: 'company_admin';
  companyId: string;
}

export interface OperatorProfile extends UserProfileBase {
  role: 'operator';
  companyId: string;
  region?: string;
  branch?: string[];
}

export interface ConductorProfile extends UserProfileBase {
  role: 'conductor';
  companyId: string;
  name?: string;
}

export interface SuperAdminProfile extends UserProfileBase {
  role: 'superadmin';
  companyId?: never;
}

/**
 * Discriminated union of all user profile shapes.
 *
 * Usage:
 *   if (profile.role === 'company_admin') {
 *     profile.companyId // string — TypeScript knows it's required here
 *   }
 */
export type UserProfile =
  | CustomerProfile
  | CompanyAdminProfile
  | OperatorProfile
  | ConductorProfile
  | SuperAdminProfile;

// ─── Bus ──────────────────────────────────────────────────────────────────────

export type BusType   = 'AC' | 'Non-AC' | 'Sleeper' | 'Semi-Sleeper' | 'Luxury' | 'Economy' | 'Minibus';
export type BusStatus = 'active' | 'inactive' | 'maintenance';
export type FuelType  = 'diesel' | 'petrol' | 'electric' | 'hybrid';

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

  licensePlate: string;
  busType: BusType;
  capacity: number;
  amenities: string[];
  images?: string[];
  status: BusStatus;

  registrationDetails: RegistrationDetails;
  insuranceDetails: InsuranceDetails;

  fuelType: FuelType;
  yearOfManufacture: number;

  lastMaintenanceDate: Date;
  nextMaintenanceDate: Date;

  conductorIds?: string[];

  metadata?: Record<string, any>;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export interface RouteStop {
  id: string;
  name: string;
  distanceFromOrigin: number;
  order: number;
  address?: string;
  pickupPoint?: string;
  estimatedArrival?: number;
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

  baseFare: number;
  pricePerKm?: number;

  assignedOperators?: RouteOperator[];
  assignedOperatorIds?: string[];
  associatedBusIds?: string[];

  metadata?: Record<string, any>;
}

interface RouteOperator {
  operatorId: string;
  operatorName: string;
  operatorEmail: string;
  region: string;
  assignedAt: FirestoreTimestamp;
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export type ScheduleStatus =
  | 'pending'
  | 'published'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'archived';

/**
 * Trip lifecycle status for live trip tracking.
 *
 * scheduled  — default; conductor has not started the trip yet
 * boarding   — conductor tapped "Start Trip" or "Arrived at [stop]"
 * in_transit — conductor tapped "Depart [stop]"; bus is moving
 * completed  — conductor tapped "Complete Trip" at final destination
 */
export type TripStatus = 'scheduled' | 'boarding' | 'in_transit' | 'completed';

export interface TripStop {
  id: string;
  name: string;
  order: number;
}

export interface Schedule extends FirestoreDocument {
  id: string;
  companyId: string;
  busId: string;
  routeId: string;

  departureLocation: string;
  arrivalLocation: string;

  stops?: RouteStop[];

  departureDateTime: FirestoreTimestamp;
  arrivalDateTime: FirestoreTimestamp;

  price: number;
  availableSeats: number;
  bookedSeats: string[];

  status: ScheduleStatus;
  isActive: boolean;

  completed?: boolean;
  completedAt?: FirestoreTimestamp;

  cancellationReason?: string;

  templateId?: string;

  tripStatus?: TripStatus;
  currentStopIndex?: number;
  departedStops?: string[];
  tripStartedAt?: FirestoreTimestamp;
  tripCompletedAt?: FirestoreTimestamp;
  conductorUid?: string;

  createdBy: string;
  assignedOperatorIds?: string[];
  assignedConductorIds?: string[];

  metadata?: Record<string, any>;
}

// ─── Schedule template ────────────────────────────────────────────────────────

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ScheduleTemplate {
  id: string;
  companyId: string;

  routeId: string;
  busId: string;

  departureTime: string;
  arrivalTime: string;

  daysOfWeek: DayOfWeek[];
  validFrom: FirestoreTimestamp;
  validUntil: FirestoreTimestamp;

  price: number;
  availableSeats: number;

  status: 'active' | 'inactive';
  isActive: boolean;

  createdBy: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;

  metadata?: Record<string, unknown>;
}

// ─── Booking ──────────────────────────────────────────────────────────────────

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

  passengerDetails: PassengerDetails[];
  seatNumbers: string[];

  totalAmount: number;
  bookingStatus: BookingStatus;
  paymentStatus: 'paid' | 'pending' | 'failed' | 'refunded';
  paidAt?: string;

  contactEmail: string;
  contactPhone: string;

  bookingDate: FirestoreTimestamp;
  confirmedDate?: FirestoreTimestamp;
  boardedAt?: FirestoreTimestamp;
  noShowAt?: FirestoreTimestamp;
  cancellationDate?: FirestoreTimestamp;
  refundDate?: FirestoreTimestamp;

  cancellationReason?: string;
  refundAmount?: number;

  paymentId?: string;
  paymentInitiatedAt?: FirestoreTimestamp;
  paymentCompletedAt?: FirestoreTimestamp;
  paymentMethod?: PaymentMethod;
  paymentProvider?: PaymentProvider;
  transactionId?: string;
  transactionReference?: string;

  paychanguReference?: string;
  paychanguNetwork?: 'AIRTEL' | 'TNM';

  createdBy?: string;
  updatedBy?: string;

  metadata?: Record<string, any>;
}

// ─── Supporting types ─────────────────────────────────────────────────────────

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

  organizerName: string;
  organizerPhone: string;

  routeId: string;
  scheduleId: string;
  seatsRequested: number;
  seatsBooked: string[];

  totalPrice: number;
  customPrice?: number;

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
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  passwordSet: boolean;
}

export interface OperatingHours {
  open: string;
  close: string;
  closed: boolean;
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isCompanyRole(role: UserRole): role is CompanyRole {
  return ['company_admin', 'operator', 'conductor'].includes(role);
}

export function isCompanyRoleProfile(
  profile: UserProfile
): profile is CompanyAdminProfile | OperatorProfile | ConductorProfile {
  return isCompanyRole(profile.role);
}

export function getCompanyId(profile: UserProfile): string | undefined {
  return isCompanyRoleProfile(profile) ? profile.companyId : undefined;
}

// ─── Trip lifecycle helpers ───────────────────────────────────────────────────

export function buildTripStopSequence(schedule: Schedule): TripStop[] {
  const intermediate = (schedule.stops || [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(s => ({ id: s.id, name: s.name, order: s.order }));

  return [
    { id: '__origin__',      name: schedule.departureLocation, order: -1  },
    ...intermediate,
    { id: '__destination__', name: schedule.arrivalLocation,   order: 999 },
  ];
}

export function isStopOpenForBooking(stopId: string, schedule: Schedule): boolean {
  return !(schedule.departedStops ?? []).includes(stopId);
}

export function getCurrentTripStop(schedule: Schedule): TripStop | null {
  if (
    !schedule.tripStatus ||
    schedule.tripStatus === 'scheduled' ||
    schedule.tripStatus === 'completed'
  ) {
    return null;
  }
  const stops = buildTripStopSequence(schedule);
  return stops[schedule.currentStopIndex ?? 0] ?? null;
}

export function getNextTripStop(schedule: Schedule): TripStop | null {
  if (
    schedule.tripStatus !== 'boarding' &&
    schedule.tripStatus !== 'in_transit'
  ) {
    return null;
  }
  const stops = buildTripStopSequence(schedule);
  return stops[(schedule.currentStopIndex ?? 0) + 1] ?? null;
}