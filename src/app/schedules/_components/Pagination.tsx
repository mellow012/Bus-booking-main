"use client";

import React from "react";

export default function Pagination({ currentPage, totalPages, setCurrentPage, itemsPerPage, filteredCount }: any) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between pt-8 border-t border-gray-100 gap-4 mt-8">
      <p className="text-sm font-bold text-gray-500 font-display">
        Showing <span className="text-gray-900 font-extrabold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-gray-900 font-extrabold">{Math.min(currentPage * itemsPerPage, filteredCount)}</span> of <span className="text-gray-900 font-extrabold">{filteredCount}</span> schedules
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentPage((prev: number) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 active:scale-95 ${
            currentPage === 1
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm"
          }`}
        >
          ← Prev
        </button>

        {Array.from({ length: totalPages }).map((_, index) => {
          const pageNum = index + 1;
          const shouldShow = pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - currentPage) <= 1;
          if (!shouldShow) {
            if (pageNum === 2 || pageNum === totalPages - 1) {
              return <span key={pageNum} className="text-gray-400 font-bold px-1.5 select-none">...</span>;
            }
            return null;
          }
          return (
            <button
              key={pageNum}
              onClick={() => setCurrentPage(pageNum)}
              className={`w-9 h-9 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center justify-center ${
                currentPage === pageNum
                  ? "bg-brand-700 text-white shadow-lg shadow-brand-50"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 shadow-sm"
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => setCurrentPage((prev: number) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 active:scale-95 ${
            currentPage === totalPages
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm"
          }`}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
