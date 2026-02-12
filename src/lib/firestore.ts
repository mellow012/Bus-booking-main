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
  UserProfile, // Replaced User
  Company,     // Replaced Operator
  Bus, 
  Route, 
  Schedule, 
  Booking, 
  SearchQuery, // Replaced SearchParams
  SearchResult 
} from '@/types'; // Assuming your new types are available at '@/types'

// Helper function to convert Firestore timestamp to Date
const timestampToDate = (timestamp: any): Date => {
  if (timestamp && timestamp.toDate) {
    return timestamp.toDate();
  }
  // Fallback for non-Timestamp objects if needed, otherwise throws error if structure is wrong
  return new Date(timestamp);
};

// --- UserProfile operations (formerly User) ---

export const createUserProfile = async (userId: string, userData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'lastLogin'>) => {
  const userRef = doc(db, 'users', userId);
  const now = Timestamp.now();
  // Note: We exclude 'lastLogin' from the Omit as it's typically set on login, not creation
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
    const data = userSnap.data() as any; // Cast to 'any' to allow spreading unknown properties
    return {
      id: userSnap.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
      dateOfBirth: data.dateOfBirth ? timestampToDate(data.dateOfBirth) : undefined,
      lastLogin: data.lastLogin ? timestampToDate(data.lastLogin) : undefined,
      resetTokenExpiry: data.resetTokenExpiry ? timestampToDate(data.resetTokenExpiry) : undefined,
    } as UserProfile; // Final cast to UserProfile
  }
  return null;
};

// --- Company operations (formerly Operator) ---

export const getCompanies = async (): Promise<Company[]> => {
  const companiesRef = collection(db, 'companies'); // Updated collection name
  const snapshot = await getDocs(companiesRef);
  
  return snapshot.docs.map(doc => {
    const data = doc.data() as any; // Cast to 'any'
    return {
      id: doc.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Company; // Final cast to Company
  });
};

export const getCompany = async (companyId: string): Promise<Company | null> => {
  const companyRef = doc(db, 'companies', companyId); // Updated collection name
  const companySnap = await getDoc(companyRef);
  
  if (companySnap.exists()) {
    const data = companySnap.data() as any; // Cast to 'any'
    return {
      id: companySnap.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Company; // Final cast to Company
  }
  return null;
};

// --- Route operations ---

export const getRoutes = async (companyId: string): Promise<Route[]> => {
  const routesRef = collection(db, 'companies', companyId, 'routes'); // Updated path
  const snapshot = await getDocs(routesRef);
  
  return snapshot.docs.map(doc => {
    const data = doc.data() as any; // Cast to 'any'
    return {
      id: doc.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Route; // Final cast to Route
  });
};

// --- Schedule operations ---

export const getSchedules = async (companyId: string, routeId: string): Promise<Schedule[]> => {
  const schedulesRef = collection(db, 'companies', companyId, 'routes', routeId, 'schedules'); // Updated path
  // NOTE: orderBy is used here, ensure Firestore indexes are in place if running in production.
  const q = query(schedulesRef, where('status', '==', 'active'), orderBy('departureDateTime')); 
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => {
    const data = doc.data() as any; // Cast to 'any'
    return {
      id: doc.id,
      ...data,
      departureDateTime: timestampToDate(data.departureDateTime),
      arrivalDateTime: timestampToDate(data.arrivalTime),
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Schedule; // Final cast to Schedule
  });
};

// --- Bus operations ---

export const getBus = async (companyId: string, busId: string): Promise<Bus | null> => {
  const busRef = doc(db, 'companies', companyId, 'buses', busId); // Updated path
  const busSnap = await getDoc(busRef);
  
  if (busSnap.exists()) {
    const data = busSnap.data() as any; // Cast to 'any'
    return {
      id: busSnap.id,
      ...data,
      // Handle nested date conversion for registrationDetails
      registrationDetails: {
        ...data.registrationDetails,
        registrationDate: timestampToDate(data.registrationDetails.registrationDate),
        expiryDate: timestampToDate(data.registrationDetails.expiryDate),
      },
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Bus; // Final cast to Bus
  }
  return null;
};

// --- Search functionality (Using SearchQuery) ---

export const searchBuses = async (searchQuery: SearchQuery): Promise<SearchResult[]> => {
  const results: SearchResult[] = [];
  
  try {
    // Get all companies (formerly operators)
    const companies = await getCompanies();
    
    for (const company of companies) {
      // Get routes for this company that match origin and destination
      const routes = await getRoutes(company.id);
      const matchingRoutes = routes.filter(route => 
        route.origin.toLowerCase().includes(searchQuery.origin.toLowerCase()) &&
        route.destination.toLowerCase().includes(searchQuery.destination.toLowerCase())
      );
      
      for (const route of matchingRoutes) {
        // Get schedules for this route on the specified date
        const schedules = await getSchedules(company.id, route.id);
        const searchDate = new Date(searchQuery.date);

        const matchingSchedules = schedules.filter(schedule => {
          const scheduleDate = new Date(schedule.departureDateTime); 
          const passengers = searchQuery.passengers || 1; // Default to 1 passenger
          
          return scheduleDate.toDateString() === searchDate.toDateString() &&
             schedule.availableSeats >= passengers;
        });
        
        for (const schedule of matchingSchedules) {
          // Get bus details
          const bus = await getBus(company.id, schedule.busId);
          if (bus) {
            results.push({
              schedule,
              route,
              bus,
              company // Updated to 'company'
            });
          }
        }
      }
    }
    
    // Sort results by departure time
    results.sort((a, b) => 
      new Date(a.schedule.departureDateTime).getTime() - new Date(b.schedule.departureDateTime).getTime()
    );
    
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
    // Convert all Date fields to Timestamp for storage
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
    const data = bookingSnap.data() as any; // Cast to 'any'
    return {
      id: bookingSnap.id,
      ...data,
      // Convert all stored Timestamps back to Date
      bookingDate: timestampToDate(data.bookingDate),
      cancellationDate: data.cancellationDate ? timestampToDate(data.cancellationDate) : undefined,
      refundDate: data.refundDate ? timestampToDate(data.refundDate) : undefined,
      paymentInitiatedAt: data.paymentInitiatedAt ? timestampToDate(data.paymentInitiatedAt) : undefined,
      paymentCompletedAt: data.paymentCompletedAt ? timestampToDate(data.paymentCompletedAt) : undefined,
      confirmedDate: data.confirmedDate ? timestampToDate(data.confirmedDate) : undefined,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Booking; // Final cast to Booking
  }
  return null;
};

export const getUserBookings = async (userId: string): Promise<Booking[]> => {
  const bookingsRef = collection(db, 'bookings');
  const q = query(bookingsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => {
    const data = doc.data() as any; // Cast to 'any'
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
    } as Booking; // Final cast to Booking
  });
};

export const getCompanyBookings = async (companyId: string): Promise<Booking[]> => {
  const bookingsRef = collection(db, 'bookings');
  const q = query(bookingsRef, where('companyId', '==', companyId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => {
    const data = doc.data() as any; // Cast to 'any'
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
    } as Booking; // Final cast to Booking
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
