"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, Search, MapPin, ArrowRight, Bus, Compass } from "lucide-react";
import BackButton from "@/components/BackButton";

interface CompanyCardData {
  id: string;
  name: string;
  logo: string | null;
  description: string;
  email: string;
  phone: string;
  address: string;
  regions: string[];
  activeRoutesCount: number;
  averageRating: number;
  totalReviews: number;
  isPartner?: boolean;
  bookingEnabled?: boolean;
}

interface OperatorsClientProps {
  initialCompanies: CompanyCardData[];
}

export default function OperatorsClient({ initialCompanies }: OperatorsClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");

  // Get all unique regions across all companies for the filter dropdown
  const allRegions = useMemo(() => {
    const regionsSet = new Set<string>();
    initialCompanies.forEach((company) => {
      company.regions.forEach((r) => regionsSet.add(r));
    });
    return Array.from(regionsSet).sort();
  }, [initialCompanies]);

  // Filter companies based on search term and selected region
  const filteredCompanies = useMemo(() => {
    return initialCompanies.filter((company) => {
      const matchesSearch =
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRegion =
        selectedRegion === "all" || company.regions.includes(selectedRegion);

      return matchesSearch && matchesRegion;
    }).sort((a, b) => {
      const aP = a.isPartner ? 0 : 1;
      const bP = b.isPartner ? 0 : 1;
      return aP - bP;
    });
  }, [initialCompanies, searchTerm, selectedRegion]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header section with elegant gradient background card (Full-bleed) */}
      <header className="relative bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 text-white pt-24 sm:pt-28 lg:pt-32 pb-24 px-4 sm:px-6 lg:px-8 border-b border-brand-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.03),transparent_60%)]" />
        <div className="relative z-10 max-w-7xl mx-auto space-y-4">
          <div className="flex items-start">
            <BackButton iconOnly hideOnMobile={false} className="border-white/25 text-white hover:bg-white/15 hover:text-white" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-brand-100 tracking-wider uppercase">
            <Compass className="w-3.5 h-3.5 animate-spin-slow" /> Operator Directory
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight font-display bg-gradient-to-r from-white via-slate-100 to-brand-100 bg-clip-text text-transparent">
            Bus Partners & Operators
          </h1>
          <p className="text-sm md:text-base text-brand-100 font-medium leading-relaxed max-w-3xl">
            Compare operators, explore regions, view fleet sizes, and read verified reviews. Find the perfect ride for your next journey in Malawi.
          </p>
        </div>
      </header>

      {/* Main content overlapping slightly */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-10 space-y-8">
        {/* Search & Filter Bar */}
        <section className="bg-white rounded-2xl shadow-premium p-4 md:p-6 flex flex-col md:flex-row gap-4 items-center justify-between border border-slate-100">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search operator name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-800 placeholder-slate-400 transition-all font-medium"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <label htmlFor="region-filter" className="text-sm font-semibold text-slate-600 shrink-0">
              Filter by Region:
            </label>
            <select
              id="region-filter"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full md:w-56 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white text-slate-800 font-medium transition-all"
            >
              <option value="all">All Regions</option>
              {allRegions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Grid of Operators */}
        <section>
          {filteredCompanies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCompanies.map((company) => (
                <article
                  key={company.id}
                  className="group bg-white rounded-2xl border border-slate-100 hover:border-brand-200 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col h-full shadow-sm"
                >
                  {/* Header & Logo block */}
                  <div className="p-6 pb-4 flex items-start gap-4">
                    {company.logo ? (
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-100 shrink-0 relative bg-slate-50">
                        <Image
                          src={company.logo}
                          alt={`${company.name} logo`}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-600 to-indigo-700 flex items-center justify-center text-white font-black text-2xl shrink-0">
                        {company.name.charAt(0)}
                      </div>
                    )}

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-slate-900 text-lg group-hover:text-brand-700 transition-colors truncate">
                          {company.name}
                        </h2>
                        {company.isPartner === false && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            Timetable Only
                          </span>
                        )}
                      </div>
                      
                      {/* Rating display */}
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center text-amber-500">
                          <Star className="w-4 h-4 fill-amber-500" />
                          <span className="text-sm font-bold text-slate-800 ml-1">
                            {company.averageRating}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 font-medium">
                          ({company.totalReviews} review{company.totalReviews !== 1 ? "s" : ""})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="px-6 flex-1 flex flex-col justify-between space-y-4">
                    <p className="text-sm text-slate-500 font-medium line-clamp-3 leading-relaxed">
                      {company.description || "Leading transportation services operator committed to passenger safety, reliability, and comfort."}
                    </p>

                    <div className="space-y-3">
                      {/* Stats chips */}
                      <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                        <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3">
                          <Bus className="w-4 h-4 text-brand-600 shrink-0" />
                          <span>{company.activeRoutesCount} Active Route{company.activeRoutesCount !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{company.regions.length} Region{company.regions.length !== 1 ? "s" : ""}</span>
                        </div>
                      </div>

                      {/* Regions badges list */}
                      {company.regions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {company.regions.slice(0, 3).map((region) => (
                            <span
                              key={region}
                              className="px-2.5 py-1 bg-indigo-50 border border-indigo-100/60 text-indigo-700 font-semibold rounded-full text-[10px]"
                            >
                              {region}
                            </span>
                          ))}
                          {company.regions.length > 3 && (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-500 font-bold rounded-full text-[10px]">
                              +{company.regions.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer link to Profile */}
                  <div className="p-6 pt-4 mt-auto">
                    <Link
                      href={`/operators/${company.id}`}
                      className="w-full py-3 px-4 rounded-xl bg-coral-500 hover:bg-coral-600 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 group/btn cursor-pointer shadow-sm"
                    >
                      View Operator Profile
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-100 py-16 px-6 text-center shadow-sm">
              <div className="text-5xl mb-4">🚌</div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No operators found</h3>
              <p className="text-slate-500 max-w-md mx-auto font-medium">
                We couldn't find any operators matching your search or filters. Try search words like "Lilongwe" or adjusting the region filter.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
