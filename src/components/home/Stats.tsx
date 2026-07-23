import React from "react";
import { Navigation, Bus as BusIcon, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";

async function getStats() {
  try {
    const [companies, routes] = await Promise.all([
      prisma.company.count({ where: { status: 'active' } }),
      prisma.route.count({ where: { isActive: true } }),
    ]);

    return {
      totalRoutes: routes || 20,
      totalCompanies: companies || 5,
    };
  } catch (error) {
    console.error("Failed to fetch home stats:", error);
    return { totalRoutes: 20, totalCompanies: 5 };
  }
}

export async function Stats() {
  const stats = await getStats();

  const items = [
    { icon: Navigation, label: "Active Routes", value: `${stats.totalRoutes}+` },
    { icon: BusIcon, label: "Partner Operators", value: `${stats.totalCompanies}` },
    { icon: ShieldCheck, label: "Verified & Secure", value: "100%" },
  ];

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-gray-200/60 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-around gap-4 sm:gap-8 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        {items.map(({ icon: Icon, label, value }, i) => (
          <div key={i} className="flex items-center gap-3.5 w-full sm:w-auto justify-center sm:justify-start pt-3 sm:pt-0 first:pt-0 sm:px-4">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0 border border-brand-100/50">
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-lg sm:text-xl font-display font-extrabold text-gray-900 leading-none">{value}</p>
              <p className="text-xs text-gray-500 font-medium mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
