// Firestore utility functions for the bus booking platform
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  writeBatch,
  collectionGroup,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { 
  UserProfile,
  Company,
  Bus, 
  Route, 
  Schedule, 
  Booking, 
  SearchQuery,
  SearchResult 
} from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely converts any Firestore timestamp / Date / string / number to a Date. */
const toDate = (v: unknown): Date => {
  if (v == null) return new Date(0);
  if (v instanceof Date) return v;
  const a = v as any;
  if (typeof a.toDate === 'function') return a.toDate() as Date;
  if (typeof a === 'string' || typeof a === 'number') return new Date(a);
  return new Date(0);
};

/** Converts any date-like value to a Firestore Timestamp safely. */
const toTimestamp = (v: unknown): Timestamp => Timestamp.fromDate(toDate(v));

/** Converts an optional date-like value — returns null if absent. */
const toTimestampOrNull = (v: unknown): Timestamp | null =>
  v == null ? null : toTimestamp(v);

// Keep the old name around for internal callers that still use it
const timestampToDate = toDate;

// ─── UserProfile operations ───────────────────────────────────────────────────

export const createUserProfile = async (
  userId: string,
  userData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'lastLogin'>
) => {
  const userRef = doc(db, 'users', userId);
  const now = Timestamp.now();
  await updateDoc(userRef, {
    ...userData,
    createdAt: now,
    updatedAt: now,
    lastLogin: now,
  });
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const userRef  = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data() as any;
    return {
      id: userSnap.id,
      ...data,
      createdAt:       toDate(data.createdAt),
      updatedAt:       toDate(data.updatedAt),
      dateOfBirth:     data.dateOfBirth     ? toDate(data.dateOfBirth)     : undefined,
      lastLogin:       data.lastLogin       ? toDate(data.lastLogin)       : undefined,
      resetTokenExpiry: data.resetTokenExpiry ? toDate(data.resetTokenExpiry) : undefined,
    } as UserProfile;
  }
  return null;
};

// ─── Company operations ───────────────────────────────────────────────────────

export const getCompanies = async (): Promise<Company[]> => {
  const snapshot = await getDocs(collection(db, 'companies'));
  return snapshot.docs.map(d => {
    const data = d.data() as any;
    return { id: d.id, ...data, createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt) } as Company;
  });
};

export const getCompany = async (companyId: string): Promise<Company | null> => {
  const snap = await getDoc(doc(db, 'companies', companyId));
  if (snap.exists()) {
    const data = snap.data() as any;
    return { id: snap.id, ...data, createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt) } as Company;
  }
  return null;
};

// ─── Route operations ─────────────────────────────────────────────────────────

export const getRoutes = async (companyId: string): Promise<Route[]> => {
  const snapshot = await getDocs(collection(db, 'companies', companyId, 'routes'));
  return snapshot.docs.map(d => {
    const data = d.data() as any;
    return { id: d.id, ...data, createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt) } as Route;
  });
};

// ─── Schedule operations ──────────────────────────────────────────────────────

export const getSchedules = async (companyId: string, routeId: string): Promise<Schedule[]> => {
  const q        = query(
    collection(db, 'companies', companyId, 'routes', routeId, 'schedules'),
    where('status', '==', 'active'),
    orderBy('departureDateTime'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => {
    const data = d.data() as any;
    return {
      id: d.id,
      ...data,
      departureDateTime: toDate(data.departureDateTime),
      arrivalDateTime:   toDate(data.arrivalTime),
      createdAt:         toDate(data.createdAt),
      updatedAt:         toDate(data.updatedAt),
    } as Schedule;
  });
};

// ─── Bus operations ───────────────────────────────────────────────────────────

export const getBus = async (companyId: string, busId: string): Promise<Bus | null> => {
  const snap = await getDoc(doc(db, 'companies', companyId, 'buses', busId));
  if (snap.exists()) {
    const data = snap.data() as any;
    return {
      id: snap.id,
      ...data,
      registrationDetails: {
        ...data.registrationDetails,
        registrationDate: toDate(data.registrationDetails?.registrationDate),
        expiryDate:       toDate(data.registrationDetails?.expiryDate),
      },
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    } as Bus;
  }
  return null;
};

// ─── Search ───────────────────────────────────────────────────────────────────
//
// FIX F-09: Replaced the O(n³) nested loop (getCompanies → getRoutes → getSchedules)
// with a single Firestore query on a flat top-level `schedules` collection.
//
// REQUIRED SCHEMA CHANGE:
//   Each schedule document in /schedules must include these denormalized fields:
//     origin, destination, companyId, routeId, busId,
//     status, availableSeats, departureDateTime
//
// REQUIRED FIRESTORE INDEX:
//   Collection: schedules
//   Fields: origin ASC, destination ASC, departureDateTime ASC, status ASC, availableSeats ASC

export const searchBuses = async (searchQuery: SearchQuery): Promise<SearchResult[]> => {
  try {
    const searchDate = new Date(searchQuery.date);
    const startOfDay = new Date(searchDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay   = new Date(searchDate); endOfDay.setHours(23, 59, 59, 999);
    const passengers = searchQuery.passengers || 1;

    const q = query(
      collection(db, 'schedules'),
      where('origin',            '==', searchQuery.origin.trim()),
      where('destination',       '==', searchQuery.destination.trim()),
      where('status',            '==', 'active'),
      where('departureDateTime', '>=', Timestamp.fromDate(startOfDay)),
      where('departureDateTime', '<=', Timestamp.fromDate(endOfDay)),
      where('availableSeats',    '>=', passengers),
      orderBy('departureDateTime', 'asc'),
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return [];

    const companyIds = [...new Set(snapshot.docs.map(d => d.data().companyId as string))];
    const busEntries = [
      ...new Map(
        snapshot.docs.map(d => {
          const data = d.data();
          return [`${data.companyId}::${data.busId}`, { companyId: data.companyId as string, busId: data.busId as string }];
        })
      ).values(),
    ];

    const [companies, buses] = await Promise.all([
      Promise.all(companyIds.map(id => getCompany(id))),
      Promise.all(busEntries.map(({ companyId, busId }) => getBus(companyId, busId))),
    ]);

    const companyMap = new Map(companies.filter(Boolean).map(c => [c!.id, c!]));
    const busMap     = new Map(busEntries.map(({ companyId, busId }, i) => [`${companyId}::${busId}`, buses[i]]));

    const results: SearchResult[] = [];

    for (const docSnap of snapshot.docs) {
      const data     = docSnap.data() as any;
      const schedule: Schedule = {
        id: docSnap.id,
        ...data,
        departureDateTime: toDate(data.departureDateTime),
        arrivalDateTime:   data.arrivalDateTime ? toDate(data.arrivalDateTime) : undefined,
        createdAt:         toDate(data.createdAt),
        updatedAt:         toDate(data.updatedAt),
      };

      const company = companyMap.get(data.companyId);
      const bus     = busMap.get(`${data.companyId}::${data.busId}`);

      const routeSnap = await getDoc(doc(db, 'companies', data.companyId, 'routes', data.routeId));
      const routeData = routeSnap.data() as any;
      const route: Route | null = routeData
        ? { id: routeSnap.id, ...routeData, createdAt: toDate(routeData.createdAt), updatedAt: toDate(routeData.updatedAt) }
        : null;

      if (company && bus && route) {
        results.push({ schedule, route, bus, company });
      }
    }

    return results;
  } catch (error) {
    console.error('Error searching buses:', error);
    return [];
  }
};

// ─── Booking operations ───────────────────────────────────────────────────────

export const createBooking = async (
  bookingData: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const bookingsRef = collection(db, 'bookings');
  const now         = Timestamp.now();

  const docRef = await addDoc(bookingsRef, {
    ...bookingData,
    // ✅ All Timestamp.fromDate() calls now go through toDate() first,
    //    so FirestoreTimestamp | null input is always converted safely.
    bookingDate:        toTimestamp(bookingData.bookingDate),
    cancellationDate:   toTimestampOrNull(bookingData.cancellationDate),
    refundDate:         toTimestampOrNull(bookingData.refundDate),
    paymentInitiatedAt: toTimestampOrNull(bookingData.paymentInitiatedAt),
    paymentCompletedAt: toTimestampOrNull(bookingData.paymentCompletedAt),
    confirmedDate:      toTimestampOrNull(bookingData.confirmedDate),
    createdAt:          now,
    updatedAt:          now,
  });

  return docRef.id;
};

export const getBooking = async (bookingId: string): Promise<Booking | null> => {
  const snap = await getDoc(doc(db, 'bookings', bookingId));
  if (snap.exists()) {
    const data = snap.data() as any;
    return {
      id: snap.id,
      ...data,
      bookingDate:        toDate(data.bookingDate),
      cancellationDate:   data.cancellationDate   ? toDate(data.cancellationDate)   : undefined,
      refundDate:         data.refundDate         ? toDate(data.refundDate)         : undefined,
      paymentInitiatedAt: data.paymentInitiatedAt ? toDate(data.paymentInitiatedAt) : undefined,
      paymentCompletedAt: data.paymentCompletedAt ? toDate(data.paymentCompletedAt) : undefined,
      confirmedDate:      data.confirmedDate      ? toDate(data.confirmedDate)      : undefined,
      createdAt:          toDate(data.createdAt),
      updatedAt:          toDate(data.updatedAt),
    } as Booking;
  }
  return null;
};

export const getUserBookings = async (userId: string): Promise<Booking[]> => {
  const q        = query(collection(db, 'bookings'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => {
    const data = d.data() as any;
    return {
      id: d.id,
      ...data,
      bookingDate:        toDate(data.bookingDate),
      cancellationDate:   data.cancellationDate   ? toDate(data.cancellationDate)   : undefined,
      refundDate:         data.refundDate         ? toDate(data.refundDate)         : undefined,
      paymentInitiatedAt: data.paymentInitiatedAt ? toDate(data.paymentInitiatedAt) : undefined,
      paymentCompletedAt: data.paymentCompletedAt ? toDate(data.paymentCompletedAt) : undefined,
      confirmedDate:      data.confirmedDate      ? toDate(data.confirmedDate)      : undefined,
      createdAt:          toDate(data.createdAt),
      updatedAt:          toDate(data.updatedAt),
    } as Booking;
  });
};

export const getCompanyBookings = async (companyId: string): Promise<Booking[]> => {
  const q        = query(collection(db, 'bookings'), where('companyId', '==', companyId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => {
    const data = d.data() as any;
    return {
      id: d.id,
      ...data,
      bookingDate:        toDate(data.bookingDate),
      cancellationDate:   data.cancellationDate   ? toDate(data.cancellationDate)   : undefined,
      refundDate:         data.refundDate         ? toDate(data.refundDate)         : undefined,
      paymentInitiatedAt: data.paymentInitiatedAt ? toDate(data.paymentInitiatedAt) : undefined,
      paymentCompletedAt: data.paymentCompletedAt ? toDate(data.paymentCompletedAt) : undefined,
      confirmedDate:      data.confirmedDate      ? toDate(data.confirmedDate)      : undefined,
      createdAt:          toDate(data.createdAt),
      updatedAt:          toDate(data.updatedAt),
    } as Booking;
  });
};

export const updateBookingStatus = async (
  bookingId: string,
  status: Booking['bookingStatus'],
  confirmedDate?: Date,
) => {
  const updateData: any = { bookingStatus: status, updatedAt: Timestamp.now() };

  if (status === 'confirmed' && confirmedDate) {
    updateData.confirmedDate = Timestamp.fromDate(confirmedDate);
  } else if (status === 'cancelled') {
    updateData.cancellationDate = Timestamp.now();
  }

  await updateDoc(doc(db, 'bookings', bookingId), updateData);
};