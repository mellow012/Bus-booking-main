import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendNotification, useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAppToast } from '@/contexts/ToastContext';
import { Booking, Schedule, Bus, Route, Company, UserProfile } from '@/types';

// PaymentProvider type
export type PaymentProvider = 'paychangu' | 'cash' | 'local_bank';

// BookingWithDetails mirrors the shape used by the UI layer
export interface BookingSegmentWithDetails {
  id: string;
  scheduleId: string;
  originStopId?: string;
  destinationStopId?: string;
  seatNumbers?: string[];
  date?: Date;
  schedule: Schedule;
  route: Route;
}

export interface BookingWithDetails extends Booking {
  schedule: Schedule;
  bus: Bus;
  route: Route;
  company: Company;
  paymentProvider?: PaymentProvider;
  originStopId?: string;
  destinationStopId?: string;
  originStopName?: string;
  destinationStopName?: string;
  pricePerPerson?: number;
  reviewRating?: number | null;
  reviewText?: string | null;
  segments?: BookingSegmentWithDetails[];
  returnSegment?: BookingSegmentWithDetails;
}

export interface SearchFilters {
  busType?: string | string[];
  priceRange?: { min?: number; max?: number };
  company?: string;
  [key: string]: unknown;
}

export function resolveStopName(
  stopId: string | undefined,
  savedName: string | undefined,
  route: Route | undefined | null,
  fallback: string,
): string {
  if (savedName) return savedName;
  if (!route) return fallback;
  if (stopId === '__origin__') return route.origin || fallback;
  if (stopId === '__destination__') return route.destination || fallback;
  if (stopId && route.stops) {
    const f = route.stops.find((s) => s.id === stopId);
    if (f) return f.name;
  }
  return fallback;
}

const CITY_DISTANCES: Record<string, Record<string, number>> = {
  lilongwe: { blantyre: 310, mzuzu: 360, zomba: 290, kasungu: 130, salima: 110, mangochi: 190 },
  blantyre: { lilongwe: 310, mzuzu: 670, zomba: 70, kasungu: 440, salima: 350, mangochi: 190 },
  mzuzu: { lilongwe: 360, blantyre: 670, zomba: 610, kasungu: 230, salima: 310, karonga: 220 },
};

export function estimateDistance(origin: string, destination: string): number {
  const o = origin.toLowerCase().trim();
  const d = destination.toLowerCase().trim();
  if (CITY_DISTANCES[o]?.[d]) return CITY_DISTANCES[o][d];
  if (CITY_DISTANCES[d]?.[o]) return CITY_DISTANCES[d][o];
  return 0;
}

export function getEstimatedDuration(origin: string, destination: string, dbDuration?: number, dbDistance?: number): number {
  if (dbDuration && dbDuration > 0) return dbDuration;
  const dist = (dbDistance && dbDistance > 0) ? dbDistance : estimateDistance(origin, destination);
  if (dist > 0) {
    return Math.round((dist / 80) * 60); // Assume average speed of 80 km/h
  }
  return 120; // fallback to 2 hours
}

function normalizeText(value: string | undefined, fallback = ''): string {
  if (!value) return fallback;
  let text = value;
  try {
    text = decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    // Keep original text when it's not URL encoded.
  }
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .trim() || fallback;
}

export const useBookingsList = () => {
  const { user, userProfile } = useAuth();
  const toast = useAppToast();
  const { notifications: ctxNotifications } = useNotifications();

  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [activeFilter, setActiveFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [toastNotifications, setToastNotifications] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const bookingsPerPage = 5;

  const [methodModalOpen, setMethodModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedSubId, setSelectedSubId] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [userDetails, setUserDetails] = useState({ name: '', email: '', phone: '+265' });

  const cleanupFunctions = useRef<Set<() => void>>(new Set());
  const lastNotificationIdsRef = useRef<Set<string>>(new Set());

  // Formatters
  const formatTime = useCallback((dateTime: unknown): string => {
    let d: Date;
    if (dateTime instanceof Date) d = dateTime;
    else if (typeof dateTime === 'string') d = new Date(dateTime);
    else if ((dateTime as any)?.seconds) d = new Date((dateTime as any).seconds * 1000);
    else return 'N/A';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }, []);

  const formatDate = useCallback((dateTime: unknown): string => {
    let d: Date;
    if (dateTime instanceof Date) d = dateTime;
    else if (typeof dateTime === 'string') d = new Date(dateTime);
    else if ((dateTime as any)?.seconds) d = new Date((dateTime as any).seconds * 1000);
    else return 'N/A';
    return d.toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }, []);

  const getStatusColor = useCallback((s: string): string => (
    ({ confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200', cancelled: 'bg-red-100 text-red-800 border-red-200', pending: 'bg-amber-100 text-amber-800 border-amber-200' } as Record<string, string>)[s]
    ?? 'bg-gray-100 text-gray-800 border-gray-200'
  ), []);

  const getPaymentStatusColor = useCallback((s: string): string => (
    ({ paid: 'bg-emerald-100 text-emerald-800 border-emerald-200', failed: 'bg-red-100 text-red-800 border-red-200', pending: 'bg-amber-100 text-amber-800 border-amber-200' } as Record<string, string>)[s]
    ?? 'bg-gray-100 text-gray-800 border-gray-200'
  ), []);

  const isBookingExpired = useCallback((b: BookingWithDetails) => {
    const arr = b.schedule?.arrivalDateTime instanceof Date
      ? b.schedule.arrivalDateTime
      : new Date(b.schedule?.arrivalDateTime as unknown as string);
    return arr < new Date()
      && b.bookingStatus !== 'completed'
      && b.bookingStatus !== 'cancelled'
      && !(b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid')
      && !((b as any).paymentMethod === 'cash_on_boarding' && b.bookingStatus === 'confirmed');
  }, []);

  const applyFiltersLogic = useCallback((src: BookingWithDetails[], af: string, cf: SearchFilters) => {
    let f = [...src];
    const now = new Date();
    if (af === 'confirmed') f = f.filter((b) => b.bookingStatus === 'confirmed' && (b.paymentStatus === 'paid' || (b as any).paymentMethod === 'cash_on_boarding'));
    else if (af === 'pending') f = f.filter((b) => b.bookingStatus === 'pending' || (b.bookingStatus === 'confirmed' && b.paymentStatus === 'pending' && (b as any).paymentMethod !== 'cash_on_boarding'));
    else if (af === 'cancelled') f = f.filter((b) => b.bookingStatus === 'cancelled');
    else if (af === 'upcoming') f = f.filter((b) => {
      const d = b.schedule?.departureDateTime instanceof Date ? b.schedule.departureDateTime : new Date(b.schedule?.departureDateTime as unknown as string);
      return d > now && b.bookingStatus === 'confirmed' && (b.paymentStatus === 'paid' || (b as any).paymentMethod === 'cash_on_boarding');
    });
    if (cf.busType) { const t = Array.isArray(cf.busType) ? cf.busType : [cf.busType]; f = f.filter((b) => b.bus?.busType && t.includes(b.bus.busType)); }
    if (cf.priceRange) { f = f.filter((b) => b.schedule?.price !== undefined && b.schedule.price >= ((cf.priceRange as any)?.min ?? 0) && b.schedule.price <= ((cf.priceRange as any)?.max ?? Infinity)); }
    if (cf.company) f = f.filter((b) => b.company?.name === cf.company);
    setFilteredBookings(f);
    setCurrentPage(1);
  }, []);

  // Fetch bookings from API
  const fetchBookings = useCallback(async () => {
    if (!user?.id) return;
    if (bookings.length === 0) setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/bookings?page=1&limit=100', { credentials: 'include' });
      let json: any = null;
      try { json = await response.json(); } catch (e) {
        // ignore JSON parse errors
      }
      if (!response.ok) {
        console.error('fetch /api/bookings failed', response.status, json);
        throw new Error(json?.error || json?.message || `HTTP ${response.status}`);
      }
      const { data: apiBookings } = json || {};

      const details: BookingWithDetails[] = apiBookings.map((b: any) => {
        const mappedSegments: BookingSegmentWithDetails[] = Array.isArray(b.segments)
          ? b.segments.map((segment: any) => ({
              id: segment.id,
              scheduleId: segment.scheduleId,
              originStopId: segment.originStopId,
              destinationStopId: segment.destinationStopId,
              seatNumbers: Array.isArray(segment.seatNumbers) ? segment.seatNumbers : [],
              date: segment.date ? new Date(segment.date) : undefined,
              schedule: {
                id: segment.schedule?.id || '',
                departureDateTime: new Date(segment.schedule?.departureDateTime),
                arrivalDateTime: new Date(segment.schedule?.arrivalDateTime),
                price: segment.schedule?.price || 0,
                availableSeats: segment.schedule?.availableSeats || 0,
                date: segment.schedule?.departureDateTime,
              } as any,
              route: {
                id: segment.schedule?.route?.id || '',
                origin: normalizeText(segment.schedule?.route?.origin, 'Unknown'),
                destination: normalizeText(segment.schedule?.route?.destination, 'Unknown'),
                distance: segment.schedule?.route?.distance || estimateDistance(normalizeText(segment.schedule?.route?.origin), normalizeText(segment.schedule?.route?.destination)),
                duration: getEstimatedDuration(
                  normalizeText(segment.schedule?.route?.origin),
                  normalizeText(segment.schedule?.route?.destination),
                  segment.schedule?.route?.duration,
                  segment.schedule?.route?.distance
                ),
                stops: segment.schedule?.route?.stops || [],
              } as any,
            }))
          : [];

        const mainOrigin = normalizeText(b.schedule?.route?.origin, 'Unknown');
        const mainDestination = normalizeText(b.schedule?.route?.destination, 'Unknown');
        const mainDbDistance = b.schedule?.route?.distance || 0;
        const mainDbDuration = b.schedule?.route?.duration || 0;
        const resolvedDistance = mainDbDistance || estimateDistance(mainOrigin, mainDestination);
        const resolvedDuration = getEstimatedDuration(mainOrigin, mainDestination, mainDbDuration, mainDbDistance);

        return {
          id: b.id,
          bookingReference: b.bookingReference,
          userId: b.userId,
          scheduleId: b.scheduleId,
          companyId: b.schedule?.company?.id || b.companyId,
          numberOfSeats: Array.isArray(b.passengerDetails) ? b.passengerDetails.length : 0,
          totalAmount: b.totalAmount,
          bookingStatus: b.bookingStatus,
          paymentStatus: b.paymentStatus,
          createdAt: new Date(b.createdAt),
          updatedAt: new Date(b.updatedAt),
          seatNumbers: b.seatNumbers || [],
          passengerDetails: b.passengerDetails || [],
          originStopId: b.originStopId,
          destinationStopId: b.destinationStopId,
          originStopName: b.originStopName,
          destinationStopName: b.destinationStopName,
          reviewRating: b.reviewRating ?? null,
          reviewText: b.reviewText ?? null,
          schedule: {
            id: b.scheduleId,
            departureDateTime: new Date(b.schedule?.departureDateTime),
            arrivalDateTime: new Date(b.schedule?.arrivalDateTime),
            price: b.totalAmount && Array.isArray(b.passengerDetails) && b.passengerDetails.length > 0 ? Math.floor(b.totalAmount / b.passengerDetails.length) : 0,
            availableSeats: b.schedule?.availableSeats || 0,
            date: b.schedule?.departureDateTime,
          } as any,
          route: {
            id: b.schedule?.route?.id || '',
            origin: mainOrigin,
            destination: mainDestination,
            distance: resolvedDistance,
            duration: resolvedDuration,
            stops: b.schedule?.route?.stops || [],
          } as any,
          bus: {
            id: b.schedule?.bus?.id || '',
            busNumber: normalizeText(b.schedule?.bus?.licensePlate, 'N/A'),
            busType: normalizeText(b.schedule?.bus?.busType, 'N/A'),
            licensePlate: normalizeText(b.schedule?.bus?.licensePlate, 'N/A'),
          } as any,
          company: {
            id: b.schedule?.company?.id || '',
            name: normalizeText(b.schedule?.company?.name, 'Unknown'),
            logo: normalizeText(b.schedule?.company?.logo, ''),
            phone: normalizeText(b.schedule?.company?.phone, ''),
          } as any,
          operatorPhone: normalizeText(b.schedule?.operatorPhone, ''),
          segments: mappedSegments,
          returnSegment: mappedSegments.length > 1 ? mappedSegments[1] : undefined,
          returnDate: b.returnDate ? new Date(b.returnDate) : (typeof b.metadata?.returnDate === 'string' ? new Date(b.metadata.returnDate) : undefined),
        };
      });

      const valid = details.filter((b) => !isBookingExpired(b));
      setBookings(valid);
      setActiveFilter((current) => { applyFiltersLogic(valid, current, {}); return current; });
    } catch (err: unknown) {
      console.error('fetchBookings error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg ? `Failed to load bookings: ${msg}` : 'Failed to load bookings. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, isBookingExpired, applyFiltersLogic, bookings.length]);

  const handleCancelBooking = useCallback(async (bookingId: string, scheduleId: string, seatNumbers: string[]) => {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b) { setError('Booking not found'); return; }
    const dep = b.schedule.departureDateTime instanceof Date
      ? b.schedule.departureDateTime
      : new Date(b.schedule?.departureDateTime as unknown as string);
    if (dep < new Date()) { setError('Cannot cancel a past departure.'); return; }
    const isPaid = b.paymentStatus === 'paid';
    const twoHoursInMs = 2 * 60 * 60 * 1000;
    if (isPaid && dep.getTime() - Date.now() <= twoHoursInMs) {
      setError('Refund requests are only allowed up to 2 hours prior to departure.');
      return;
    }
    if (isPaid && !window.confirm('This booking has been paid for. Cancelling may affect your refund eligibility. Continue?')) return;
    setActionLoading(bookingId);
    setError('');
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) throw new Error('Failed to cancel booking');

      const notificationMessage = isPaid
        ? `Cancellation for booking ${bookingId.slice(-8)} is under review.`
        : `Your booking ${bookingId.slice(-8)} (${b.route.origin} → ${b.route.destination}) has been cancelled.`;

      sendNotification({
        userId: b.userId,
        type: isPaid ? 'cancellation_requested' : 'cancellation',
        title: isPaid ? 'Cancellation Requested' : 'Booking Cancelled',
        message: notificationMessage,
        data: { bookingId, url: '/bookings' },
      });

      setSuccess(isPaid ? 'Cancellation requested. An admin will review.' : 'Booking cancelled successfully.');
      toast.success(
        isPaid ? 'Cancellation Requested' : 'Booking Cancelled',
        isPaid ? 'An admin will review your cancellation request.' : `Booking ${bookingId.slice(-8)} has been cancelled.`
      );
      setTimeout(() => setSuccess(''), 5000);
      fetchBookings();
    } catch (err: unknown) {
      setError(`Failed to cancel: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
    }
  }, [bookings, fetchBookings, toast]);

  const handleDeleteBooking = useCallback(async (bookingId: string) => {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b || b.bookingStatus !== 'cancelled') { setError('Only cancelled bookings can be deleted.'); return; }
    if (!window.confirm('Permanently delete this cancelled booking?')) return;
    setActionLoading(bookingId);
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete booking');
      setSuccess('Booking deleted.');
      toast.info('Booking Removed', 'The cancelled booking has been deleted.');
      setTimeout(() => setSuccess(''), 5000);
      fetchBookings();
    }
    catch (err: unknown) { setError(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setActionLoading(null); }
  }, [bookings, fetchBookings, toast]);

  const handleDownloadTicket = useCallback(async (booking: BookingWithDetails, includeQR: boolean) => {
    setActionLoading(`download_${booking.id}`);
    try {
      const [{ default: PDF }] = await Promise.all([import('jspdf')]);
      
      const loadLogoDataUrl = async (logoUrl: string): Promise<{ dataUrl: string; width: number; height: number } | null> => {
        try {
          const response = await fetch(logoUrl, { mode: 'cors' });
          if (!response.ok) return null;
          const blob = await response.blob();
          const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = URL.createObjectURL(blob);
          });
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');
          if (!context) return null;
          context.drawImage(image, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(image.src);
          return { dataUrl, width: image.width, height: image.height };
        } catch {
          return null;
        }
      };

      const [companyLogo, platformLogo] = await Promise.all([
        booking.company.logo ? loadLogoDataUrl(booking.company.logo) : Promise.resolve(null),
        loadLogoDataUrl('/tibhukebus_logo_transparent.png')
      ]);

      const renderTicketSvgToPng = async (p: any, isReturn = false): Promise<string> => {
        const pnr = booking.bookingReference || booking.id.slice(-8).toUpperCase();
        const passengerName = p.name || 'Unknown Passenger';
        const seat = p.seatNumber || 'Unassigned';
        const operator = normalizeText(booking.company.name, 'Unknown Operator');
        const operatorPhone = normalizeText((booking as any).operatorPhone || (booking.company as any).phone, '');
        const busClass = normalizeText(booking.bus?.busType, 'Standard Class');
        
        const routeObj = isReturn && booking.returnSegment ? booking.returnSegment.route : booking.route;
        const schedObj = isReturn && booking.returnSegment ? booking.returnSegment.schedule : booking.schedule;
        const originId = isReturn && booking.returnSegment ? booking.returnSegment.originStopId : booking.originStopId;
        const destId = isReturn && booking.returnSegment ? booking.returnSegment.destinationStopId : booking.destinationStopId;
        
        const originName = normalizeText(routeObj.origin, 'Unknown Origin');
        const destName = normalizeText(routeObj.destination, 'Unknown Dest');
        const originStop = normalizeText(resolveStopName(originId, undefined, routeObj, routeObj.origin));
        const destStop = normalizeText(resolveStopName(destId, undefined, routeObj, routeObj.destination));
        
        const depTime = formatTime(schedObj.departureDateTime);
        const depDate = formatDate(schedObj.departureDateTime);
        const totalFare = booking.totalAmount?.toLocaleString() || '0';
        const isPaid = booking.paymentStatus === 'paid' || (booking as any).paymentMethod === 'cash_on_boarding';
        const paymentStatusText = isPaid ? 'CONFIRMED' : 'PENDING';
        // Brand colors for ticket design
        const ticketHeaderColor = '#005A5B'; // Deep Teal (Primary brand)
        const ticketHeaderTextColor = '#FFFFFF';
        const ticketAccentColor = '#E8604C'; // Coral (Secondary CTA / accent)
        const ticketAccentTextColor = '#FFFFFF';
        const ticketBackgroundColor = '#F8FAFC'; // gray-50
        const ticketCardColor = '#FFFFFF';
        const ticketContentTextColor = '#111827'; // gray-900 (Headings)
        const ticketSubtleTextColor = '#6B7280'; // gray-500 (Muted text)
        const ticketSurfaceColor = '#F3F4F6'; // gray-100
        const ticketBorderColor = '#D1D5DB'; // gray-300 (Borders)
        const successColor = '#059669'; // emerald-600 (Success/Positive states)
        const warningColor = '#D97706'; // amber-600 (Warning/Pending states)
        const paymentColor = isPaid ? successColor : warningColor;
        const paymentTextColor = '#FFFFFF';
        const paymentMethodName = (booking as any).paymentMethod === 'cash_on_boarding' ? 'Cash on Boarding' : booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1);
        const ticketTypeLabel = isReturn ? 'RETURN PASS' : 'BOARDING PASS';

        // Helper to encode HTML entities for SVG text
        const escapeXml = (unsafe: string) => unsafe.replace(/[<>&'"]/g, c => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case "'": return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });

        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="800" height="480">
  <rect width="800" height="480" fill="${ticketBackgroundColor}"/>
  
  <g transform="translate(40, 40)">
    <rect width="720" height="400" rx="16" fill="${ticketCardColor}" filter="drop-shadow(0px 10px 25px rgba(15, 23, 42, 0.08))" />
    <rect width="720" height="400" rx="16" fill="none" stroke="${ticketBorderColor}" stroke-width="1.5" />

    <path d="M 0 16 A 16 16 0 0 1 16 0 L 704 0 A 16 16 0 0 1 720 16 L 720 64 L 0 64 Z" fill="${ticketHeaderColor}" />
    
    <g transform="translate(24, 16)">
      ${platformLogo ? `<image x="0" y="-8" width="140" height="40" href="${platformLogo.dataUrl}" />` : `
      <path d="M 12 4 L 38 4 L 32 16 L 22 16 L 16 32 L 6 32 Z" fill="${ticketHeaderTextColor}" transform="skewX(-15) scale(0.9)"/>
      <path d="M -2 10 L 6 10 L 12 22 L 4 22 Z" fill="${ticketAccentColor}" transform="skewX(-15) scale(0.9)"/>
      <path d="M 2 2 L 10 2 L 16 14 L 8 14 Z" fill="${ticketAccentColor}" transform="skewX(-15) scale(0.9)"/>
      `}
      <text x="${platformLogo ? '150' : '44'}" y="24" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="22" fill="${ticketHeaderTextColor}" letter-spacing="-0.5">TibhukeBus</text>
      <text x="${platformLogo ? '151' : '45'}" y="38" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="11" fill="${ticketHeaderTextColor}">Official Digital ${ticketTypeLabel}</text>
    </g>

    <g transform="translate(580, 20)">
      <rect width="116" height="24" rx="12" fill="${paymentColor}" />
      <text x="58" y="16" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="${paymentTextColor}" text-anchor="middle" letter-spacing="1">${paymentStatusText}</text>
    </g>

    <path d="M 520 64 A 14 14 0 0 0 520 92 Z" fill="${ticketBackgroundColor}" stroke="${ticketBorderColor}" stroke-width="1.5" />
    <path d="M 520 372 A 14 14 0 0 1 520 400 Z" fill="${ticketBackgroundColor}" stroke="${ticketBorderColor}" stroke-width="1.5" />
    <line x1="520" y1="84" x2="520" y2="380" stroke="${ticketBorderColor}" stroke-dasharray="6,6" stroke-width="1.5" />

    <rect x="519.5" y="63" width="2" height="6" fill="${ticketBackgroundColor}"/>
    <rect x="519.5" y="395" width="2" height="6" fill="${ticketBackgroundColor}"/>

    <g transform="translate(32, 105)">
      <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="11" fill="${ticketSubtleTextColor}" letter-spacing="1">FROM</text>
      <text x="0" y="28" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="26" fill="${ticketContentTextColor}">${escapeXml(originName)}</text>
      <text x="0" y="46" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="12" fill="${ticketAccentColor}">${escapeXml(originStop)}</text>
    </g>

    <g transform="translate(215, 125)">
      <text x="45" y="-12" font-family="monospace, monospace" font-weight="700" font-size="12" fill="${ticketSubtleTextColor}" text-anchor="middle">${escapeXml(depTime)}</text>
      <circle cx="0" cy="0" r="4" fill="${ticketHeaderColor}" />
      <line x1="4" y1="0" x2="86" y2="0" stroke="${ticketBorderColor}" stroke-width="2" stroke-dasharray="4,2" />
      <circle cx="90" cy="0" r="4" fill="${ticketAccentColor}" />
      <text x="45" y="14" font-family="monospace, monospace" font-weight="600" font-size="10" fill="${ticketSubtleTextColor}" text-anchor="middle">${escapeXml(depDate)}</text>
    </g>

    <g transform="translate(325, 105)">
      <text x="160" y="0" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="11" fill="${ticketSubtleTextColor}" letter-spacing="1" text-anchor="end">TO</text>
      <text x="160" y="28" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="26" fill="${ticketContentTextColor}" text-anchor="end">${escapeXml(destName)}</text>
      <text x="160" y="46" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="12" fill="${ticketContentTextColor}" text-anchor="end">${escapeXml(destStop)}</text>
    </g>

    <line x1="32" y1="195" x2="488" y2="195" stroke="${ticketSurfaceColor}" stroke-width="1.5" />

    <g transform="translate(32, 220)">
      <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="${ticketSubtleTextColor}" font-weight="500">Passenger Name</text>
      <text x="0" y="20" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="${ticketContentTextColor}" font-weight="700">${escapeXml(passengerName)}</text>
    </g>
    <g transform="translate(260, 220)">
      <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="${ticketSubtleTextColor}" font-weight="500">Service Class</text>
      <text x="0" y="20" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="${ticketAccentColor}" font-weight="700">${escapeXml(busClass)}</text>
      ${operatorPhone ? `<text x="0" y="38" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="${ticketSubtleTextColor}" font-weight="500">Operator: ${escapeXml(operatorPhone)}</text>` : ''}
    </g>
    
    <g transform="translate(32, 285)">
      <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="${ticketSubtleTextColor}" font-weight="500">Seat Number</text>
      <rect x="0" y="8" width="95" height="24" rx="6" fill="${ticketSurfaceColor}" stroke="${ticketBorderColor}" stroke-width="1"/>
      <text x="47.5" y="24" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="${ticketContentTextColor}" font-weight="700" text-anchor="middle">${escapeXml(seat)}</text>
    </g>
    <g transform="translate(260, 285)">
      <text x="0" y="0" font-family="monospace, monospace" font-size="12" fill="${ticketSubtleTextColor}" font-weight="500">PNR Reference No.</text>
      <text x="0" y="24" font-family="monospace, monospace" font-size="16" fill="${ticketContentTextColor}" font-weight="700" letter-spacing="1">${escapeXml(pnr)}</text>
    </g>

    <g transform="translate(520, 64)">
      <rect x="0" y="0" width="200" height="284" fill="${ticketBackgroundColor}" />
      
      <!-- Company Logo / QR Placeholder -->
      <g transform="translate(35, 45)">
        <rect width="130" height="130" rx="10" fill="${ticketCardColor}" stroke="${ticketBorderColor}" stroke-width="1.5" filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.03))" />
        
        ${companyLogo ? `
        <!-- Display Operator Logo -->
        <image x="15" y="15" width="100" height="100" href="${companyLogo.dataUrl}" preserveAspectRatio="xMidYMid meet" />
        ` : `
        <!-- Generic valid mark (QR omitted for now) -->
        <g transform="translate(15, 15)" fill="${ticketContentTextColor}">
          <rect x="25" y="46" width="50" height="14" rx="3" fill="${ticketCardColor}" stroke="${ticketContentTextColor}" stroke-width="1.5"/>
          <text x="50" y="56" font-family="monospace, monospace" font-size="8" font-weight="900" fill="${ticketContentTextColor}" text-anchor="middle">VALID</text>
        </g>`}
      </g>

      <text x="100" y="196" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="13" fill="${ticketAccentColor}" text-anchor="middle">${escapeXml(operator)}</text>
      ${operatorPhone ? `<text x="100" y="212" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="10" fill="${ticketSubtleTextColor}" text-anchor="middle">${escapeXml(operatorPhone)}</text>` : ''}
      <text x="100" y="${operatorPhone ? '230' : '214'}" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="9" fill="${ticketSubtleTextColor}" text-anchor="middle">Digital Manifest Token</text>
      <text x="100" y="${operatorPhone ? '242' : '226'}" font-family="system-ui, -apple-system, sans-serif" font-weight="400" font-size="9" fill="${ticketSubtleTextColor}" text-anchor="middle">Present PNR at gate boarding</text>
    </g>


    <path d="M 0 348 L 720 348 L 720 384 A 16 16 0 0 1 704 400 L 16 400 A 16 16 0 0 1 0 384 Z" fill="${ticketSurfaceColor}" />
    <line x1="0" y1="348" x2="720" y2="348" stroke="${ticketBorderColor}" stroke-width="1" />

    <g transform="translate(24, 378)">
      <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="500" fill="${ticketSubtleTextColor}">Paid via: <tspan fill="${ticketContentTextColor}" font-weight="700">${escapeXml(paymentMethodName)}</tspan></text>
      <circle cx="120" cy="-4" r="2" fill="${ticketBorderColor}" />
      <text x="135" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="500" fill="${ticketSubtleTextColor}">Total Ticket Fare: <tspan fill="${ticketAccentColor}" font-weight="800" font-size="13">MWK ${escapeXml(totalFare)}</tspan></text>
    </g>

    <g transform="translate(696, 378)">
      <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="${ticketSubtleTextColor}" text-anchor="end">Support: +265 997 56 12 92  •  support@tibhukebus.com</text>
    </g>

  </g>
</svg>`;
        
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        
        return new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            // Render at 2x resolution for better PDF quality, then scale down in jsPDF
            canvas.width = 1600;
            canvas.height = 960;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas context failed'));
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0, 800, 480);
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            URL.revokeObjectURL(svgUrl);
            resolve(dataUrl);
          };
          img.onerror = () => reject(new Error('SVG render failed'));
          img.src = svgUrl;
        });
      };

      const pdf = new PDF({ orientation: 'landscape', unit: 'px', format: [800, 480] });
      let pageCount = 0;

      for (const p of booking.passengerDetails) {
        if (pageCount > 0) pdf.addPage([800, 480], 'landscape');
        const pngData = await renderTicketSvgToPng(p, false);
        pdf.addImage(pngData, 'PNG', 0, 0, 800, 480);
        pageCount++;
      }

      if (booking.returnSegment && booking.returnSegment.seatNumbers) {
        // Render return tickets
        const numReturnSeats = booking.returnSegment.seatNumbers.length;
        for (let i = 0; i < booking.passengerDetails.length; i++) {
          const p = booking.passengerDetails[i];
          const returnSeat = i < numReturnSeats ? booking.returnSegment.seatNumbers[i] : 'Unassigned';
          if (pageCount > 0) pdf.addPage([800, 480], 'landscape');
          const pngData = await renderTicketSvgToPng({ ...p, seatNumber: returnSeat }, true);
          pdf.addImage(pngData, 'PNG', 0, 0, 800, 480);
          pageCount++;
        }
      }

      pdf.save(`ticket_${booking.bookingReference || booking.id.slice(-8)}.pdf`);
      setSuccess('Ticket downloaded!');
      toast.success('Ticket Downloaded', 'Your digital boarding pass has been saved as a PDF.');
    } catch (e) {
      console.error(e);
      setError('Failed to generate PDF.');
    }
    finally { setActionLoading(null); }
  }, [formatDate, formatTime, toast]);

  const handleProcessPayment = useCallback((booking: BookingWithDetails) => {
    if (!booking.seatNumbers?.length || !booking.passengerDetails?.length) { setError('Invalid booking data.'); return; }
    setSelectedBooking(booking);
    const pp = booking.passengerDetails[0];
    setUserDetails({ name: pp.name || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim(), email: userProfile?.email || '', phone: userProfile?.phone || '+265' });
    setMethodModalOpen(true);
  }, [userProfile]);

  const handleMethodSelect = useCallback((provider: string, subId: string, label: string) => {
    setSelectedProvider(provider); setSelectedSubId(subId); setSelectedLabel(label);
    setMethodModalOpen(false); setConfirmModalOpen(true);
  }, []);

  const handleConfirmAndPay = useCallback(async (e: any, extra?: { transactionId?: string }) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!selectedBooking || !selectedProvider) { setError('Missing booking or payment method'); return; }
    const isCash = selectedProvider === 'cash';
    if (!isCash) {
      if (userDetails.name.trim().length < 2) { setError('Please provide a valid full name'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userDetails.email)) { setError('Please provide a valid email'); return; }
      if (!/^\+?\d{10,15}$/.test(userDetails.phone.replace(/\s/g, ''))) { setError('Please provide a valid phone number'); return; }
    }
    setActionLoading(selectedBooking.id); setError('');
    try {
      if (isCash) {
        const response = await fetch(`/api/bookings/${selectedBooking.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMethod: 'cash_on_boarding', paymentStatus: 'pending', paymentProvider: 'cash' }),
        });
        if (!response.ok) throw new Error('Failed to confirm cash booking');
        await sendNotification({ userId: user!.id, type: 'booking', title: 'Booking Reserved (Cash)', message: `Your booking for ${selectedBooking.route.origin} → ${selectedBooking.route.destination} is reserved. Please pay MWK ${selectedBooking.totalAmount.toLocaleString()} when you board.`, actionUrl: '/bookings', priority: 'high' });
        setConfirmModalOpen(false); setSuccess('Booking confirmed — please pay the conductor when you board.');
        toast.success('Booking Reserved', `Have MWK ${selectedBooking.totalAmount.toLocaleString()} ready when you board.`);
        setTimeout(() => setSuccess(''), 6000); fetchBookings(); return;
      }

      const res = await fetch('/api/payments/paychangu/charge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: selectedBooking.id, paymentProvider: selectedProvider, customerDetails: { email: userDetails.email.toLowerCase().trim(), name: userDetails.name.trim(), phone: userDetails.phone.trim() }, metadata: { route: `${selectedBooking.route.origin}-${selectedBooking.route.destination}`, departure: selectedBooking.schedule.departureDateTime instanceof Date ? selectedBooking.schedule.departureDateTime.toISOString() : new Date(selectedBooking.schedule.departureDateTime as unknown as string).toISOString(), passengerCount: String(selectedBooking.passengerDetails.length), seatNumbers: selectedBooking.seatNumbers.join(','), subMethod: selectedSubId } }),
      });
      const result = await res.json(); if (!res.ok) throw new Error(result.error || result.message || 'Payment session failed');
      if (result.success && result.checkoutUrl) {
        setConfirmModalOpen(false);
        setSuccess('Redirecting to PayChangu…');
        toast.loading('Redirecting', 'Taking you to PayChangu for secure payment…');
        setTimeout(() => { window.location.href = result.checkoutUrl; }, 1200);
      } else throw new Error(result.error || 'Invalid server response');
    } catch (err: unknown) { setError(`Payment failed: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setActionLoading(null); }
  }, [selectedBooking, selectedProvider, selectedSubId, userDetails, user, fetchBookings, toast]);

  const verifyPaymentStatus = useCallback(async (provider: string, txRef: string, transactionId?: string) => {
    setActionLoading(`verify_${txRef}`);
    try {
      let res: Response;
      if (provider === 'paychangu') {
        const params = new URLSearchParams({ provider, tx_ref: txRef, json: 'true' });
        res = await fetch(`/api/payments/paychangu/verify?${params}`);
      } else { setError('Unknown payment provider'); return; }

      const result = await res.json(); if (!res.ok) throw new Error(result.error || 'Verification failed');
      if (result.success && result.status === 'paid') {
        setSuccess('Payment verified! Your booking is confirmed.');
        await sendNotification({ userId: user!.id, type: 'payment', title: 'Payment Confirmed! ✅', message: `We've successfully verified your payment for the booking to ${txRef.slice(-8)}. Happy traveling!`, actionUrl: '/bookings', priority: 'high' });
        fetchBookings();
      } else { setError(`Payment status: ${result.status || 'unknown'}. Please contact support if you were charged.`); }
    } catch (err: unknown) { setError(`Verification failed: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setActionLoading(null); }
  }, [fetchBookings, user]);

  useEffect(() => {
    if (!ctxNotifications) return;
    const newNotifications = ctxNotifications.filter((n) => !lastNotificationIdsRef.current.has(n.id));
    lastNotificationIdsRef.current = new Set(ctxNotifications.map((n) => n.id));
    if (newNotifications.length === 0) return;
    const relevantTypes = new Set([ 'booking', 'payment', 'trip_update', 'cancellation', 'cancellation_requested' ]);
    const relevant = newNotifications.some((n) => relevantTypes.has(n.type as string));
    if (relevant) fetchBookings();
  }, [ctxNotifications, fetchBookings]);

  const bookingStats = useMemo(() => {
    const now = new Date();
    return {
      all: bookings.length,
      confirmed: bookings.filter((b) => b.bookingStatus === 'confirmed' && (b.paymentStatus === 'paid' || (b as any).paymentMethod === 'cash_on_boarding')).length,
      pending: bookings.filter((b) => b.bookingStatus === 'pending' || (b.bookingStatus === 'confirmed' && b.paymentStatus === 'pending' && (b as any).paymentMethod !== 'cash_on_boarding')).length,
      cancelled: bookings.filter((b) => b.bookingStatus === 'cancelled').length,
      upcoming: bookings.filter((b) => {
        const d = b.schedule?.departureDateTime instanceof Date ? b.schedule.departureDateTime : new Date(b.schedule?.departureDateTime as unknown as string);
        return d > now && b.bookingStatus === 'confirmed' && (b.paymentStatus === 'paid' || (b as any).paymentMethod === 'cash_on_boarding');
      }).length,
    };
  }, [bookings]);

  const paginatedBookings = useMemo(() => filteredBookings.slice((currentPage - 1) * bookingsPerPage, currentPage * bookingsPerPage), [filteredBookings, currentPage]);
  const totalPages = useMemo(() => Math.ceil(filteredBookings.length / bookingsPerPage), [filteredBookings.length]);

  const handleFilterChange = useCallback((e: any) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      const next = { ...prev } as any;
      if (name === 'priceRangeMin' || name === 'priceRangeMax') next.priceRange = { ...(next.priceRange as object), [name === 'priceRangeMin' ? 'min' : 'max']: value ? Number(value) : undefined };
      else next[name] = value || undefined;
      return next;
    });
  }, []);

  const handleStatusFilter = useCallback((s: string) => { setActiveFilter(s); applyFiltersLogic(bookings, s, filters); }, [bookings, filters, applyFiltersLogic]);

  // Expose everything the UI needs
  return {
    bookings,
    filteredBookings,
    paginatedBookings,
    bookingStats,
    loading,
    actionLoading,
    error,
    success,
    filters,
    activeFilter,
    showFilters,
    toastNotifications,
    currentPage,
    totalPages,
    bookingsPerPage,
    methodModalOpen,
    confirmModalOpen,
    selectedBooking,
    selectedProvider,
    selectedSubId,
    selectedLabel,
    userDetails,
    formatTime,
    formatDate,
    getStatusColor,
    getPaymentStatusColor,
    fetchBookings,
    handleCancelBooking,
    handleDeleteBooking,
    handleDownloadTicket,
    handleProcessPayment,
    handleMethodSelect,
    handleConfirmAndPay,
    verifyPaymentStatus,
    handleFilterChange,
    handleStatusFilter,
    setFilters,
    setActiveFilter,
    setShowFilters,
    setCurrentPage,
    setMethodModalOpen,
    setConfirmModalOpen,
    setSelectedBooking,
    setUserDetails,
    setToastNotifications,
    setSuccess,
    setError,
  } as const;
};

export default useBookingsList;
