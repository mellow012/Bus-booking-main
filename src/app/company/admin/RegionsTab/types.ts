import { Route, Schedule } from '@/types';

export type ModalType = 'addRoute' | 'addBus' | null;

export interface ModalContext {
  branchId?: string;
  routeId?: string;
}

export interface BranchUpcomingTrip {
  schedule: Schedule;
  route: Route;
  branch: any;
  departure: number;
  arrival: number;
}

export interface RouteWithScheduleInfo {
  route: Route;
  activeCount: number;
  scheduleCount: number;
}

export interface RouteFormState {
  name: string;
  origin: string;
  destination: string;
  distance: string;
  duration: string;
  baseFare: string;
}

export interface BusFormState {
  licensePlate: string;
  busType: string;
  capacity: string;
  status: string;
}

export interface ScheduleFormState {
  routeId: string;
  busId: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  price: string;
  availableSeats: string;
}