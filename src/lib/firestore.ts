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
  collectionGroup
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { 
  User, 
  Operator, 
  Bus, 
  Route, 
  Schedule, 
  Booking, 
  SearchParams, 
  SearchResult 
} from '@/types';

// Helper function to convert Firestore timestamp to Date
const timestampToDate = (timestamp: any): Date => {
  if (timestamp && timestamp.toDate) {
    return timestamp.toDate();
  }
  return new Date(timestamp);
};

// User operations
export const createUser = async (userId: string, userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => {
  const userRef = doc(db, 'users', userId);
  const now = Timestamp.now();
  await updateDoc(userRef, {
    ...userData,
    createdAt: now,
    updatedAt: now
  });
};

export const getUser = async (userId: string): Promise<User | null> => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const data = userSnap.data();
    return {
      id: userSnap.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as User;
  }
  return null;
};

// Operator operations
export const getOperators = async (): Promise<Operator[]> => {
  const operatorsRef = collection(db, 'operators');
  const snapshot = await getDocs(operatorsRef);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: timestampToDate(doc.data().createdAt),
    updatedAt: timestampToDate(doc.data().updatedAt)
  })) as Operator[];
};

export const getOperator = async (operatorId: string): Promise<Operator | null> => {
  const operatorRef = doc(db, 'operators', operatorId);
  const operatorSnap = await getDoc(operatorRef);
  
  if (operatorSnap.exists()) {
    const data = operatorSnap.data();
    return {
      id: operatorSnap.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Operator;
  }
  return null;
};

// Route operations
export const getRoutes = async (operatorId: string): Promise<Route[]> => {
  const routesRef = collection(db, 'operators', operatorId, 'routes');
  const snapshot = await getDocs(routesRef);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: timestampToDate(doc.data().createdAt),
    updatedAt: timestampToDate(doc.data().updatedAt)
  })) as Route[];
};

// Schedule operations
export const getSchedules = async (operatorId: string, routeId: string): Promise<Schedule[]> => {
  const schedulesRef = collection(db, 'operators', operatorId, 'routes', routeId, 'schedules');
  const q = query(schedulesRef, where('status', '==', 'active'), orderBy('departureTime'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    departureTime: timestampToDate(doc.data().departureTime),
    arrivalTime: timestampToDate(doc.data().arrivalTime),
    createdAt: timestampToDate(doc.data().createdAt),
    updatedAt: timestampToDate(doc.data().updatedAt)
  })) as Schedule[];
};

// Bus operations
export const getBus = async (operatorId: string, busId: string): Promise<Bus | null> => {
  const busRef = doc(db, 'operators', operatorId, 'buses', busId);
  const busSnap = await getDoc(busRef);
  
  if (busSnap.exists()) {
    const data = busSnap.data();
    return {
      id: busSnap.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt)
    } as Bus;
  }
  return null;
};

// Search functionality
export const searchBuses = async (searchParams: SearchParams): Promise<SearchResult[]> => {
  const results: SearchResult[] = [];
  
  try {
    // Get all operators
    const operators = await getOperators();
    
    for (const operator of operators) {
      // Get routes for this operator that match origin and destination
      const routes = await getRoutes(operator.id);
      const matchingRoutes = routes.filter(route => 
        route.origin.toLowerCase().includes(searchParams.origin.toLowerCase()) &&
        route.destination.toLowerCase().includes(searchParams.destination.toLowerCase())
      );
      
      for (const route of matchingRoutes) {
        // Get schedules for this route on the specified date
        const schedules = await getSchedules(operator.id, route.id);
        const matchingSchedules = schedules.filter(schedule => {
          const scheduleDate = new Date(schedule.departureTime);
          const searchDate = new Date(searchParams.departureDate);
          return scheduleDate.toDateString() === searchDate.toDateString() &&
                 schedule.availableSeats >= searchParams.passengers;
        });
        
        for (const schedule of matchingSchedules) {
          // Get bus details
          const bus = await getBus(operator.id, schedule.busId);
          if (bus) {
            results.push({
              schedule,
              route,
              bus,
              operator
            });
          }
        }
      }
    }
    
    // Sort results by departure time
    results.sort((a, b) => 
      new Date(a.schedule.departureTime).getTime() - new Date(b.schedule.departureTime).getTime()
    );
    
    return results;
  } catch (error) {
    console.error('Error searching buses:', error);
    return [];
  }
};

// Booking operations
export const createBooking = async (bookingData: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const bookingsRef = collection(db, 'bookings');
  const now = Timestamp.now();
  
  const docRef = await addDoc(bookingsRef, {
    ...bookingData,
    bookingDate: Timestamp.fromDate(bookingData.bookingDate),
    confirmationDate: bookingData.confirmationDate ? Timestamp.fromDate(bookingData.confirmationDate) : null,
    createdAt: now,
    updatedAt: now
  });
  
  return docRef.id;
};

export const getBooking = async (bookingId: string): Promise<Booking | null> => {
  const bookingRef = doc(db, 'bookings', bookingId);
  const bookingSnap = await getDoc(bookingRef);
  
  if (bookingSnap.exists()) {
    const data = bookingSnap.data();
    return {
      id: bookingSnap.id,
      ...data,
      bookingDate: timestampToDate(data.bookingDate),
      confirmationDate: data.confirmationDate ? timestampToDate(data.confirmationDate) : undefined,
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
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    bookingDate: timestampToDate(doc.data().bookingDate),
    confirmationDate: doc.data().confirmationDate ? timestampToDate(doc.data().confirmationDate) : undefined,
    createdAt: timestampToDate(doc.data().createdAt),
    updatedAt: timestampToDate(doc.data().updatedAt)
  })) as Booking[];
};

export const getOperatorBookings = async (operatorId: string): Promise<Booking[]> => {
  const bookingsRef = collection(db, 'bookings');
  const q = query(bookingsRef, where('operatorId', '==', operatorId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    bookingDate: timestampToDate(doc.data().bookingDate),
    confirmationDate: doc.data().confirmationDate ? timestampToDate(doc.data().confirmationDate) : undefined,
    createdAt: timestampToDate(doc.data().createdAt),
    updatedAt: timestampToDate(doc.data().updatedAt)
  })) as Booking[];
};

export const updateBookingStatus = async (
  bookingId: string, 
  status: Booking['bookingStatus'], 
  confirmationDate?: Date
) => {
  const bookingRef = doc(db, 'bookings', bookingId);
  const updateData: any = {
    bookingStatus: status,
    updatedAt: Timestamp.now()
  };
  
  if (confirmationDate) {
    updateData.confirmationDate = Timestamp.fromDate(confirmationDate);
  }
  
  await updateDoc(bookingRef, updateData);
};

