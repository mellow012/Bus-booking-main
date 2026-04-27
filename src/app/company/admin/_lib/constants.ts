/**
 * Admin dashboard shared types, constants, and utility functions.
 * Imported by the main page and all sub-components.
 */
import {
  DollarSign, Users, Calendar, MapPin, User, Settings,
  Bell, LayoutDashboard, PieChart, Bus as BusIcon, MessageSquare,
} from 'lucide-react';
import { Company, Booking, Schedule } from '@/types';

// ── Tab & Category definitions ────────────────────────────────────────────────

export const TABS = [
  { id: 'overview'      as const, label: 'Overview',       icon: LayoutDashboard },
  { id: 'schedules'     as const, label: 'Schedules',      icon: Calendar },
  { id: 'routes'        as const, label: 'Routes',         icon: MapPin },
  { id: 'buses'         as const, label: 'Buses',          icon: BusIcon },
  { id: 'bookings'      as const, label: 'Bookings',       icon: Users },
  { id: 'charters'      as const, label: 'Charters',       icon: Users },
  { id: 'operators'     as const, label: 'Team',           icon: Users },
  { id: 'reports'       as const, label: 'Reports',        icon: PieChart },
  { id: 'profile'       as const, label: 'Profile',        icon: User },
  { id: 'settings'      as const, label: 'Settings',       icon: Settings },
  { id: 'payments'      as const, label: 'Payments',       icon: DollarSign },
  { id: 'messages'      as const, label: 'Signals',        icon: MessageSquare },
  { id: 'notifications' as const, label: 'Notifications',  icon: Bell },
] as const;

export const CATEGORIES = [
  { id: 'overview',  label: 'Dashboard',      icon: LayoutDashboard, subTabs: ['overview'] },
  { id: 'team',      label: 'Operators',       icon: Users,           subTabs: ['operators'] },
  { id: 'fleet',     label: 'Routes & Buses',  icon: BusIcon,         subTabs: ['schedules', 'routes', 'buses'] },
  { id: 'sales',     label: 'Bookings',        icon: Users,           subTabs: ['bookings', 'charters'] },
  { id: 'payments',  label: 'Payments',        icon: DollarSign,      subTabs: ['payments'] },
  { id: 'reports',   label: 'Reports',         icon: PieChart,        subTabs: ['reports'] },
  { id: 'config',    label: 'Settings',        icon: Settings,        subTabs: ['profile', 'settings', 'notifications'] },
] as const;

export const BUS_TYPES    = ['AC', 'Non-AC', 'Sleeper', 'Semi-Sleeper', 'Luxury', 'Economy', 'Minibus'] as const;
export const BUS_STATUSES = ['active', 'inactive', 'maintenance'] as const;
export const CAPACITY_LIMITS = { min: 10, max: 100 } as const;

// ── Derived types ─────────────────────────────────────────────────────────────

export type TabType      = typeof TABS[number]['id'];
export type CategoryType = typeof CATEGORIES[number]['id'];
export type AlertType    = { type: 'error' | 'success' | 'warning' | 'info'; message: string } | null;

export interface DashboardData {
  company:   Company | null;
  schedules: Schedule[];
  routes:    any[];
  buses:     any[];
  bookings:  Booking[];
  reports:   any[];
}

export interface RealtimeStatus {
  isConnected:    boolean;
  lastUpdate:     Date | null;
  pendingUpdates: number;
}

export interface TabObject {
  id:    TabType;
  label: string;
  icon:  typeof TABS[number]['icon'];
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export const validateBusData = (data: any): void => {
  const missing = ['licensePlate', 'busType', 'capacity', 'status'].filter(f => !data[f]);
  if (missing.length) throw new Error(`Missing required fields: ${missing.join(', ')}`);
  if (data.capacity < CAPACITY_LIMITS.min || data.capacity > CAPACITY_LIMITS.max)
    throw new Error(`Capacity must be between ${CAPACITY_LIMITS.min} and ${CAPACITY_LIMITS.max}`);
  if (!BUS_TYPES.includes(data.busType))   throw new Error('Invalid bus type');
  if (!BUS_STATUSES.includes(data.status)) throw new Error('Invalid status');
};

export const getAvailableTabs = (paymentSettings: Company['paymentSettings'] | undefined): TabObject[] => {
  const base: TabObject[] = [...TABS] as unknown as TabObject[];
  if (
    paymentSettings &&
    Object.keys(paymentSettings).length > 0 &&
    paymentSettings.paychanguEnabled
  ) {
    if (!base.some(t => t.id === 'payments'))
      base.push({ id: 'payments' as const, label: 'Payments', icon: DollarSign });
  }
  return base;
};
