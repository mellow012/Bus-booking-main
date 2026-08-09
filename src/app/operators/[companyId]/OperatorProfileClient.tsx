"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Star,
  MapPin,
  Mail,
  Phone,
  Globe,
  Bus as BusIcon,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
  Clock,
  Camera,
  ArrowLeft,
  Compass,
  Search,
} from "lucide-react";
import { AMENITY_ICONS, formatDuration } from "@/utils/homeHelpers";
import BackButton from "@/components/BackButton";

interface RouteStop {
  id: string;
  name: string;
  order: number;
  distanceFromOrigin?: number;
}

interface RouteData {
  id: string;
  name: string;
  origin: string;
  destination: string;
  distance: number;
  duration: number;
  baseFare: number;
  stopsCount: number;
  stops: RouteStop[];
}

interface BusData {
  id: string;
  licensePlate: string;
  busType: string;
  capacity: number;
  amenities: string[];
  images: string[];
}

interface OperatorContact {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
}

interface RegionData {
  id: string;
  name: string;
  code: string | null;
  operators: OperatorContact[];
}

interface CompanyProfileData {
  id: string;
  name: string;
  logo: string | null;
  description: string;
  email: string;
  phone: string;
  address: string;
  operatingHours: Record<string, { open: string; close: string; closed: boolean }> | null;
  contactSettings: {
    supportEmail: string;
    supportPhone: string;
    whatsappNumber: string;
    officeAddress: string;
    website: string;
  };
  regions: RegionData[];
  routes: RouteData[];
  buses: BusData[];
  averageRating: number;
  totalReviews: number;
}

interface OperatorProfileClientProps {
  company: CompanyProfileData;
}

export default function OperatorProfileClient({ company }: OperatorProfileClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"routes" | "fleet" | "regions">("routes");

  // Search and Pagination for Routes Tab
  const [routesSearch, setRoutesSearch] = useState("");
  const [routesPage, setRoutesPage] = useState(1);
  const ROUTES_PER_PAGE = 6;

  const filteredRoutes = useMemo(() => {
    if (!routesSearch.trim()) return company.routes;
    const query = routesSearch.toLowerCase();
    return company.routes.filter((route) => {
      const matchOrigin = route.origin.toLowerCase().includes(query);
      const matchDest = route.destination.toLowerCase().includes(query);
      const matchName = route.name?.toLowerCase().includes(query);
      const matchStops = route.stops?.some((stop) =>
        stop.name.toLowerCase().includes(query)
      );
      return matchOrigin || matchDest || matchName || matchStops;
    });
  }, [company.routes, routesSearch]);

  const totalRoutesPages = Math.ceil(filteredRoutes.length / ROUTES_PER_PAGE);

  const paginatedRoutes = useMemo(() => {
    const startIdx = (routesPage - 1) * ROUTES_PER_PAGE;
    return filteredRoutes.slice(startIdx, startIdx + ROUTES_PER_PAGE);
  }, [filteredRoutes, routesPage]);

  useEffect(() => {
    setRoutesPage(1);
  }, [routesSearch]);

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") {
        setActiveImageIndex((prev) => (prev === lightboxImages.length - 1 ? 0 : prev + 1));
      }
      if (e.key === "ArrowLeft") {
        setActiveImageIndex((prev) => (prev === 0 ? lightboxImages.length - 1 : prev - 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, lightboxImages]);

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setActiveImageIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Full-bleed Header Banner */}
      <div className="bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 text-white pt-24 sm:pt-28 lg:pt-32 pb-24 px-4 sm:px-6 lg:px-8 border-b border-brand-800">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex items-start">
            <BackButton href="/operators" iconOnly hideOnMobile={false} className="border-white/25 text-white hover:bg-white/15 hover:text-white" />
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-4">
            <div className="flex items-center gap-4 sm:gap-6">
              {company.logo ? (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-white/20 shadow-md relative bg-white shrink-0">
                  <Image
                    src={company.logo}
                    alt={`${company.name} logo`}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-700 border-2 border-white/20 shadow-md flex items-center justify-center text-white font-black text-3xl sm:text-4xl shrink-0">
                  {company.name.charAt(0)}
                </div>
              )}
              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-display text-white">
                  {company.name}
                </h1>
                <div className="flex items-center gap-1.5 text-brand-100">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-bold text-white">
                    {company.averageRating}
                  </span>
                  <span className="text-xs text-brand-200">
                    ({company.totalReviews} verified review{company.totalReviews !== 1 ? "s" : ""})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlapping Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-10 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column: About & Contact Details */}
          <section className="lg:col-span-2 bg-white rounded-2xl shadow-premium p-6 md:p-8 space-y-6 border border-slate-100 flex flex-col justify-between">
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">About the Operator</h2>
              <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                {company.description || "Providing exceptional transportation and logistics services across Malawi. Focused on passenger comfort, strict safety standards, and reliable travel timetables."}
              </p>
            </div>

            {/* Contact grid */}
            <div className="pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {company.contactSettings.supportPhone && (
                <a
                  href={`tel:${company.contactSettings.supportPhone.replace(/\s+/g, "")}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/20 hover:shadow-xs transition-all duration-300 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">
                      Call Center
                    </span>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-brand-700 transition-colors">
                      {company.contactSettings.supportPhone}
                    </span>
                  </div>
                </a>
              )}

              {company.contactSettings.supportEmail && (
                <a
                  href={`mailto:${company.contactSettings.supportEmail}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/20 hover:shadow-xs transition-all duration-300 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">
                      Support Email
                    </span>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-brand-700 transition-colors truncate block max-w-[200px] sm:max-w-none">
                      {company.contactSettings.supportEmail}
                    </span>
                  </div>
                </a>
              )}

              {company.contactSettings.whatsappNumber && (() => {
                const cleanWhatsapp = company.contactSettings.whatsappNumber
                  .replace(/[^0-9]/g, "")
                  .replace(/^0+/, "");
                const whatsappUrl = `https://wa.me/${
                  cleanWhatsapp.length <= 9 ? "265" + cleanWhatsapp : cleanWhatsapp
                }`;
                return (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/20 hover:shadow-xs transition-all duration-300 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors">
                      <svg
                        className="w-4 h-4 text-emerald-600 fill-emerald-600 group-hover:text-emerald-500 group-hover:fill-emerald-500 transition-colors"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.59 1.981 14.115.95 11.48.951c-5.436 0-9.86 4.37-9.864 9.8.001 1.748.472 3.42 1.365 4.87L1.92 20.312l4.727-1.158zm11.365-7.46c-.08-.13-.292-.21-.615-.37-.324-.16-1.916-.94-2.21-1.05-.294-.11-.508-.16-.723.16-.215.32-.832 1.05-1.02 1.26-.188.21-.376.24-.7.08-.324-.16-1.365-.5-2.601-1.6-1.039-.93-1.632-2.11-1.836-2.46-.204-.35-.022-.54.152-.7.157-.145.324-.37.487-.56.163-.19.217-.32.324-.54.108-.22.054-.41-.027-.57-.08-.16-.723-1.74-.99-2.39-.26-.63-.526-.55-.723-.56-.189-.01-.406-.01-.622-.01-.215 0-.568.08-.865.4-.297.32-1.135 1.11-1.135 2.71 0 1.6 1.168 3.15 1.33 3.37.162.22 2.298 3.51 5.567 4.92.777.34 1.384.54 1.856.69.78.25 1.489.22 2.05.13.625-.09 1.916-.78 2.186-1.53.27-.75.27-1.4.19-1.53z" />
                      </svg>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">
                        WhatsApp Chat
                      </span>
                      <span className="text-xs font-bold text-slate-800 group-hover:text-brand-700 transition-colors">
                        {company.contactSettings.whatsappNumber}
                      </span>
                    </div>
                  </a>
                );
              })()}

              {company.contactSettings.website && (
                <a
                  href={
                    company.contactSettings.website.startsWith("http")
                      ? company.contactSettings.website
                      : `https://${company.contactSettings.website}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/20 hover:shadow-xs transition-all duration-300 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors">
                    <Globe className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">
                      Website
                    </span>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-brand-700 transition-colors truncate block max-w-[200px] sm:max-w-none">
                      {company.contactSettings.website}
                    </span>
                  </div>
                </a>
              )}

              {company.contactSettings.officeAddress && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    company.contactSettings.officeAddress
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/20 hover:shadow-xs transition-all duration-300 group sm:col-span-2"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors">
                    <MapPin className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">
                      Headquarters
                    </span>
                    <span className="text-sm font-bold text-slate-800 group-hover:text-brand-700 transition-colors truncate block max-w-[280px] sm:max-w-none">
                      {company.contactSettings.officeAddress}
                    </span>
                  </div>
                </a>
              )}
            </div>
          </section>

          {/* Right Column: Working Hours */}
          <section className="bg-white rounded-2xl shadow-premium p-6 md:p-8 space-y-4 border border-slate-100">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Clock className="w-4 h-4 text-brand-600 animate-pulse" />
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Working Hours</h2>
            </div>
            <div className="space-y-3">
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => {
                const hours = company.operatingHours?.[day] || company.operatingHours?.[day.toLowerCase()];
                const isClosed = hours ? hours.closed : (day === "Sunday" ? true : false);
                const openTime = hours?.open || "08:00";
                const closeTime = hours?.close || "17:00";

                return (
                  <div key={day} className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-600">{day}</span>
                    {isClosed ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-bold text-[9px]">
                        Closed
                      </span>
                    ) : (
                      <span className="font-bold text-slate-850 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg text-[10px]">
                        {openTime} - {closeTime}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

      {/* Tabs Selector */}
      <nav className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("routes")}
          className={`py-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "routes"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Routes
          <span
            className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === "routes" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {company.routes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("fleet")}
          className={`py-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "fleet"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Fleet
          <span
            className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === "fleet" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {company.buses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("regions")}
          className={`py-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "regions"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Branches
          <span
            className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === "regions" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {company.regions.length}
          </span>
        </button>
      </nav>

      {/* Tab Contents */}
      <section className="min-h-[300px]">
        {/* ROUTES TAB */}
        {activeTab === "routes" && (
          <div className="space-y-6">
            {/* Routes Search Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search routes by origin, destination, or stops..."
                  value={routesSearch}
                  onChange={(e) => setRoutesSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500 text-sm bg-white shadow-sm"
                />
              </div>
              <span className="text-xs text-slate-400 font-semibold shrink-0">
                Showing {filteredRoutes.length} route{filteredRoutes.length !== 1 ? "s" : ""}
              </span>
            </div>

            {filteredRoutes.length > 0 ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {paginatedRoutes.map((route) => (
                    <article
                      key={route.id}
                      onClick={() =>
                        router.push(
                          `/schedules?from=${encodeURIComponent(route.origin)}&to=${encodeURIComponent(
                            route.destination
                          )}`
                        )
                      }
                      className="group bg-white rounded-2xl border border-slate-100 hover:border-brand-200 hover:shadow-md transition-all duration-300 p-6 flex flex-col justify-between gap-6 cursor-pointer"
                    >
                      <div className="space-y-4">
                        {/* Origin/Destination display */}
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <h3 className="font-extrabold text-slate-900 text-base md:text-lg group-hover:text-brand-700 transition-colors">
                              {route.origin} → {route.destination}
                            </h3>
                            <p className="text-xs text-slate-400 font-semibold mt-1">
                              {route.name}
                            </p>
                          </div>

                          {/* Stops Count Chip */}
                          {route.stopsCount > 0 && (
                            <span className="text-[10px] font-bold text-brand-600 bg-brand-50 border border-brand-100/60 px-2.5 py-1 rounded-full shrink-0">
                              {route.stopsCount} stop{route.stopsCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {/* Travel info indicators */}
                        <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-slate-500">
                          <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl">
                            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>Duration: {formatDuration(route.duration)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl">
                            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>Distance: {route.distance} km</span>
                          </div>
                        </div>

                        {/* Intermediate stops list */}
                        {route.stops && route.stops.length > 0 && (
                          <div className="mt-2 text-left pt-2 border-t border-slate-50">
                            <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                              Route Stops
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {route.stops.map((stop, sIdx) => (
                                <span
                                  key={stop.id || sIdx}
                                  className="inline-flex items-center text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-100/80 px-2.5 py-0.5 rounded-lg"
                                >
                                  {stop.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Pricing context & Action CTA */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <div>
                          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            Fares Starting From
                          </span>
                          <span className="text-lg font-black text-brand-600">
                            MWK {route.baseFare.toLocaleString()}
                          </span>
                        </div>
                        <button className="py-2.5 px-4 rounded-xl bg-coral-500 group-hover:bg-coral-600 text-white text-xs font-bold transition-colors flex items-center gap-1.5">
                          Book Journey
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                {totalRoutesPages > 1 && (
                  <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRoutesPage(prev => Math.max(prev - 1, 1));
                      }}
                      disabled={routesPage === 1}
                      className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-semibold text-slate-500">
                      Page {routesPage} of {totalRoutesPages}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRoutesPage(prev => Math.min(prev + 1, totalRoutesPages));
                      }}
                      disabled={routesPage === totalRoutesPages}
                      className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            ) : company.routes.length > 0 ? (
              <div className="bg-white rounded-3xl border border-slate-100 py-16 px-6 text-center shadow-sm">
                <p className="text-slate-500 font-medium">No routes found matching "{routesSearch}".</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-100 py-16 px-6 text-center shadow-sm">
                <p className="text-slate-500 font-medium">No active routes assigned to this operator.</p>
              </div>
            )}
          </div>
        )}

        {/* FLEET TAB */}
        {activeTab === "fleet" && (
          <div className="space-y-8">
            {company.buses.length > 0 ? (
              <div className="space-y-8">
                {company.buses.map((bus) => (
                  <article
                    key={bus.id}
                    className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 md:p-8 space-y-6"
                  >
                    {/* Bus Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                          <BusIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-lg">
                            {bus.licensePlate}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                              {bus.busType}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="text-xs text-slate-500 font-semibold">
                              {bus.capacity} seats capacity
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Amenities listing */}
                      {bus.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {bus.amenities.map((amenity) => {
                            const Icon = AMENITY_ICONS[amenity] || Compass;
                            return (
                              <span
                                key={amenity}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-700 text-xs font-semibold rounded-full border border-slate-100"
                              >
                                <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {amenity}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Bus Photos Grid */}
                    {bus.images.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5" /> Fleet Galleries ({bus.images.length})
                        </h4>

                        {/* Modern responsive photo grid */}
                        <div className="w-full">
                          {bus.images.length === 1 && (
                            <div
                              className="relative group overflow-hidden rounded-2xl border border-slate-100 shadow-sm cursor-pointer w-full max-w-2xl aspect-[16/9]"
                              onClick={() => openLightbox(bus.images, 0)}
                            >
                              <img
                                src={bus.images[0]}
                                alt={`${bus.licensePlate} full view`}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                              />
                              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-all flex items-center justify-center">
                                <span className="text-white text-xs font-semibold bg-black/60 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                  View Full Photo
                                </span>
                              </div>
                            </div>
                          )}

                          {bus.images.length === 2 && (
                            <div className="grid grid-cols-2 gap-3 max-w-3xl">
                              {bus.images.map((img, i) => (
                                <div
                                  key={i}
                                  className="relative group overflow-hidden rounded-2xl border border-slate-100 shadow-sm cursor-pointer aspect-[4/3]"
                                  onClick={() => openLightbox(bus.images, i)}
                                >
                                  <img
                                    src={img}
                                    alt={`${bus.licensePlate} angle ${i + 1}`}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-all flex items-center justify-center">
                                    <span className="text-white text-[11px] font-semibold bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1 opacity-0 group-hover:opacity-100 transform translate-y-1.5 group-hover:translate-y-0 transition-all duration-300">
                                      View
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {bus.images.length === 3 && (
                            <div className="grid grid-cols-3 gap-3 max-w-4xl aspect-[16/9] w-full">
                              <div
                                className="col-span-2 relative group overflow-hidden rounded-2xl border border-slate-100 shadow-sm cursor-pointer h-full"
                                onClick={() => openLightbox(bus.images, 0)}
                              >
                                <img
                                  src={bus.images[0]}
                                  alt={`${bus.licensePlate} primary view`}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
                                />
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-all flex items-center justify-center">
                                  <span className="text-white text-xs font-semibold bg-black/60 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                    View Gallery
                                  </span>
                                </div>
                              </div>
                              <div className="col-span-1 grid grid-rows-2 gap-3 h-full">
                                {bus.images.slice(1, 3).map((img, idx) => (
                                  <div
                                    key={idx}
                                    className="relative group overflow-hidden rounded-2xl border border-slate-100 shadow-sm cursor-pointer h-full"
                                    onClick={() => openLightbox(bus.images, idx + 1)}
                                  >
                                    <img
                                      src={img}
                                      alt={`${bus.licensePlate} angle ${idx + 2}`}
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {bus.images.length === 4 && (
                            <div className="grid grid-cols-2 gap-3 max-w-4xl aspect-[16/9] w-full">
                              {bus.images.map((img, i) => (
                                <div
                                  key={i}
                                  className="relative group overflow-hidden rounded-2xl border border-slate-100 shadow-sm cursor-pointer h-full"
                                  onClick={() => openLightbox(bus.images, i)}
                                >
                                  <img
                                    src={img}
                                    alt={`${bus.licensePlate} perspective ${i + 1}`}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {bus.images.length >= 5 && (
                            <div className="grid grid-cols-4 gap-3 max-w-5xl aspect-[16/9] w-full">
                              {/* Left large photo */}
                              <div
                                className="col-span-2 row-span-2 relative group overflow-hidden rounded-2xl border border-slate-100 shadow-sm cursor-pointer h-full"
                                onClick={() => openLightbox(bus.images, 0)}
                              >
                                <img
                                  src={bus.images[0]}
                                  alt={`${bus.licensePlate} main angle`}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
                                />
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-all flex items-center justify-center">
                                  <span className="text-white text-xs font-semibold bg-black/60 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                    View Gallery
                                  </span>
                                </div>
                              </div>
                              {/* Right grid */}
                              <div className="col-span-2 grid grid-cols-2 grid-rows-2 gap-3 h-full">
                                {bus.images.slice(1, 5).map((img, idx) => {
                                  const imageIndex = idx + 1;
                                  const isLastSlot = idx === 3;
                                  const hasMore = bus.images.length > 5;
                                  const remainingCount = bus.images.length - 5;

                                  return (
                                    <div
                                      key={idx}
                                      className="relative group overflow-hidden rounded-2xl border border-slate-100 shadow-sm cursor-pointer h-full"
                                      onClick={() => openLightbox(bus.images, imageIndex)}
                                    >
                                      <img
                                        src={img}
                                        alt={`${bus.licensePlate} sub-view ${imageIndex}`}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                      />
                                      {isLastSlot && hasMore && (
                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white transition-colors duration-300 group-hover:bg-black/50">
                                          <span className="text-lg font-black">
                                            +{remainingCount}
                                          </span>
                                          <span className="text-[9px] font-bold uppercase tracking-wider">
                                            More Photos
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 rounded-2xl border border-slate-100 border-dashed py-8 text-center text-slate-400 font-semibold text-xs flex flex-col items-center gap-1.5">
                        <span>No photos available for this bus.</span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-100 py-16 px-6 text-center shadow-sm">
                <p className="text-slate-500 font-medium">No registered fleet buses found for this operator.</p>
              </div>
            )}
          </div>
        )}

        {/* REGIONS TAB */}
        {activeTab === "regions" && (
          <div className="space-y-6">
            {company.regions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {company.regions.map((region) => (
                  <div
                    key={region.id}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between"
                  >
                    {/* Branch Header */}
                    <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650 shrink-0">
                          <MapPin className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-base">{region.name}</h3>
                          {region.code && (
                            <p className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-wider mt-0.5">
                              Branch Code: {region.code}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Branch
                      </span>
                    </div>

                    {/* Branch Contact Numbers */}
                    <div className="p-5 space-y-4 flex-1">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                        Customer Service
                      </span>
                      {(() => {
                        // Deduplicate phone numbers across operators in this branch
                        const phones = (region.operators || [])
                          .map((op) => op.phone)
                          .filter((p): p is string => Boolean(p && p.trim()));
                        const uniquePhones = Array.from(new Set(phones));

                        if (uniquePhones.length > 0) {
                          return (
                            <div className="space-y-3">
                              {uniquePhones.map((phone, idx) => {
                                const cleanWhatsapp = phone.replace(/[^0-9]/g, "");
                                const whatsappUrl = `https://wa.me/${
                                  cleanWhatsapp.length <= 9 ? "265" + cleanWhatsapp : cleanWhatsapp
                                }`;
                                return (
                                  <div key={idx} className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-700 shrink-0">
                                        <Phone className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="min-w-0">
                                        <span className="block text-xs font-bold text-slate-800 leading-tight">
                                          {phone}
                                        </span>
                                        <span className="text-[10px] font-semibold text-slate-400">
                                          Customer Service
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <a
                                        href={`tel:${phone.replace(/\s+/g, "")}`}
                                        title="Call"
                                        className="w-7 h-7 rounded-lg border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-all"
                                      >
                                        <Phone className="w-3.5 h-3.5" />
                                      </a>
                                      <a
                                        href={whatsappUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="WhatsApp"
                                        className="w-7 h-7 rounded-lg border border-slate-100 hover:border-teal-200 hover:bg-teal-50/30 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-all"
                                      >
                                        <svg
                                          className="w-3.5 h-3.5 fill-current"
                                          viewBox="0 0 24 24"
                                          xmlns="http://www.w3.org/2000/svg"
                                        >
                                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.59 1.981 14.115.95 11.48.951c-5.436 0-9.86 4.37-9.864 9.8.001 1.748.472 3.42 1.365 4.87L1.92 20.312l4.727-1.158zm11.365-7.46c-.08-.13-.292-.21-.615-.37-.324-.16-1.916-.94-2.21-1.05-.294-.11-.508-.16-.723.16-.215.32-.832 1.05-1.02 1.26-.188.21-.376.24-.7.08-.324-.16-1.365-.5-2.601-1.6-1.039-.93-1.632-2.11-1.836-2.46-.204-.35-.022-.54.152-.7.157-.145.324-.37.487-.56.163-.19.217-.32.324-.54.108-.22.054-.41-.027-.57-.08-.16-.723-1.74-.99-2.39-.26-.63-.526-.55-.723-.56-.189-.01-.406-.01-.622-.01-.215 0-.568.08-.865.4-.297.32-1.135 1.11-1.135 2.71 0 1.6 1.168 3.15 1.33 3.37.162.22 2.298 3.51 5.567 4.92.777.34 1.384.54 1.856.69.78.25 1.489.22 2.05.13.625-.09 1.916-.78 2.186-1.53.27-.75.27-1.4.19-1.53z" />
                                        </svg>
                                      </a>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }

                        return (
                          <p className="text-xs text-slate-400 italic py-2">
                            No contact number available for this branch.
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-100 py-16 px-6 text-center shadow-sm">
                <p className="text-slate-500 font-medium">No operating branches registered.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Lightbox Modal Component */}
      {lightboxOpen && lightboxImages.length > 0 && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-md z-[150] flex flex-col items-center justify-center animate-in fade-in duration-200"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Top Bar */}
          <div className="absolute top-0 inset-x-0 h-16 flex items-center justify-between px-6 bg-gradient-to-b from-black/60 to-transparent text-white z-10 select-none">
            <span className="text-sm font-medium text-gray-300">
              {activeImageIndex + 1} / {lightboxImages.length}
            </span>
            <button
              onClick={() => setLightboxOpen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white focus:outline-none cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Image Container */}
          <div
            className="relative w-full max-w-5xl px-4 flex items-center justify-center h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImages[activeImageIndex]}
              alt={`Bus photo ${activeImageIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none animate-in zoom-in-95 duration-200"
            />

            {/* Navigation Buttons */}
            {lightboxImages.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex((prev) => (prev === 0 ? lightboxImages.length - 1 : prev - 1));
                  }}
                  className="absolute left-2 md:left-6 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 transition-all text-white border border-white/10 hover:scale-105 active:scale-95 focus:outline-none cursor-pointer"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex((prev) => (prev === lightboxImages.length - 1 ? 0 : prev + 1));
                  }}
                  className="absolute right-2 md:right-6 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 transition-all text-white border border-white/10 hover:scale-105 active:scale-95 focus:outline-none cursor-pointer"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Bottom Info bar */}
          <div className="absolute bottom-4 text-center text-xs text-gray-400 select-none">
            Use Left/Right arrow keys or Esc to close
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
