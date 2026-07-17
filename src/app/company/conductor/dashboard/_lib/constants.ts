import { LayoutDashboard, MapPin, Users, DollarSign, FileText, User, Settings } from 'lucide-react';

export const TABS = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'my-trips' as const, label: 'My Trips', icon: MapPin },
  { id: 'passengers' as const, label: 'Passengers', icon: Users },
  { id: 'payments' as const, label: 'Payments', icon: DollarSign },
  { id: 'reports' as const, label: 'Reports', icon: FileText },
  { id: 'profile' as const, label: 'Profile', icon: User },
  { id: 'settings' as const, label: 'Settings', icon: Settings }
] as const;

export type TabType = typeof TABS[number]['id'];
