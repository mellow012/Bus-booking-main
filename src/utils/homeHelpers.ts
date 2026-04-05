import { MapPin, Bus as BusIcon, Clock, Calendar, Users, Star, ArrowRight, Zap, Shield, CheckCircle, RefreshCw, Award, Navigation, Wifi, AirVent, Search, Play, Music, Coffee, Flame, ArrowUpDown, ChevronLeft, ChevronRight, LocateFixed, X, ChevronDown } from "lucide-react";

export interface EnhancedSchedule {
  id: string; companyLogo?: string; companyId: string; busId: string; routeId: string;
  price: number; availableSeats: number; totalSeats: number; status: string;
  date: string; departureTime: string; arrivalTime: string;
  companyName: string; origin: string; destination: string;
  duration: number; distance: number; busNumber: string; busType: string; amenities: string[];
}

export type GeoStatus = "idle" | "detecting" | "granted" | "denied" | "unavailable";

export const MALAWI_CITIES = [
  "Blantyre","Lilongwe","Mzuzu","Zomba","Kasungu","Mangochi","Salima",
  "Karonga","Nkhata Bay","Liwonde","Balaka","Ntchisi","Dedza",
  "Monkey Bay","Chipoka","Nkhotakota","Rumphi","Chitipa","Mulanje","Thyolo",
];

export const isToday = (d: string) => { const a = new Date(d), n = new Date(); return a.getFullYear()===n.getFullYear()&&a.getMonth()===n.getMonth()&&a.getDate()===n.getDate(); };
export const cityMatch  = (s: EnhancedSchedule, city: string) => { const q = city.toLowerCase(); return s.origin.toLowerCase().includes(q)||s.destination.toLowerCase().includes(q); };
export const formatDuration = (m: number) => { const h=Math.floor(m/60),mn=m%60; return h>0?(mn>0?`${h}h ${mn}m`:`${h}h`):`${mn}m`; };
export const seatColor  = (a: number, t: number) => { const p=(a/t)*100; return p>50?"text-emerald-600":p>20?"text-amber-500":"text-rose-500"; };
export const fillingFast = (a: number, t: number) => t>0&&a/t<=0.2&&a>0;

export const AMENITY_ICONS: Record<string, React.ElementType> = {
  "WiFi": Wifi, "AC": AirVent, "Coffee": Coffee,
  "Entertainment": Music, "Charging": Zap, "Reclining Seats": Users,
};
