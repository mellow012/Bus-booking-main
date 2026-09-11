import { Home, CalendarDays, Users, DollarSign } from 'lucide-react';

export const TABS = [
  { id: 'dashboard' as const, label: 'Home', icon: Home },
  { id: 'passengers' as const, label: 'Bookings', icon: Users },
  { id: 'my-trips' as const, label: 'Schedule', icon: CalendarDays },
  { id: 'payments' as const, label: 'Payments', icon: DollarSign },
] as const;

export type TabType = typeof TABS[number]['id'] | 'profile';
