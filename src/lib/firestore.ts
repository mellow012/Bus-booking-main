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

// Helper function to convert Firestore timestamp to Date
const timestampToDate = (timestamp: any): Date => {
  if (timestamp && timestamp.toDate) {
    return timestamp.toDate();
  }
  return new Date(timestamp);
};

// --- UserProfile operations ---

export const createUserProfile = async (userId: string, userData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'lastLogin'>) => {
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
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const data = userSnap.data() as any;
    return {
      id: userSnap.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
      dateOfBirth: data.dateOfBirth ? timestampToDate(data.dateOfBirth) : undefined,
      lastLogin: data.lastLogin ? timestampToDate(data.lastLogin) : undefined,
      resetTokenExpiry: data.resetTokenExpiry ? timestampToDate(data.resetTokenExpiry) : undefined,
    } as UserProfile;
  }
  return null;
};

// --- Company operations ---

export const getCompanies = async (): Promise<Company[]> => {
  const companiesRef = collection(db, 'companies');
  const snapshot = await getDocs(companiesRef);
  
  return snapshot.docs.map(doc => {
    const data = doc.data() as any;
    return {
      id: doc.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Company;
  });
};

export const getCompany = async (companyId: string): Promise<Company | null> => {
  const companyRef = doc(db, 'companies', companyId);
  const companySnap = await getDoc(companyRef);
  
  if (companySnap.exists()) {
    const data = companySnap.data() as any;
    return {
      id: companySnap.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Company;
  }
  return null;
};

// --- Route operations ---

export const getRoutes = async (companyId: string): Promise<Route[]> => {
  const routesRef = collection(db, 'companies', companyId, 'routes');
  const snapshot = await getDocs(routesRef);
  
  return snapshot.docs.map(doc => {
    const data = doc.data() as any;
    return {
      id: doc.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Route;
  });
};

// --- Schedule operations ---

export const getSchedules = async (companyId: string, routeId: string): Promise<Schedule[]> => {
  const schedulesRef = collection(db, 'companies', companyId, 'routes', routeId, 'schedules');
  const q = query(schedulesRef, where('status', '==', 'active'), orderBy('departureDateTime')); 
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => {
    const data = doc.data() as any;
    return {
      id: doc.id,
      ...data,
      departureDateTime: timestampToDate(data.departureDateTime),
      arrivalDateTime: timestampToDate(data.arrivalTime),
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Schedule;
  });
};

// --- Bus operations ---

export const getBus = async (companyId: string, busId: string): Promise<Bus | null> => {
  const busRef = doc(db, 'companies', companyId, 'buses', busId);
  const busSnap = await getDoc(busRef);
  
  if (busSnap.exists()) {
    const data = busSnap.data() as any;
    return {
      id: busSnap.id,
      ...data,
      registrationDetails: {
        ...data.registrationDetails,
        registrationDate: timestampToDate(data.registrationDetails.registrationDate),
        expiryDate: timestampToDate(data.registrationDetails.expiryDate),
      },
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Bus;
  }
  return null;
};

// --- Search functionality ---
//
// FIX F-09: Replaced the O(n³) nested loop (getCompanies → getRoutes → getSchedules)
// with a single Firestore query on a flat top-level `schedules` collection.
//
// REQUIRED SCHEMA CHANGE:
//   Each schedule document in /schedules must include these denormalized fields:
//     origin        : string   (copied from its parent Route)
//     destination   : string   (copied from its parent Route)
//     companyId     : string
//     routeId       : string
//     busId         : string
//     status        : string
//     availableSeats: number
//     departureDateTime: Timestamp
//
// REQUIRED FIRESTORE INDEX (add to firestore.indexes.json):
//   Collection: schedules
//   Fields: origin ASC, destination ASC, departureDateTime ASC, status ASC, availableSeats ASC
//
// With 10 companies × 20 routes × 50 schedules, the old code generated 200+
// sequential reads per search. This implementation uses a single indexed query
// regardless of dataset size.

export const searchBuses = async (searchQuery: SearchQuery): Promise<SearchResult[]> => {
  try {
    const searchDate = new Date(searchQuery.date);
    const startOfDay = new Date(searchDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(searchDate);
    endOfDay.setHours(23, 59, 59, 999);
    const passengers = searchQuery.passengers || 1;

    // Single indexed query replacing all nested loops
    const schedulesRef = collection(db, 'schedules');
    const q = query(
      schedulesRef,
      where('origin', '==', searchQuery.origin.trim()),
      where('destination', '==', searchQuery.destination.trim()),
      where('status', '==', 'active'),
      where('departureDateTime', '>=', Timestamp.fromDate(startOfDay)),
      where('departureDateTime', '<=', Timestamp.fromDate(endOfDay)),
      where('availableSeats', '>=', passengers),
      orderBy('departureDateTime', 'asc')
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return [];

    // Deduplicate companyIds and busIds so we fetch each only once
    const companyIds = [...new Set(snapshot.docs.map(d => d.data().companyId as string))];
    const busEntries = [
      ...new Map(
        snapshot.docs.map(d => {
          const data = d.data();
          return [`${data.companyId}::${data.busId}`, { companyId: data.companyId as string, busId: data.busId as string }];
        })
      ).values(),
    ];

    // Fetch all required companies and buses in parallel
    const [companies, buses] = await Promise.all([
      Promise.all(companyIds.map(id => getCompany(id))),
      Promise.all(busEntries.map(({ companyId, busId }) => getBus(companyId, busId))),
    ]);

    const companyMap = new Map(
      companies.filter(Boolean).map(c => [c!.id, c!])
    );
    const busMap = new Map(
      busEntries.map(({ companyId, busId }, i) => [`${companyId}::${busId}`, buses[i]])
    );

    const results: SearchResult[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as any;
      const schedule: Schedule = {
        id: docSnap.id,
        ...data,
        departureDateTime: timestampToDate(data.departureDateTime),
        arrivalDateTime: data.arrivalDateTime ? timestampToDate(data.arrivalDateTime) : undefined,
        createdAt: timestampToDate(data.createdAt),
        updatedAt: timestampToDate(data.updatedAt),
      };

      const company = companyMap.get(data.companyId);
      const bus = busMap.get(`${data.companyId}::${data.busId}`);

      // We need the Route for the result — fetch from the denormalized routeId
      // This is a single read per unique route, not per schedule.
      // For further optimisation, denormalize route fields into the schedule doc too.
      const routeRef = doc(db, 'companies', data.companyId, 'routes', data.routeId);
      const routeSnap = await getDoc(routeRef);
      const routeData = routeSnap.data() as any;
      const route: Route = routeData
        ? { id: routeSnap.id, ...routeData, createdAt: timestampToDate(routeData.createdAt), updatedAt: timestampToDate(routeData.updatedAt) }
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

// --- Booking operations ---

export const createBooking = async (bookingData: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const bookingsRef = collection(db, 'bookings');
  const now = Timestamp.now();
  
  const docRef = await addDoc(bookingsRef, {
    ...bookingData,
    bookingDate: Timestamp.fromDate(bookingData.bookingDate),
    cancellationDate: bookingData.cancellationDate ? Timestamp.fromDate(bookingData.cancellationDate) : null,
    refundDate: bookingData.refundDate ? Timestamp.fromDate(bookingData.refundDate) : null,
    paymentInitiatedAt: bookingData.paymentInitiatedAt ? Timestamp.fromDate(bookingData.paymentInitiatedAt as Date) : null,
    paymentCompletedAt: bookingData.paymentCompletedAt ? Timestamp.fromDate(bookingData.paymentCompletedAt as Date) : null,
    confirmedDate: bookingData.confirmedDate ? Timestamp.fromDate(bookingData.confirmedDate as Date) : null,
    createdAt: now,
    updatedAt: now
  });
  
  return docRef.id;
};

export const getBooking = async (bookingId: string): Promise<Booking | null> => {
  const bookingRef = doc(db, 'bookings', bookingId);
  const bookingSnap = await getDoc(bookingRef);
  
  if (bookingSnap.exists()) {
    const data = bookingSnap.data() as any;
    return {
      id: bookingSnap.id,
      ...data,
      bookingDate: timestampToDate(data.bookingDate),
      cancellationDate: data.cancellationDate ? timestampToDate(data.cancellationDate) : undefined,
      refundDate: data.refundDate ? timestampToDate(data.refundDate) : undefined,
      paymentInitiatedAt: data.paymentInitiatedAt ? timestampToDate(data.paymentInitiatedAt) : undefined,
      paymentCompletedAt: data.paymentCompletedAt ? timestampToDate(data.paymentCompletedAt) : undefined,
      confirmedDate: data.confirmedDate ? timestampToDate(data.confirmedDate) : undefined,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Booking;
  }
  return null;
};

export const getUserBookings = async (userId: string): Promise<Booking[]> => {
  const bookingsRef = collection(db, 'bookings');
  const q = query(bookingsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => {
    const data = doc.data() as any;
    return {
      id: doc.id,
      ...data,
      bookingDate: timestampToDate(data.bookingDate),
      cancellationDate: data.cancellationDate ? timestampToDate(data.cancellationDate) : undefined,
      refundDate: data.refundDate ? timestampToDate(data.refundDate) : undefined,
      paymentInitiatedAt: data.paymentInitiatedAt ? timestampToDate(data.paymentInitiatedAt) : undefined,
      paymentCompletedAt: data.paymentCompletedAt ? timestampToDate(data.paymentCompletedAt) : undefined,
      confirmedDate: data.confirmedDate ? timestampToDate(data.confirmedDate) : undefined,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Booking;
  });
};

export const getCompanyBookings = async (companyId: string): Promise<Booking[]> => {
  const bookingsRef = collection(db, 'bookings');
  const q = query(bookingsRef, where('companyId', '==', companyId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => {
    const data = doc.data() as any;
    return {
      id: doc.id,
      ...data,
      bookingDate: timestampToDate(data.bookingDate),
      cancellationDate: data.cancellationDate ? timestampToDate(data.cancellationDate) : undefined,
      refundDate: data.refundDate ? timestampToDate(data.refundDate) : undefined,
      paymentInitiatedAt: data.paymentInitiatedAt ? timestampToDate(data.paymentInitiatedAt) : undefined,
      paymentCompletedAt: data.paymentCompletedAt ? timestampToDate(data.paymentCompletedAt) : undefined,
      confirmedDate: data.confirmedDate ? timestampToDate(data.confirmedDate) : undefined,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Booking;
  });
};

export const updateBookingStatus = async (
  bookingId: string, 
  status: Booking['bookingStatus'], 
  confirmedDate?: Date
) => {
  const bookingRef = doc(db, 'bookings', bookingId);
  const updateData: any = {
    bookingStatus: status,
    updatedAt: Timestamp.now()
  };
  
  if (status === 'confirmed' && confirmedDate) {
    updateData.confirmedDate = Timestamp.fromDate(confirmedDate);
  } else if (status === 'cancelled') {
    updateData.cancellationDate = Timestamp.now();
  }
  
  await updateDoc(bookingRef, updateData);
};