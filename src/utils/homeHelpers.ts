import { MapPin, Bus as BusIcon, Clock, Calendar, Users, Star, ArrowRight, Zap, Shield, CheckCircle, RefreshCw, Award, Navigation, Wifi, AirVent, Music, Coffee } from "lucide-react";

export interface EnhancedSchedule {
  id: string; companyLogo?: string; companyId: string; busId: string; routeId: string;
  price: number; availableSeats: number; totalSeats: number; status: string;
  date: string; departureTime: string; arrivalTime: string;
  companyName: string; origin: string; destination: string;
  duration: number; distance: number; busNumber: string; busType: string; amenities: string[];
  departureLocation?: string;
  arrivalLocation?: string;
}

export type GeoStatus = "idle" | "detecting" | "granted" | "denied" | "unavailable";

export const MALAWI_CITIES = [
  "Blantyre","Lilongwe","Mzuzu","Zomba","Kasungu","Mangochi","Salima",
  "Karonga","Nkhata Bay","Liwonde","Balaka","Ntchisi","Dedza",
  "Monkey Bay","Chipoka","Nkhotakota","Rumphi","Chitipa","Mulanje","Thyolo",
];

// Approximate coordinates for major Malawian cities
const CITY_COORDS: Record<string, [number, number]> = {
  "Blantyre":   [-15.7861, 35.0058],
  "Lilongwe":   [-13.9626, 33.7741],
  "Mzuzu":      [-11.4618, 34.0215],
  "Zomba":      [-15.3833, 35.3188],
  "Kasungu":    [-13.0333, 33.4833],
  "Mangochi":   [-14.4781, 35.2644],
  "Salima":     [-13.7806, 34.4587],
  "Karonga":    [-9.9333,  33.9400],
  "Nkhata Bay": [-11.6042, 34.3000],
  "Liwonde":    [-15.0667, 35.2333],
  "Balaka":     [-14.9833, 34.9500],
  "Ntchisi":    [-13.5333, 34.0000],
  "Dedza":      [-14.3833, 34.3333],
  "Monkey Bay": [-14.0833, 34.9167],
  "Chipoka":    [-13.9833, 34.5167],
  "Nkhotakota": [-12.9167, 34.3000],
  "Rumphi":     [-11.0167, 33.8500],
  "Chitipa":    [-9.7000,  33.2667],
  "Mulanje":    [-15.9333, 35.5000],
  "Thyolo":     [-16.0667, 35.1500],
};

/** Find the nearest Malawian city to a given lat/lng */
export function nearestCity(lat: number, lng: number): string {
  let best = MALAWI_CITIES[0];
  let bestDist = Infinity;
  for (const [city, [cLat, cLng]] of Object.entries(CITY_COORDS)) {
    const d = Math.sqrt((lat - cLat) ** 2 + (lng - cLng) ** 2);
    if (d < bestDist) { bestDist = d; best = city; }
  }
  return best;
}

export const isToday = (d: string) => { const a = new Date(d), n = new Date(); return a.getFullYear()===n.getFullYear()&&a.getMonth()===n.getMonth()&&a.getDate()===n.getDate(); };
export const cityMatch  = (s: EnhancedSchedule, city: string) => { const q = city.toLowerCase(); return s.origin.toLowerCase().includes(q)||s.destination.toLowerCase().includes(q); };
export const formatDuration = (m: number) => { const h=Math.floor(m/60),mn=m%60; return h>0?(mn>0?`${h}h ${mn}m`:`${h}h`):`${mn}m`; };
export const seatColor  = (a: number, t: number) => { const p=(a/t)*100; return p>50?"text-emerald-600":p>20?"text-amber-500":"text-rose-500"; };
export const fillingFast = (a: number, t: number) => t>0&&a/t<=0.2&&a>0;

export const AMENITY_ICONS: Record<string, React.ElementType> = {
  "WiFi": Wifi, "AC": AirVent, "Coffee": Coffee,
  "Entertainment": Music, "Charging": Zap, "Reclining Seats": Users,
};

export const getScheduleCategory = (s: EnhancedSchedule): string => {
  const [hours] = s.departureTime.split(':').map(Number);
  const now = new Date();
  const currentHour = now.getHours();
  
  // Active Now if within 4 hours (and >= -1 hours) or in transit/arrived
  const hoursDiff = hours - currentHour;
  const isActive = ['boarding', 'en_route', 'arrived'].includes(s.status);
  if (isActive || (isToday(s.date) && hoursDiff >= -1 && hoursDiff <= 4)) {
    return "Boarding Now";
  }

  if (hours >= 6 && hours < 12) return "Morning";
  if (hours >= 12 && hours < 17) return "Afternoon";
  return "Evening";
};
