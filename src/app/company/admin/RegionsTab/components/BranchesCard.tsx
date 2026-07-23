'use client';

import { MapPin, BadgeCheck } from 'lucide-react';
import { BranchTripSummary } from '../utils/schedule';

interface BranchCardProps {
  branch: any;
  routeCount: number;
  operatorCount: number;
  tripSummary: BranchTripSummary;
  isSelected: boolean;
  onSelect: () => void;
}

export default function BranchCard({ branch, routeCount, operatorCount, tripSummary, isSelected, onSelect }: BranchCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`text-left bg-white rounded-xl border p-4 transition-all shadow-sm ${
        isSelected ? 'border-indigo-600 ring-2 ring-indigo-600 ring-opacity-20' : 'border-gray-200 hover:border-indigo-200 hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
          <MapPin className="w-5 h-5" />
        </div>
        {branch.isActive !== false ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700"
          >
            <BadgeCheck className="w-3 h-3" />
            Active
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-gray-100 text-gray-400"
          >
            Inactive
          </span>
        )}
      </div>

      <h3 className="font-bold text-gray-900 text-lg truncate">{branch.name}</h3>
      <p className="text-sm text-gray-500 mt-1">
        {routeCount} Routes • {operatorCount} Operators
      </p>

      {tripSummary ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 border border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-900 capitalize">
              {tripSummary.count} {tripSummary.type === 'active' ? 'active' : 'upcoming'} trip{tripSummary.count === 1 ? '' : 's'}
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-widest rounded-full px-2.5 py-1 ${
                tripSummary.type === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {tripSummary.type === 'active' ? 'Active' : 'Upcoming'}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-400">No upcoming trips in this branch.</p>
      )}
    </button>
  );
}