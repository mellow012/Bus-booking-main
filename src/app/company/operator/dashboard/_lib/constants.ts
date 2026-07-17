import { Home, Map, Users, User, DollarSign, LucideIcon } from 'lucide-react';

export type OperatorCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export const OPERATOR_CATEGORIES: OperatorCategory[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'routes', label: 'Routes & Schedules', icon: Map },
  { id: 'bookings', label: 'Bookings & Manifests', icon: Users },
  { id: 'revenue', label: 'Revenue', icon: DollarSign },
  { id: 'profile', label: 'Profile', icon: User },
];
