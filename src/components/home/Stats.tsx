import React from "react";
import { Navigation, Bus as BusIcon, Users, Award } from "lucide-react";
import { prisma } from "@/lib/prisma";

async function getStats() {
  try {
    const [companies, routes, bookings] = await Promise.all([
      prisma.company.count({ where: { status: 'active' } }),
      prisma.route.count({ where: { isActive: true } }),
      prisma.booking.count({ where: { bookingStatus: 'confirmed' } }),
    ]);

    return {
      totalRoutes: routes || 20,
      totalCompanies: companies || 5,
      totalBookings: 0,
      avgRating: 0.0,
    };
  } catch (error) {
    console.error("Failed to fetch home stats:", error);
    return { totalRoutes: 20, totalCompanies: 5, totalBookings: 0, avgRating: 0.0 };
  }
}

export async function Stats() {
  const stats = await getStats();

  const items = [
    { icon: Navigation, label: "Active Routes",     value: stats.totalRoutes,         gradient: "from-brand-600 to-brand-500" },
    { icon: BusIcon,    label: "Partner Companies", value: stats.totalCompanies,      gradient: "from-coral-500 to-coral-600" },
    { icon: Users,      label: "Happy Travellers",  value: `${stats.totalBookings}`, gradient: "from-emerald-500 to-teal-500" },
    { icon: Award,      label: "Customer Rating",   value: stats.avgRating.toFixed(1), gradient: "from-amber-500 to-orange-500" },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {items.map(({ icon: Icon, label, value, gradient }, i) => (
          <div key={i} className="bg-white rounded-2xl p-3.5 sm:p-5 shadow-sm border border-gray-100 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
              <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white"/>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-display font-extrabold text-gray-900 leading-none">{value}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 font-medium mt-0.5 leading-tight">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
